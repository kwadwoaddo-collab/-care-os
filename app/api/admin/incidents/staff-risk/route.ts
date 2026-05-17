import { NextRequest, NextResponse } from 'next/server'
import { adminClient }               from '@/lib/supabase/admin'
import { requireAdmin }              from '@/lib/auth/requireAdmin'
import { can }                       from '@/lib/auth/permissions'
import { forbidden }                 from '@/lib/auth/responses'
import {
  buildStaffRiskProfile,
  type IncidentSummary,
} from '@/lib/incidents/riskEngine'

// ── GET /api/admin/incidents/staff-risk ───────────────────────────────────────
// Returns all staff who have incidents in the last 90 days, sorted by risk score.

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'incidents:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const staffId = request.nextUrl.searchParams.get('staff_profile_id')

  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  let q = adminClient
    .from('incidents')
    .select(`
      id, incident_type, severity, escalation_required, occurred_at,
      risk_score, risk_classification,
      staff_profile_id,
      staff_profiles!staff_profile_id ( id, first_name, last_name, email, job_role )
    `)
    .eq('company_id', companyId)
    .not('staff_profile_id', 'is', null)
    .gte('occurred_at', ninetyDaysAgo.toISOString())

  if (staffId) {
    q = q.eq('staff_profile_id', staffId)
  }

  const { data, error } = await q.order('occurred_at', { ascending: false })

  if (error) {
    console.error('[staff-risk] fetch error:', error.message)
    return NextResponse.json({ error: 'Failed to fetch incidents' }, { status: 500 })
  }

  const rows = (data ?? []) as unknown as Array<{
    id:                  string
    incident_type:       string
    severity:            string
    escalation_required: boolean
    occurred_at:         string | null
    risk_score:          number | null
    risk_classification: string | null
    staff_profile_id:    string
    staff_profiles:      { id: string; first_name: string | null; last_name: string | null; email: string | null; job_role: string | null }
  }>

  // Group by staff
  const staffMap = new Map<string, typeof rows[number]['staff_profiles']>()
  const incidentsByStaff = new Map<string, IncidentSummary[]>()

  for (const row of rows) {
    if (!staffMap.has(row.staff_profile_id)) {
      staffMap.set(row.staff_profile_id, row.staff_profiles)
    }
    const list = incidentsByStaff.get(row.staff_profile_id) ?? []
    list.push({
      id:                  row.id,
      incident_type:       row.incident_type,
      severity:            row.severity,
      escalation_required: row.escalation_required,
      occurred_at:         row.occurred_at,
      risk_score:          row.risk_score,
      risk_classification: row.risk_classification,
    })
    incidentsByStaff.set(row.staff_profile_id, list)
  }

  const profiles = []
  for (const [sid, sdata] of staffMap) {
    const incs = incidentsByStaff.get(sid) ?? []
    profiles.push(buildStaffRiskProfile({ ...sdata, id: sid }, incs))
  }

  profiles.sort((a, b) => b.risk_score - a.risk_score)

  return NextResponse.json({ data: profiles })
}
