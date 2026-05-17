import { NextRequest, NextResponse } from 'next/server'
import { adminClient }               from '@/lib/supabase/admin'
import { buildComplianceSnapshot }   from '@/lib/compliance/buildComplianceSnapshot'
import { getExpiryBand }             from '@/lib/compliance/expiryBands'
import { getEscalationLevel, daysNonCompliant, shouldEscalate, type EscalationLevel } from '@/lib/compliance/escalation'
import { staffRiskScore, staffRiskLevel }  from '@/lib/compliance/riskScore'
import { createNotification }        from '@/lib/notifications/createNotification'
import type { ComplianceDocument }   from '@/lib/compliance/calculateCompliance'

// ── Security guard ────────────────────────────────────────────────────────────

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface SweepStaffResult {
  staffId:         string
  staffName:       string
  complianceState: string
  percentage:      number
  escalationLevel: string
  notificationsCreated: number
  escalated:       boolean
}

interface SweepCompanyResult {
  companyId:   string
  companyName: string
  staffCount:  number
  processed:   number
  escalated:   number
  notified:    number
  errors:      number
}

// ── Per-company sweep ─────────────────────────────────────────────────────────

async function sweepCompany(companyId: string, companyName: string): Promise<SweepCompanyResult> {
  const result: SweepCompanyResult = {
    companyId, companyName, staffCount: 0, processed: 0, escalated: 0, notified: 0, errors: 0,
  }

  // Fetch active + pre-employment staff
  const { data: staff, error: staffErr } = await adminClient
    .from('staff_profiles')
    .select('id, first_name, last_name, email, job_role, status, applicant_id, non_compliant_since')
    .eq('company_id', companyId)
    .in('status', ['active', 'pre_employment'])

  if (staffErr || !staff) {
    console.error('[compliance-sweep] staff error:', staffErr?.message)
    result.errors++
    return result
  }

  result.staffCount = staff.length
  if (staff.length === 0) return result

  const staffIds     = staff.map((s) => s.id)
  const applicantIds = staff.map((s) => s.applicant_id).filter((id): id is string => id !== null)

  // Batch-fetch documents
  const [sDocs, aDocs] = await Promise.all([
    adminClient
      .from('documents')
      .select('id, document_type, file_name, expiry_date, training_category, reviewed_status, issue_date, staff_profile_id')
      .in('staff_profile_id', staffIds),
    applicantIds.length > 0
      ? adminClient
          .from('documents')
          .select('id, document_type, file_name, expiry_date, training_category, reviewed_status, issue_date, applicant_id')
          .in('applicant_id', applicantIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  const docsByStaff: Record<string, ComplianceDocument[]> = {}
  for (const d of (sDocs.data ?? []) as Array<ComplianceDocument & { staff_profile_id: string }>) {
    if (!docsByStaff[d.staff_profile_id]) docsByStaff[d.staff_profile_id] = []
    docsByStaff[d.staff_profile_id].push(d)
  }
  const docsByApplicant: Record<string, ComplianceDocument[]> = {}
  for (const d of (aDocs.data ?? []) as Array<ComplianceDocument & { applicant_id: string }>) {
    if (!docsByApplicant[d.applicant_id]) docsByApplicant[d.applicant_id] = []
    docsByApplicant[d.applicant_id].push(d)
  }

  // Fetch existing escalation state per staff (last escalation level sent)
  const { data: escalationRows } = await adminClient
    .from('audit_logs')
    .select('entity_id, metadata, created_at')
    .eq('company_id', companyId)
    .eq('action', 'compliance.escalation')
    .in('entity_id', staffIds)
    .order('created_at', { ascending: false })

  // Build map: staffId -> last escalation level
  const lastEscalation: Record<string, string> = {}
  for (const row of escalationRows ?? []) {
    const sid = row.entity_id as string
    if (!lastEscalation[sid]) {
      lastEscalation[sid] = (row.metadata as { level?: string })?.level ?? 'none'
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  for (const s of staff) {
    try {
      const staffName = [s.first_name, s.last_name].filter(Boolean).join(' ') || s.email || 'Unknown'

      // Merge documents
      const seen = new Set<string>()
      const docs: ComplianceDocument[] = []
      for (const d of docsByStaff[s.id] ?? []) {
        if (!seen.has(d.id)) { seen.add(d.id); docs.push(d) }
      }
      if (s.applicant_id) {
        for (const d of docsByApplicant[s.applicant_id] ?? []) {
          if (!seen.has(d.id)) { seen.add(d.id); docs.push(d) }
        }
      }

      const snap = buildComplianceSnapshot(docs, (s as { job_role?: string | null }).job_role ?? null)
      const { state, percentage, missingDocuments, missingTraining, expiredDocuments, expiredTraining } = snap

      let staffNotifications = 0

      // ── Notify worker of critical expiries ─────────────────────────────────
      const criticalExpiring = docs.filter((d) => {
        if (!d.expiry_date) return false
        return getExpiryBand(d.expiry_date) === 'critical'
      })

      if (criticalExpiring.length > 0) {
        const docLabels = criticalExpiring.map((d) => d.training_category ?? d.document_type).join(', ')
        void createNotification({
          recipient:      'worker',
          staffProfileId: s.id,
          companyId,
          eventType:      'compliance_expiring',
          title:          `Urgent: ${criticalExpiring.length} credential${criticalExpiring.length === 1 ? '' : 's'} expiring in ≤7 days`,
          message:        docLabels,
          actionUrl:      `${appUrl}/worker/documents`,
          entityId:       `sweep-critical-${s.id}`,
        })
        staffNotifications++
      }

      // ── Notify worker of newly expired items ────────────────────────────────
      const recentlyExpired = [...expiredDocuments, ...expiredTraining]
      if (recentlyExpired.length > 0) {
        void createNotification({
          recipient:      'worker',
          staffProfileId: s.id,
          companyId,
          eventType:      'compliance_expiring',
          title:          `Action required: ${recentlyExpired.length} compliance item${recentlyExpired.length === 1 ? '' : 's'} have expired`,
          message:        recentlyExpired.map((t) => t.replace(/_/g, ' ')).join(', '),
          actionUrl:      `${appUrl}/worker/documents`,
          entityId:       `sweep-expired-${s.id}`,
        })
        staffNotifications++
      }

      result.notified += staffNotifications > 0 ? 1 : 0
      result.processed++

      // ── Escalation logic ───────────────────────────────────────────────────
      if (state === 'non_compliant' || state === 'blocked') {
        const nonCompliantSince = (s as { non_compliant_since?: string | null }).non_compliant_since ?? null
        const days = daysNonCompliant(nonCompliantSince)
        const escalationLevel = getEscalationLevel(days)
        const lastLevel = (lastEscalation[s.id] ?? 'none') as EscalationLevel

        if (escalationLevel !== 'none' && shouldEscalate(escalationLevel, lastLevel)) {
          // Notify admins about escalation
          void createNotification({
            recipient:  'admin',
            companyId,
            eventType:  'compliance_alert',
            title:      `Compliance escalation: ${staffName}`,
            message:    `${escalationLevel.replace(/_/g, ' ')} after ${days} days. Missing: ${[...missingDocuments, ...missingTraining].join(', ') || 'see profile'}.`,
            actionUrl:  `${appUrl}/admin/staff/${s.id}`,
            entityId:   `escalation-${s.id}`,
          })

          // Log escalation to audit
          await adminClient.from('audit_logs').insert({
            company_id:  companyId,
            actor_id:    null,
            action:      'compliance.escalation',
            entity_type: 'staff_profile',
            entity_id:   s.id,
            metadata: {
              level:            escalationLevel,
              days_non_compliant: days,
              missing_docs:     missingDocuments,
              missing_training: missingTraining,
              compliance_state: state,
              percentage,
            },
          })

          result.escalated++
        }
      }

      // ── Cache risk score and compliance state ──────────────────────────────
      const expiringSoonItems = docs
        .filter((d) => d.expiry_date)
        .map((d) => ({ type: d.document_type, expiryDate: d.expiry_date!, band: getExpiryBand(d.expiry_date!) }))
        .filter((e) => e.band !== 'ok')

      const rScore = staffRiskScore(state, missingDocuments, missingTraining, expiringSoonItems)

      // ── Update non_compliant_since timestamp and cached state ──────────────
      const isNonCompliant = state === 'non_compliant' || state === 'blocked'
      const currentSince   = (s as { non_compliant_since?: string | null }).non_compliant_since

      const profileUpdate: Record<string, unknown> = {
        compliance_state:      state,
        compliance_risk_score: rScore,
        last_sweep_at:         new Date().toISOString(),
      }

      if (isNonCompliant && !currentSince) {
        profileUpdate.non_compliant_since = new Date().toISOString()
      } else if (!isNonCompliant && currentSince) {
        profileUpdate.non_compliant_since = null
      }

      await adminClient.from('staff_profiles').update(profileUpdate).eq('id', s.id)

      // Log the sweep result
      await adminClient.from('audit_logs').insert({
        company_id:  companyId,
        actor_id:    null,
        action:      'compliance.sweep_result',
        entity_type: 'staff_profile',
        entity_id:   s.id,
        metadata: {
          compliance_state: state,
          percentage,
          missing_docs:     missingDocuments,
          missing_training: missingTraining,
          expired_docs:     expiredDocuments,
        },
      })

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[compliance-sweep] error processing staff', s.id, msg)
      result.errors++
    }
  }

  return result
}

// ── Handler ───────────────────────────────────────────────────────────────────

/**
 * GET /api/cron/compliance-sweep
 *
 * Vercel Cron endpoint — runs once daily at 06:00 UTC (before the digest at 07:00).
 *
 * For every company and staff member:
 *   1. Recalculates compliance state
 *   2. Sends in-app notifications for critical expiries and newly expired items
 *   3. Triggers escalation notifications (worker → coordinator → manager)
 *   4. Logs sweep results and escalations to audit_logs
 *   5. Updates non_compliant_since timestamp on staff_profiles
 *
 * Security: requires Authorization: Bearer {CRON_SECRET}
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = new Date().toISOString()

  const { data: companies, error: companiesError } = await adminClient
    .from('companies')
    .select('id, name')
    .order('created_at', { ascending: true })

  if (companiesError) {
    console.error('[compliance-sweep] failed to fetch companies:', companiesError.message)
    return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 })
  }

  if (!companies || companies.length === 0) {
    return NextResponse.json({ processed: 0, results: [], startedAt })
  }

  const results: SweepCompanyResult[] = []
  let totalEscalated = 0
  let totalNotified  = 0
  let totalErrors    = 0

  for (const company of companies) {
    try {
      const result = await sweepCompany(company.id as string, (company.name as string) ?? 'Unknown')
      results.push(result)
      totalEscalated += result.escalated
      totalNotified  += result.notified
      totalErrors    += result.errors
      console.info('[compliance-sweep] company processed', result)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[compliance-sweep] company error', { companyId: company.id, error: message })
      results.push({
        companyId:   company.id as string,
        companyName: (company.name as string) ?? 'Unknown',
        staffCount: 0, processed: 0, escalated: 0, notified: 0, errors: 1,
      })
    }
  }

  console.info('[compliance-sweep] complete', {
    companies: results.length,
    totalEscalated,
    totalNotified,
    totalErrors,
    startedAt,
  })

  return NextResponse.json({
    startedAt,
    companies: results.length,
    totalEscalated,
    totalNotified,
    totalErrors,
    results,
  })
}
