import { NextResponse }    from 'next/server'
import { adminClient }     from '@/lib/supabase/admin'
import { requireAdmin }    from '@/lib/auth/requireAdmin'
import { can }             from '@/lib/auth/permissions'
import { forbidden }       from '@/lib/auth/responses'
import {
  buildStaffRiskProfile,
  buildClientRiskProfile,
  buildWeeklyTrend,
  detectPatternAlerts,
  type StaffRiskProfile,
  type ClientRiskProfile,
  type WeeklyTrendPoint,
  type PatternAlert,
  type IncidentSummary,
} from '@/lib/incidents/riskEngine'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface IntelligenceSummary {
  total_incidents:    number
  open_incidents:     number
  critical_incidents: number
  high_incidents:     number
  workers_flagged:    number
  clients_flagged:    number
  escalation_rate:    number
}

export interface TypeBreakdown {
  incident_type: string
  count:         number
  percentage:    number
}

export interface IntelligenceResponse {
  summary:               IntelligenceSummary
  weekly_trend:          WeeklyTrendPoint[]
  staff_risk_profiles:   StaffRiskProfile[]
  client_risk_profiles:  ClientRiskProfile[]
  type_breakdown:        TypeBreakdown[]
  pattern_alerts:        PatternAlert[]
  last_updated:          string
}

// ── GET /api/admin/incidents/intelligence ─────────────────────────────────────

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'incidents:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  // Fetch all incidents in the last 90 days with linked names
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const { data: rawIncidents, error: incErr } = await adminClient
    .from('incidents')
    .select(`
      id, incident_type, severity, status, escalation_required,
      immediate_action_taken, occurred_at, created_at,
      risk_score, risk_classification, risk_factors,
      client_id, staff_profile_id,
      clients!client_id       ( id, first_name, last_name ),
      staff_profiles!staff_profile_id ( id, first_name, last_name, email, job_role )
    `)
    .eq('company_id', companyId)
    .gte('occurred_at', ninetyDaysAgo.toISOString())
    .order('occurred_at', { ascending: false })

  if (incErr) {
    console.error('[intelligence] fetch error:', incErr.message)
    return NextResponse.json({ error: 'Failed to fetch incidents' }, { status: 500 })
  }

  const incidents = (rawIncidents ?? []) as unknown as Array<{
    id:                  string
    incident_type:       string
    severity:            string
    status:              string
    escalation_required: boolean
    immediate_action_taken: string | null
    occurred_at:         string | null
    created_at:          string
    risk_score:          number | null
    risk_classification: string | null
    risk_factors:        unknown
    client_id:           string | null
    staff_profile_id:    string | null
    clients:             { id: string; first_name: string; last_name: string } | null
    staff_profiles:      { id: string; first_name: string | null; last_name: string | null; email: string | null; job_role: string | null } | null
  }>

  // Map to IncidentSummary for risk engine
  const summaries: IncidentSummary[] = incidents.map((i) => ({
    id:                  i.id,
    incident_type:       i.incident_type,
    severity:            i.severity,
    escalation_required: i.escalation_required,
    occurred_at:         i.occurred_at,
    risk_score:          i.risk_score,
    risk_classification: i.risk_classification,
  }))

  // ── Summary stats ─────────────────────────────────────────────────────────
  const total = incidents.length
  const open  = incidents.filter((i) => i.status === 'open' || i.status === 'investigating').length
  const crits = incidents.filter((i) => i.severity === 'critical').length
  const highs = incidents.filter((i) => i.severity === 'high').length
  const escs  = incidents.filter((i) => i.escalation_required).length

  // ── Staff risk profiles ───────────────────────────────────────────────────
  const staffMap = new Map<string, typeof incidents[number]['staff_profiles'] & { id: string }>()
  const staffIncidents = new Map<string, IncidentSummary[]>()

  for (const inc of incidents) {
    if (!inc.staff_profile_id || !inc.staff_profiles) continue
    if (!staffMap.has(inc.staff_profile_id)) {
      staffMap.set(inc.staff_profile_id, inc.staff_profiles as { id: string; first_name: string | null; last_name: string | null; email: string | null; job_role: string | null })
    }
    const existing = staffIncidents.get(inc.staff_profile_id) ?? []
    existing.push(summaries.find((s) => s.id === inc.id)!)
    staffIncidents.set(inc.staff_profile_id, existing)
  }

  const staffProfiles: StaffRiskProfile[] = []
  for (const [staffId, staffData] of staffMap) {
    const incs = staffIncidents.get(staffId) ?? []
    if (incs.length === 0) continue
    staffProfiles.push(buildStaffRiskProfile(
      { ...staffData!, id: staffId },
      incs,
    ))
  }
  staffProfiles.sort((a, b) => b.risk_score - a.risk_score)
  const topStaff = staffProfiles.slice(0, 20)

  // ── Client risk profiles ──────────────────────────────────────────────────
  const clientMap = new Map<string, typeof incidents[number]['clients'] & { id: string }>()
  const clientIncidents = new Map<string, IncidentSummary[]>()

  for (const inc of incidents) {
    if (!inc.client_id || !inc.clients) continue
    if (!clientMap.has(inc.client_id)) {
      clientMap.set(inc.client_id, inc.clients as { id: string; first_name: string; last_name: string })
    }
    const existing = clientIncidents.get(inc.client_id) ?? []
    existing.push(summaries.find((s) => s.id === inc.id)!)
    clientIncidents.set(inc.client_id, existing)
  }

  const clientProfiles: ClientRiskProfile[] = []
  for (const [clientId, clientData] of clientMap) {
    const incs = clientIncidents.get(clientId) ?? []
    if (incs.length === 0) continue
    clientProfiles.push(buildClientRiskProfile(
      { ...clientData!, id: clientId },
      incs,
    ))
  }
  clientProfiles.sort((a, b) => b.risk_score - a.risk_score)
  const topClients = clientProfiles.slice(0, 20)

  // ── Type breakdown ────────────────────────────────────────────────────────
  const typeCounts: Record<string, number> = {}
  for (const i of incidents) {
    typeCounts[i.incident_type] = (typeCounts[i.incident_type] ?? 0) + 1
  }
  const typeBreakdown: TypeBreakdown[] = Object.entries(typeCounts)
    .map(([incident_type, count]) => ({
      incident_type,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)

  // ── Workers/clients flagged at high/critical ──────────────────────────────
  const workersFlagged = topStaff.filter(
    (s) => s.risk_level === 'high' || s.risk_level === 'critical',
  ).length
  const clientsFlagged = topClients.filter(
    (c) => c.risk_level === 'high' || c.risk_level === 'critical',
  ).length

  const response: IntelligenceResponse = {
    summary: {
      total_incidents:    total,
      open_incidents:     open,
      critical_incidents: crits,
      high_incidents:     highs,
      workers_flagged:    workersFlagged,
      clients_flagged:    clientsFlagged,
      escalation_rate:    total > 0 ? Math.round((escs / total) * 100) : 0,
    },
    weekly_trend:         buildWeeklyTrend(summaries, 8),
    staff_risk_profiles:  topStaff,
    client_risk_profiles: topClients,
    type_breakdown:       typeBreakdown,
    pattern_alerts:       detectPatternAlerts(summaries),
    last_updated:         new Date().toISOString(),
  }

  return NextResponse.json(response)
}
