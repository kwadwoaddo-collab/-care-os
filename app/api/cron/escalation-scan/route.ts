import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { adminClient }               from '@/lib/supabase/admin'
import { executeJob, isCronAuthorized } from '@/lib/jobs/executor'
import { createNotification }        from '@/lib/notifications/createNotification'
import type { JobResult }            from '@/lib/jobs/types'

/**
 * GET /api/cron/escalation-scan
 *
 * Reviews open incidents and compliance overrides daily at 10:00 UTC.
 * Flags unresolved escalations beyond 5-day SLA.
 * Sends reminders to registered managers for overdue items.
 *
 * Security: requires Authorization: Bearer {CRON_SECRET}
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await executeJob(
    { jobName: 'escalation_scan', triggeredBy: 'cron' },
    async () => {
      const { data: companies, error } = await adminClient
        .from('companies')
        .select('id, name')
        .order('created_at', { ascending: true })

      if (error) throw new Error(`Failed to fetch companies: ${error.message}`)

      let totalIncidents = 0, totalCompliance = 0, totalErrors = 0

      for (const company of companies ?? []) {
        const companyId = company.id as string
        try {
          const counts = await scanCompanyEscalations(companyId)
          totalIncidents  += counts.incidents
          totalCompliance += counts.compliance
          totalErrors     += counts.errors
        } catch (err) {
          totalErrors++
          console.error('[escalation-scan] company error', { companyId, error: String(err) })
        }
      }

      const jobResult: JobResult = {
        ok: totalErrors === 0,
        message: `Scanned ${companies?.length ?? 0} companies for SLA breaches`,
        data: {
          overdue_incidents:  totalIncidents,
          overdue_compliance: totalCompliance,
          errors:             totalErrors,
        },
      }

      return jobResult
    },
  )

  return NextResponse.json(result, { status: result.ok || result.skipped ? 200 : 500 })
}

async function scanCompanyEscalations(companyId: string): Promise<{
  incidents: number; compliance: number; errors: number
}> {
  let incidents = 0, compliance = 0, errors = 0
  const sla5days = new Date(Date.now() - 5 * 86400_000).toISOString()
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // ── 1. Overdue open incidents (>5 day SLA) ─────────────────────────────────
  try {
    const { data: openIncidents } = await adminClient
      .from('incidents')
      .select('id, title, severity, created_at, assigned_to')
      .eq('company_id', companyId)
      .in('status', ['open', 'under_review'])
      .lt('created_at', sla5days)
      .limit(50)

    for (const incident of openIncidents ?? []) {
      try {
        const daysOpen = Math.round((Date.now() - new Date(incident.created_at as string).getTime()) / 86400_000)

        // Check if we already sent an escalation reminder in the last 24h
        const since24h = new Date(Date.now() - 24 * 3600_000).toISOString()
        const { data: recentEscalation } = await adminClient
          .from('audit_logs')
          .select('id')
          .eq('company_id', companyId)
          .eq('action', 'incident.sla_escalation')
          .eq('entity_id', incident.id as string)
          .gte('created_at', since24h)
          .maybeSingle()

        if (recentEscalation) continue

        void createNotification({
          recipient:  'admin',
          companyId,
          eventType:  'compliance_alert',
          title:      `SLA Breach: Incident open ${daysOpen} days`,
          message:    `"${incident.title}" (${(incident.severity as string).replace(/_/g, ' ')}) has been open for ${daysOpen} days without resolution. Immediate action required.`,
          actionUrl:  `${appUrl}/admin/safeguarding/${incident.id}`,
          entityId:   `sla-${incident.id}`,
        })

        await adminClient.from('audit_logs').insert({
          company_id:  companyId,
          actor_id:    null,
          action:      'incident.sla_escalation',
          entity_type: 'incident',
          entity_id:   incident.id as string,
          metadata:    { days_open: daysOpen, severity: incident.severity },
        })

        incidents++
      } catch (err) {
        console.error('[escalation-scan] incident escalation error', { incidentId: incident.id, error: String(err) })
        errors++
      }
    }
  } catch (err) {
    console.error('[escalation-scan] incidents query error', { companyId, error: String(err) })
    errors++
  }

  // ── 2. Compliance overrides without review (>5 days) ─────────────────────
  try {
    const { data: overrides } = await adminClient
      .from('compliance_overrides')
      .select('id, staff_profile_id, check_type, reason, created_at, reviewed_at')
      .eq('company_id', companyId)
      .is('reviewed_at', null)
      .lt('created_at', sla5days)
      .limit(20)

    for (const override of overrides ?? []) {
      try {
        const daysUnreviewed = Math.round((Date.now() - new Date(override.created_at as string).getTime()) / 86400_000)

        const since24h = new Date(Date.now() - 24 * 3600_000).toISOString()
        const { data: recentReminder } = await adminClient
          .from('audit_logs')
          .select('id')
          .eq('company_id', companyId)
          .eq('action', 'compliance.override_reminder')
          .eq('entity_id', override.id as string)
          .gte('created_at', since24h)
          .maybeSingle()

        if (recentReminder) continue

        void createNotification({
          recipient:  'admin',
          companyId,
          eventType:  'compliance_alert',
          title:      `Unreviewed compliance override — ${daysUnreviewed} days`,
          message:    `A ${(override.check_type as string).replace(/_/g, ' ')} override has been pending review for ${daysUnreviewed} days.`,
          actionUrl:  `${appUrl}/admin/staff/${override.staff_profile_id}`,
          entityId:   `override-reminder-${override.id}`,
        })

        await adminClient.from('audit_logs').insert({
          company_id:  companyId,
          actor_id:    null,
          action:      'compliance.override_reminder',
          entity_type: 'compliance_override',
          entity_id:   override.id as string,
          metadata:    { days_unreviewed: daysUnreviewed, check_type: override.check_type },
        })

        compliance++
      } catch (err) {
        console.error('[escalation-scan] override reminder error', { overrideId: override.id, error: String(err) })
        errors++
      }
    }
  } catch (err) {
    // Table may not exist yet — non-fatal
    console.warn('[escalation-scan] compliance_overrides query error (may not exist)', { companyId, error: String(err) })
  }

  return { incidents, compliance, errors }
}
