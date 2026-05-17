import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { adminClient }               from '@/lib/supabase/admin'
import { executeJob, isCronAuthorized } from '@/lib/jobs/executor'
import { isSuppressed, recordSuppression, complianceSuppressKey, onboardingSuppressKey, shiftCoverageSuppressKey } from '@/lib/communications/suppress'
import { createNotification }        from '@/lib/notifications/createNotification'
import type { JobResult }            from '@/lib/jobs/types'

/**
 * GET /api/cron/comms-triggers
 *
 * Fires smart communication triggers for all companies daily at 09:00 UTC.
 * Handles: compliance expiry warnings, onboarding stalls, uncovered shifts,
 * safeguarding escalation notifications.
 *
 * Security: requires Authorization: Bearer {CRON_SECRET}
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await executeJob(
    { jobName: 'comms_triggers', triggeredBy: 'cron' },
    async () => {
      const { data: companies, error } = await adminClient
        .from('companies')
        .select('id, name')
        .order('created_at', { ascending: true })

      if (error) throw new Error(`Failed to fetch companies: ${error.message}`)

      let totalCompliance = 0, totalOnboarding = 0, totalShifts = 0, totalSafeguarding = 0, totalSkipped = 0

      for (const company of companies ?? []) {
        const companyId = company.id as string
        try {
          const counts = await runTriggersForCompany(companyId)
          totalCompliance    += counts.compliance
          totalOnboarding    += counts.onboarding
          totalShifts        += counts.shifts
          totalSafeguarding  += counts.safeguarding
          totalSkipped       += counts.skipped
        } catch (err) {
          console.error('[comms-triggers] company error', { companyId, error: String(err) })
        }
      }

      const jobResult: JobResult = {
        ok: true,
        message: `Triggered notifications across ${companies?.length ?? 0} companies`,
        data: {
          compliance_expiry:   totalCompliance,
          onboarding_stall:    totalOnboarding,
          uncovered_shifts:    totalShifts,
          safeguarding_alerts: totalSafeguarding,
          skipped:             totalSkipped,
        },
      }

      return jobResult
    },
  )

  return NextResponse.json(result, { status: result.ok || result.skipped ? 200 : 500 })
}

async function runTriggersForCompany(companyId: string): Promise<{
  compliance: number; onboarding: number; shifts: number; safeguarding: number; skipped: number
}> {
  let compliance = 0, onboarding = 0, shifts = 0, safeguarding = 0, skipped = 0

  const in30days = new Date(Date.now() + 30 * 86400_000).toISOString()
  const cutoff14 = new Date(Date.now() - 14 * 86400_000).toISOString()
  const cutoff5  = new Date(Date.now() -  5 * 86400_000).toISOString()
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // ── 1. Compliance expiries within 30 days ──────────────────────────────────
  const { data: expiring } = await adminClient
    .from('staff_compliance')
    .select('staff_profile_id, check_type, expires_at, staff_profiles!staff_profile_id(first_name, last_name, email)')
    .eq('company_id', companyId)
    .eq('status', 'complete')
    .not('expires_at', 'is', null)
    .lt('expires_at', in30days)
    .gt('expires_at', new Date().toISOString())
    .limit(50)

  for (const row of expiring ?? []) {
    const staffId   = row.staff_profile_id as string
    const checkType = row.check_type as string
    const key       = complianceSuppressKey(staffId, checkType)

    if (await isSuppressed(companyId, key)) { skipped++; continue }

    const staffInfo = row.staff_profiles as { first_name?: string; last_name?: string; email?: string } | null
    const name      = [staffInfo?.first_name, staffInfo?.last_name].filter(Boolean).join(' ') || 'Team Member'
    const expiresAt = new Date(row.expires_at as string)
    const daysLeft  = Math.ceil((expiresAt.getTime() - Date.now()) / 86400_000)

    try {
      void createNotification({
        recipient:  'admin',
        companyId,
        eventType:  'compliance_expiring',
        title:      `Action Required: ${checkType.replace(/_/g, ' ')} expiring in ${daysLeft} days`,
        message:    `${name}'s ${checkType.replace(/_/g, ' ')} expires in ${daysLeft} days. Ensure renewal to maintain compliance.`,
        actionUrl:  `${appUrl}/admin/staff/${staffId}`,
        entityId:   `expiry-${staffId}-${checkType}`,
      })
      await recordSuppression(companyId, key, `expiry-${staffId}-${checkType}`, 24)
      compliance++
    } catch (err) {
      console.error('[comms-triggers] compliance notification error', { staffId, error: String(err) })
    }
  }

  // ── 2. Onboarding stalls (pre_employment >14 days with no recent activity) ──
  const { data: stalled } = await adminClient
    .from('staff_profiles')
    .select('id, first_name, last_name, created_at')
    .eq('company_id', companyId)
    .eq('status', 'pre_employment')
    .lt('updated_at', cutoff14)
    .limit(20)

  for (const staff of stalled ?? []) {
    const staffId = staff.id as string
    const key     = onboardingSuppressKey(staffId)

    if (await isSuppressed(companyId, key)) { skipped++; continue }

    const name      = [staff.first_name, staff.last_name].filter(Boolean).join(' ') || 'New Starter'
    const daysSince = Math.round((Date.now() - new Date(staff.created_at as string).getTime()) / 86400_000)

    try {
      void createNotification({
        recipient:  'admin',
        companyId,
        eventType:  'onboarding_reminder',
        title:      `Onboarding Stalled: ${name}`,
        message:    `${name} has been in pre-employment status for ${daysSince} days with no recent activity.`,
        actionUrl:  `${appUrl}/admin/staff/${staffId}`,
        entityId:   `stall-${staffId}`,
      })
      await recordSuppression(companyId, key, `stall-${staffId}`, 48)
      onboarding++
    } catch (err) {
      console.error('[comms-triggers] onboarding stall error', { staffId, error: String(err) })
    }
  }

  // ── 3. Uncovered shifts within the next 7 days ─────────────────────────────
  const in7days = new Date(Date.now() + 7 * 86400_000).toISOString()
  const { data: uncovered } = await adminClient
    .from('shifts')
    .select('id, start_time')
    .eq('company_id', companyId)
    .is('assigned_staff_id', null)
    .gt('start_time', new Date().toISOString())
    .lt('start_time', in7days)
    .limit(10)

  if ((uncovered?.length ?? 0) > 0) {
    const key = shiftCoverageSuppressKey(`${companyId}-upcoming`)
    if (!(await isSuppressed(companyId, key))) {
      try {
        void createNotification({
          recipient:  'admin',
          companyId,
          eventType:  'shift_assigned',
          title:      `${uncovered!.length} Uncovered Shift${uncovered!.length > 1 ? 's' : ''} This Week`,
          message:    `${uncovered!.length} shifts in the next 7 days have no assigned staff. Review and assign cover.`,
          actionUrl:  `${appUrl}/admin/shifts`,
          entityId:   `coverage-${companyId}-${new Date().toISOString().slice(0, 10)}`,
        })
        await recordSuppression(companyId, key, `coverage-${companyId}`, 12)
        shifts++
      } catch (err) {
        console.error('[comms-triggers] shift coverage error', { companyId, error: String(err) })
      }
    } else {
      skipped++
    }
  }

  // ── 4. Safeguarding escalations (open incidents >5 days) ──────────────────
  const { data: openIncidents } = await adminClient
    .from('incidents')
    .select('id, title, severity, created_at')
    .eq('company_id', companyId)
    .in('status', ['open', 'under_review'])
    .lt('created_at', cutoff5)
    .limit(10)

  for (const incident of openIncidents ?? []) {
    const incidentId = incident.id as string
    const key        = `safeguarding:${incidentId}`

    if (await isSuppressed(companyId, key)) { skipped++; continue }

    const daysOpen = Math.round((Date.now() - new Date(incident.created_at as string).getTime()) / 86400_000)

    try {
      void createNotification({
        recipient:  'admin',
        companyId,
        eventType:  'compliance_alert',
        title:      `Unresolved Incident — ${daysOpen} Days Open`,
        message:    `Incident "${incident.title}" has been open for ${daysOpen} days without resolution.`,
        actionUrl:  `${appUrl}/admin/safeguarding/${incidentId}`,
        entityId:   `safeguarding-${incidentId}`,
      })
      await recordSuppression(companyId, key, `safeguarding-${incidentId}`, 24)
      safeguarding++
    } catch (err) {
      console.error('[comms-triggers] safeguarding error', { incidentId, error: String(err) })
    }
  }

  return { compliance, onboarding, shifts, safeguarding, skipped }
}
