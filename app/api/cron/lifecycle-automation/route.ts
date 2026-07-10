import { NextRequest, NextResponse } from 'next/server'
import { adminClient }               from '@/lib/supabase/admin'
import { calculateWorkerReadiness } from '@/lib/onboarding/readiness'
import { getDueExpiryReminders, markExpiredDocuments, recordReminderSent } from '@/lib/onboarding/expiryScheduler'
import { createNotification }        from '@/lib/notifications/createNotification'
import type { ReadinessStaffInput, ReadinessDocumentInput } from '@/lib/onboarding/readiness'

// ── Security guard ────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// ── Per-company automation run ────────────────────────────────────────────────

async function runCompany(companyId: string): Promise<{
  staffProcessed:    number
  remindersScheduled: number
  expiredMarked:     number
  stageTransitions:  number
  errors:            number
}> {
  const result = {
    staffProcessed:    0,
    remindersScheduled: 0,
    expiredMarked:     0,
    stageTransitions:  0,
    errors:            0,
  }

  // ── 1. Mark expired documents ──────────────────────────────────────────────
  const expiry = await markExpiredDocuments(companyId)
  result.expiredMarked = expiry.marked

  // ── 2. Expiry reminder scheduling ─────────────────────────────────────────
  const dueReminders = await getDueExpiryReminders(companyId)
  for (const reminder of dueReminders) {
    try {
      // In-app notification to worker
      void createNotification({
        recipient:      'worker',
        staffProfileId: reminder.staffProfileId,
        companyId,
        eventType:      'compliance_expiring',
        title:          `Document expiring in ${reminder.daysRemaining} day${reminder.daysRemaining !== 1 ? 's' : ''}`,
        message:        `${reminder.fileName} (${reminder.documentType.replace(/_/g, ' ')}) expires on ${new Date(reminder.expiryDate).toLocaleDateString('en-GB')}.`,
        actionUrl:      '/worker/documents',
        entityId:       reminder.documentId,
      })

      // Admin notification when critical (≤30 days)
      if (reminder.daysRemaining <= 30) {
        void createNotification({
          recipient:  'admin',
          companyId,
          eventType:  'compliance_alert',
          title:      `Staff document expiring: ${reminder.staffName ?? 'unknown'}`,
          message:    `${reminder.documentType.replace(/_/g, ' ')} expires in ${reminder.daysRemaining} day${reminder.daysRemaining !== 1 ? 's' : ''}.`,
          actionUrl:  '/admin/documents/verification',
          entityId:   reminder.documentId,
        })
      }

      await recordReminderSent({
        documentId:     reminder.documentId,
        companyId,
        staffProfileId: reminder.staffProfileId,
        reminderBand:   reminder.reminderBand,
        expiryDate:     reminder.expiryDate,
        channel:        'in_app',
      })

      result.remindersScheduled++
    } catch (err) {
      console.error('[lifecycle-automation] reminder error:', err)
      result.errors++
    }
  }

  // ── 3. Readiness snapshot for each active staff member ────────────────────
  const { data: staffList } = await adminClient
    .from('staff_profiles')
    .select(`
      id, first_name, last_name, email, job_role, status, employment_type,
      date_of_birth, address_line_1, city, postcode,
      emergency_contact_name, emergency_contact_phone,
      ni_number, starter_declaration, employment_type,
      bank_account_number, bank_sort_code, bank_account_name,
      right_to_work_checked, dbs_checked, policy_acknowledged,
      non_compliant_since, applicant_id
    `)
    .eq('company_id', companyId)
    .in('status', ['active', 'pre_employment'])
    .limit(200)

  if (!staffList) return result

  result.staffProcessed = staffList.length

  for (const sp of staffList) {
    try {
      // Fetch documents for this staff member
      const conditions = [`staff_profile_id.eq.${sp.id}`]
      if (sp.applicant_id) conditions.push(`applicant_id.eq.${sp.applicant_id}`)

      const { data: docs } = await adminClient
        .from('documents')
        .select(`
          id, document_type, file_name, expiry_date, issue_date,
          training_category, reviewed_status, verification_status
        `)
        .eq('company_id', companyId)
        .is('archived_at', null)
        .or(conditions.join(','))

      const documents: ReadinessDocumentInput[] = (docs ?? []).map((d) => ({
        id:                  d.id,
        document_type:       d.document_type,
        expiry_date:         d.expiry_date,
        issue_date:          d.issue_date,
        training_category:   d.training_category,
        reviewed_status:     d.reviewed_status,
        verification_status: d.verification_status,
        file_name:           d.file_name,
      }))

      const staffInput: ReadinessStaffInput = {
        id:                  sp.id,
        status:              sp.status,
        job_role:            sp.job_role,
        employment_type:     sp.employment_type,
        date_of_birth:       sp.date_of_birth,
        address_line_1:      sp.address_line_1,
        city:                sp.city,
        postcode:            sp.postcode,
        emergency_contact_name:  sp.emergency_contact_name,
        emergency_contact_phone: sp.emergency_contact_phone,
        ni_number:           sp.ni_number,
        starter_declaration: sp.starter_declaration,
        bank_account_number: sp.bank_account_number,
        bank_sort_code:      sp.bank_sort_code,
        bank_account_name:   sp.bank_account_name,
        right_to_work_checked: sp.right_to_work_checked,
        dbs_checked:         sp.dbs_checked,
        policy_acknowledged: sp.policy_acknowledged,
        non_compliant_since: sp.non_compliant_since,
      }

      const readiness = calculateWorkerReadiness({
        staff:        staffInput,
        documents,
        availability: { hasAvailability: true, maxWeeklyHours: null, workAreas: [] },
      })

      // Fetch previous snapshot to detect stage transitions
      const { data: prevSnapshot } = await adminClient
        .from('worker_readiness_snapshots')
        .select('readiness_stage')
        .eq('staff_profile_id', sp.id)
        .maybeSingle()

      const prevStage = prevSnapshot?.readiness_stage ?? null

      // Upsert readiness snapshot
      await adminClient
        .from('worker_readiness_snapshots')
        .upsert({
          company_id:               companyId,
          staff_profile_id:         sp.id,
          readiness_stage:          readiness.stage,
          deployability_score:      readiness.deployabilityScore,
          onboarding_progress:      readiness.onboardingProgress,
          verification_progress:    readiness.verificationProgress,
          compliance_percentage:    readiness.compliancePercentage,
          pending_verification_count: readiness.pendingVerificationCount,
          rejected_count:           readiness.rejectedCount,
          critical_expiry_count:    readiness.criticalExpiryCount,
          is_deployable:            readiness.isDeployable,
          is_compliance_eligible:   readiness.isComplianceEligible,
          blockers:                 readiness.blockers,
          warnings:                 readiness.warnings,
          expiry_alerts:            readiness.expiryAlerts,
          assessed_at:              new Date().toISOString(),
        }, { onConflict: 'staff_profile_id' })

      // Log stage transitions
      if (prevStage && prevStage !== readiness.stage) {
        await adminClient
          .from('onboarding_lifecycle_log')
          .insert({
            company_id:      companyId,
            staff_profile_id: sp.id,
            from_stage:      prevStage,
            to_stage:        readiness.stage,
            triggered_by:    'cron',
          })
        result.stageTransitions++

        // Notify admin of blocking regressions
        if (readiness.stage === 'blocked' && prevStage !== 'blocked') {
          void createNotification({
            recipient:  'admin',
            companyId,
            eventType:  'compliance_alert',
            title:      `Staff member blocked from deployment`,
            message:    `${[sp.first_name, sp.last_name].filter(Boolean).join(' ')} is now blocked. ${readiness.blockers[0] ?? ''}`,
            actionUrl:  `/admin/staff/${sp.id}`,
            entityId:   sp.id,
          })
        }
      }

    } catch (err) {
      console.error(`[lifecycle-automation] staff ${sp.id} error:`, err)
      result.errors++
    }
  }

  return result
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: companies } = await adminClient
    .from('companies')
    .select('id, name')
    .limit(50)

  if (!companies) {
    return NextResponse.json({ error: 'No companies found' }, { status: 500 })
  }

  const results = []
  for (const company of companies) {
    try {
      const r = await runCompany(company.id)
      results.push({ companyId: company.id, companyName: company.name, ...r })
    } catch (err) {
      results.push({ companyId: company.id, error: String(err) })
    }
  }

  return NextResponse.json({
    ok:      true,
    ran_at:  new Date().toISOString(),
    results,
  })
}
