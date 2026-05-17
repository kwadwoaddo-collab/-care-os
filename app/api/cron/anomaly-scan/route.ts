import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { adminClient }               from '@/lib/supabase/admin'
import { executeJob, isCronAuthorized } from '@/lib/jobs/executor'
import type { JobResult } from '@/lib/jobs/types'

/**
 * GET /api/cron/anomaly-scan
 *
 * Scans all companies for visit anomalies daily at 08:00 UTC.
 * Detects: late arrivals (≥15 min), short visits (<80%), no-shows (>30 min past start),
 * medication-without-record escalations.
 *
 * Security: requires Authorization: Bearer {CRON_SECRET}
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await executeJob(
    { jobName: 'anomaly_scan', triggeredBy: 'cron' },
    async () => {
      const { data: companies, error: companiesError } = await adminClient
        .from('companies')
        .select('id, name')
        .order('created_at', { ascending: true })

      if (companiesError) throw new Error(`Failed to fetch companies: ${companiesError.message}`)

      const today = new Date().toISOString().slice(0, 10)
      let totalLate = 0, totalShort = 0, totalNoShow = 0, totalMed = 0, totalErrors = 0

      for (const company of companies ?? []) {
        const companyId = company.id as string
        try {
          await scanCompanyAnomalies(companyId, today, (counts) => {
            totalLate    += counts.late
            totalShort   += counts.short
            totalNoShow  += counts.noShow
            totalMed     += counts.med
            totalErrors  += counts.errors
          })
        } catch (err) {
          totalErrors++
          console.error('[anomaly-scan] company error', { companyId, error: String(err) })
        }
      }

      const jobResult: JobResult = {
        ok: totalErrors === 0,
        message: `Scanned ${companies?.length ?? 0} companies for ${today}`,
        data: {
          late_arrival: totalLate,
          short_visit:  totalShort,
          no_show:      totalNoShow,
          medication:   totalMed,
          errors:       totalErrors,
          date:         today,
        },
      }

      return jobResult
    },
  )

  return NextResponse.json(result, { status: result.ok || result.skipped ? 200 : 500 })
}

async function scanCompanyAnomalies(
  companyId: string,
  today: string,
  onCounts: (c: { late: number; short: number; noShow: number; med: number; errors: number }) => void,
): Promise<void> {
  let late = 0, short = 0, noShow = 0, med = 0, errors = 0

  // ── Late arrivals (check-in ≥ 15 min after scheduled start) ─────────────────
  try {
    const { data: lateTss } = await adminClient
      .from('timesheets')
      .select('id, shift_id, staff_profile_id, check_in_time, shifts!shift_id(start_time, care_recipient_id)')
      .eq('company_id', companyId)
      .gte('check_in_time', `${today}T00:00:00`)
      .lt('check_in_time', `${today}T23:59:59`)
      .not('check_in_time', 'is', null)
      .limit(200)

    for (const ts of lateTss ?? []) {
      try {
        const shift = (ts.shifts as { start_time?: string; care_recipient_id?: string } | null)
        if (!shift?.start_time) continue
        const scheduledMs = new Date(shift.start_time).getTime()
        const actualMs    = new Date(ts.check_in_time as string).getTime()
        const lateMinutes = Math.round((actualMs - scheduledMs) / 60_000)
        if (lateMinutes < 15) continue

        await upsertAnomaly(companyId, {
          anomaly_type:    'late_arrival',
          severity:        lateMinutes >= 45 ? 'high' : 'medium',
          shift_id:        ts.shift_id as string,
          staff_id:        ts.staff_profile_id as string,
          care_recipient_id: shift.care_recipient_id ?? null,
          description:     `Worker arrived ${lateMinutes} minutes late`,
          metadata:        { late_minutes: lateMinutes, scheduled_start: shift.start_time },
        })
        late++
      } catch { errors++ }
    }
  } catch (err) {
    console.error('[anomaly-scan] late arrivals error', { companyId, error: String(err) })
    errors++
  }

  // ── Short visits (<80% of scheduled duration) ─────────────────────────────
  try {
    const { data: completed } = await adminClient
      .from('timesheets')
      .select('id, shift_id, staff_profile_id, check_in_time, check_out_time, shifts!shift_id(start_time, end_time, care_recipient_id)')
      .eq('company_id', companyId)
      .gte('check_in_time', `${today}T00:00:00`)
      .lt('check_in_time', `${today}T23:59:59`)
      .not('check_out_time', 'is', null)
      .limit(200)

    for (const ts of completed ?? []) {
      try {
        const shift = (ts.shifts as { start_time?: string; end_time?: string; care_recipient_id?: string } | null)
        if (!shift?.start_time || !shift?.end_time) continue
        const scheduledDuration = new Date(shift.end_time).getTime() - new Date(shift.start_time).getTime()
        const actualDuration    = new Date(ts.check_out_time as string).getTime() - new Date(ts.check_in_time as string).getTime()
        const pct = scheduledDuration > 0 ? (actualDuration / scheduledDuration) * 100 : 100
        if (pct >= 80) continue

        await upsertAnomaly(companyId, {
          anomaly_type:    'short_visit',
          severity:        pct < 50 ? 'high' : 'medium',
          shift_id:        ts.shift_id as string,
          staff_id:        ts.staff_profile_id as string,
          care_recipient_id: shift.care_recipient_id ?? null,
          description:     `Visit was ${Math.round(pct)}% of scheduled duration`,
          metadata:        { actual_pct: Math.round(pct), scheduled_ms: scheduledDuration, actual_ms: actualDuration },
        })
        short++
      } catch { errors++ }
    }
  } catch (err) {
    console.error('[anomaly-scan] short visits error', { companyId, error: String(err) })
    errors++
  }

  // ── No-shows (shift start >30 min ago, no check-in) ───────────────────────
  try {
    const cutoff = new Date(Date.now() - 30 * 60_000).toISOString()
    const { data: noShows } = await adminClient
      .from('shifts')
      .select('id, start_time, assigned_staff_id, care_recipient_id')
      .eq('company_id', companyId)
      .gte('start_time', `${today}T00:00:00`)
      .lt('start_time', cutoff)
      .not('assigned_staff_id', 'is', null)
      .limit(100)

    for (const shift of noShows ?? []) {
      try {
        // Check if a timesheet exists for this shift
        const { data: ts } = await adminClient
          .from('timesheets')
          .select('id')
          .eq('shift_id', shift.id as string)
          .maybeSingle()

        if (ts) continue  // has a check-in, not a no-show

        await upsertAnomaly(companyId, {
          anomaly_type:    'no_show',
          severity:        'high',
          shift_id:        shift.id as string,
          staff_id:        shift.assigned_staff_id as string,
          care_recipient_id: shift.care_recipient_id as string | null ?? null,
          description:     'No check-in detected 30+ minutes after scheduled start',
          metadata:        { scheduled_start: shift.start_time },
        })
        noShow++
      } catch { errors++ }
    }
  } catch (err) {
    console.error('[anomaly-scan] no-shows error', { companyId, error: String(err) })
    errors++
  }

  // ── Medication records without visit notes ────────────────────────────────
  try {
    const { data: medRecs } = await adminClient
      .from('visit_medication_records')
      .select('id, shift_id, staff_id, administered_at, outcome')
      .eq('company_id', companyId)
      .eq('outcome', 'refused')
      .gte('administered_at', `${today}T00:00:00`)
      .lt('administered_at', `${today}T23:59:59`)
      .limit(50)

    for (const rec of medRecs ?? []) {
      try {
        await upsertAnomaly(companyId, {
          anomaly_type:    'medication_concern',
          severity:        'high',
          shift_id:        rec.shift_id as string,
          staff_id:        rec.staff_id as string,
          care_recipient_id: null,
          description:     'Medication refused — escalation required',
          metadata:        { medication_record_id: rec.id, administered_at: rec.administered_at },
        })
        med++
      } catch { errors++ }
    }
  } catch (err) {
    console.error('[anomaly-scan] medication error', { companyId, error: String(err) })
    errors++
  }

  onCounts({ late, short, noShow, med, errors })
}

async function upsertAnomaly(
  companyId: string,
  anomaly: {
    anomaly_type:     string
    severity:         string
    shift_id:         string
    staff_id:         string
    care_recipient_id: string | null
    description:      string
    metadata:         Record<string, unknown>
  },
): Promise<void> {
  // Use shift_id + anomaly_type as idempotency key — don't re-create for same shift
  const { data: existing } = await adminClient
    .from('visit_anomalies')
    .select('id')
    .eq('company_id', companyId)
    .eq('shift_id', anomaly.shift_id)
    .eq('anomaly_type', anomaly.anomaly_type)
    .eq('resolved', false)
    .maybeSingle()

  if (existing) return  // already recorded

  await adminClient.from('visit_anomalies').insert({
    company_id:       companyId,
    shift_id:         anomaly.shift_id,
    staff_id:         anomaly.staff_id,
    care_recipient_id: anomaly.care_recipient_id,
    anomaly_type:     anomaly.anomaly_type,
    severity:         anomaly.severity,
    description:      anomaly.description,
    metadata:         anomaly.metadata,
    resolved:         false,
  })
}
