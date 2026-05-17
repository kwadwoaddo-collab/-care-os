import { NextRequest, NextResponse } from 'next/server'
import { adminClient }               from '@/lib/supabase/admin'
import { requireAdmin }              from '@/lib/auth/requireAdmin'
import { can }                       from '@/lib/auth/permissions'
import { forbidden }                 from '@/lib/auth/responses'
import {
  buildClientRiskProfile,
  type IncidentSummary,
} from '@/lib/incidents/riskEngine'

// ── GET /api/admin/incidents/client-risk ──────────────────────────────────────
// Returns all clients who have incidents in the last 90 days, sorted by risk score.

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'incidents:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const clientId = request.nextUrl.searchParams.get('client_id')

  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  let q = adminClient
    .from('incidents')
    .select(`
      id, incident_type, severity, escalation_required, occurred_at,
      risk_score, risk_classification,
      client_id,
      clients!client_id ( id, first_name, last_name )
    `)
    .eq('company_id', companyId)
    .not('client_id', 'is', null)
    .gte('occurred_at', ninetyDaysAgo.toISOString())

  if (clientId) {
    q = q.eq('client_id', clientId)
  }

  const { data, error } = await q.order('occurred_at', { ascending: false })

  if (error) {
    console.error('[client-risk] fetch error:', error.message)
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
    client_id:           string
    clients:             { id: string; first_name: string; last_name: string }
  }>

  // Group by client
  const clientMap = new Map<string, typeof rows[number]['clients']>()
  const incidentsByClient = new Map<string, IncidentSummary[]>()

  for (const row of rows) {
    if (!clientMap.has(row.client_id)) {
      clientMap.set(row.client_id, row.clients)
    }
    const list = incidentsByClient.get(row.client_id) ?? []
    list.push({
      id:                  row.id,
      incident_type:       row.incident_type,
      severity:            row.severity,
      escalation_required: row.escalation_required,
      occurred_at:         row.occurred_at,
      risk_score:          row.risk_score,
      risk_classification: row.risk_classification,
    })
    incidentsByClient.set(row.client_id, list)
  }

  const profiles = []
  for (const [cid, cdata] of clientMap) {
    const incs = incidentsByClient.get(cid) ?? []
    profiles.push(buildClientRiskProfile({ ...cdata, id: cid }, incs))
  }

  profiles.sort((a, b) => b.risk_score - a.risk_score)

  return NextResponse.json({ data: profiles })
}
