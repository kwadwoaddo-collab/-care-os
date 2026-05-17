import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/auth/permissions'
import { forbidden } from '@/lib/auth/responses'

// GET — list visit anomalies
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'shifts:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const sp       = req.nextUrl.searchParams
  const resolved = sp.get('resolved') === 'true'
  const severity = sp.get('severity') ?? ''
  const limit    = Math.min(parseInt(sp.get('limit') ?? '50'), 200)

  let q = adminClient
    .from('visit_anomalies')
    .select('*')
    .eq('company_id', companyId)
    .eq('resolved', resolved)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (severity) q = q.eq('severity', severity)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ anomalies: data ?? [] })
}

// POST — run anomaly detection scan for today
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'shifts:read')) return forbidden('Insufficient permissions')
  const { companyId, userId } = auth.ctx

  const body = await req.json().catch(() => ({})) as { dry_run?: boolean }
  const dry  = body.dry_run === true
  const today = new Date().toISOString().slice(0, 10)
  const results = { late_arrival: 0, short_visit: 0, medication: 0, no_show: 0, errors: [] as string[] }

  // ── 1. Late arrivals (>15 min) ─────────────────────────────────────────────
  try {
    const { data: lateTss } = await adminClient
      .from('timesheets')
      .select('shift_id, lateness_minutes, clock_in')
      .eq('company_id', companyId)
      .gte('lateness_minutes', 15)
      .gte('clock_in', `${today}T00:00:00`)

    for (const ts of lateTss ?? []) {
      if (dry) { results.late_arrival++; continue }
      const key = `late_arrival:${ts.shift_id}`
      const { count } = await adminClient.from('visit_anomalies').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('anomaly_type', 'late_arrival').eq('shift_id', ts.shift_id as string)
      if ((count ?? 0) > 0) continue
      await adminClient.from('visit_anomalies').insert({
        company_id: companyId, shift_id: ts.shift_id,
        anomaly_type: 'late_arrival',
        severity: (ts.lateness_minutes as number) >= 30 ? 'critical' : 'warning',
        description: `Worker arrived ${ts.lateness_minutes} minutes late`,
        auto_detected: true,
        detection_data: { lateness_minutes: ts.lateness_minutes, clock_in: ts.clock_in },
      })
      results.late_arrival++
      void key
    }
  } catch (e) { results.errors.push(`late_arrival: ${String(e)}`) }

  // ── 2. Short visits (worked < 80% of scheduled) ───────────────────────────
  try {
    const { data: shortTss } = await adminClient
      .from('timesheets')
      .select('shift_id, clock_in, clock_out, worked_minutes, scheduled_start')
      .eq('company_id', companyId)
      .eq('status', 'completed')
      .not('worked_minutes', 'is', null)
      .gte('clock_out', `${today}T00:00:00`)

    for (const ts of shortTss ?? []) {
      // Fetch scheduled duration from shift
      const { data: shift } = await adminClient.from('shifts').select('start_time, end_time, shift_date').eq('id', ts.shift_id as string).maybeSingle()
      if (!shift) continue
      const sStart = new Date(`${shift.shift_date}T${shift.start_time}`)
      const sEnd   = new Date(`${shift.shift_date}T${shift.end_time}`)
      const scheduledMinutes = (sEnd.getTime() - sStart.getTime()) / 60_000
      if (scheduledMinutes <= 0) continue
      const ratio = (ts.worked_minutes as number) / scheduledMinutes
      if (ratio >= 0.8) continue

      if (dry) { results.short_visit++; continue }
      const { count } = await adminClient.from('visit_anomalies').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('anomaly_type', 'short_visit').eq('shift_id', ts.shift_id as string)
      if ((count ?? 0) > 0) continue
      await adminClient.from('visit_anomalies').insert({
        company_id: companyId, shift_id: ts.shift_id,
        anomaly_type: 'short_visit',
        severity: ratio < 0.5 ? 'critical' : 'warning',
        description: `Visit was ${Math.round(ratio * 100)}% of scheduled duration (${ts.worked_minutes} of ${Math.round(scheduledMinutes)} min)`,
        auto_detected: true,
        detection_data: { worked_minutes: ts.worked_minutes, scheduled_minutes: scheduledMinutes, ratio },
      })
      results.short_visit++
    }
  } catch (e) { results.errors.push(`short_visit: ${String(e)}`) }

  // ── 3. Medication anomalies ───────────────────────────────────────────────
  try {
    const { data: medIssues } = await adminClient
      .from('visit_medication_records')
      .select('shift_id, medication_name, action, visit_note_id')
      .eq('company_id', companyId)
      .in('action', ['refused', 'missed', 'unavailable'])
      .eq('requires_escalation', true)
      .eq('escalated', false)
      .gte('created_at', `${today}T00:00:00`)

    for (const med of medIssues ?? []) {
      if (dry) { results.medication++; continue }
      const { count } = await adminClient.from('visit_anomalies').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('anomaly_type', 'medication_anomaly').eq('shift_id', med.shift_id as string)
      if ((count ?? 0) > 0) continue
      await adminClient.from('visit_anomalies').insert({
        company_id: companyId, shift_id: med.shift_id, visit_note_id: med.visit_note_id,
        anomaly_type: 'medication_anomaly',
        severity: 'critical',
        description: `Medication '${med.medication_name}' was ${med.action} — escalation required`,
        auto_detected: true,
        detection_data: { medication_name: med.medication_name, action: med.action },
      })
      results.medication++
    }
  } catch (e) { results.errors.push(`medication: ${String(e)}`) }

  // ── 4. No-shows (past due, no clock-in, not cancelled) ────────────────────
  try {
    const cutoff = new Date(Date.now() - 30 * 60_000).toISOString()
    const { data: noShows } = await adminClient
      .from('shifts')
      .select('id, shift_date, start_time')
      .eq('company_id', companyId)
      .in('status', ['accepted', 'in_progress', 'open'])
      .eq('shift_date', today)

    for (const shift of noShows ?? []) {
      const expectedStart = new Date(`${shift.shift_date}T${shift.start_time}`)
      if (expectedStart > new Date(cutoff)) continue
      const { data: ts } = await adminClient.from('timesheets').select('id').eq('shift_id', shift.id as string).maybeSingle()
      if (ts) continue
      if (dry) { results.no_show++; continue }
      const { count } = await adminClient.from('visit_anomalies').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('anomaly_type', 'no_show').eq('shift_id', shift.id as string)
      if ((count ?? 0) > 0) continue
      await adminClient.from('visit_anomalies').insert({
        company_id: companyId, shift_id: shift.id,
        anomaly_type: 'no_show',
        severity: 'critical',
        description: `No clock-in recorded — shift started ${Math.round((Date.now() - expectedStart.getTime()) / 60_000)} minutes ago`,
        auto_detected: true,
        detection_data: { shift_date: shift.shift_date, start_time: shift.start_time },
      })
      results.no_show++
    }
  } catch (e) { results.errors.push(`no_show: ${String(e)}`) }

  // Audit
  void (async () => {
    try {
      await adminClient.from('audit_logs').insert({ company_id: companyId, actor_id: userId, action: 'visit_anomalies.scan', entity_type: 'visit', metadata: { dry_run: dry, ...results } })
    } catch { /* non-blocking */ }
  })()

  return NextResponse.json({ ok: true, dry_run: dry, ...results })
}

// PATCH — resolve an anomaly
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'shifts:read')) return forbidden('Insufficient permissions')
  const { companyId, userId } = auth.ctx

  const body = await req.json() as { id: string; resolution_notes?: string }
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await adminClient
    .from('visit_anomalies')
    .update({ resolved: true, resolved_at: new Date().toISOString(), resolved_by: userId, resolution_notes: body.resolution_notes ?? null })
    .eq('id', body.id)
    .eq('company_id', companyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
