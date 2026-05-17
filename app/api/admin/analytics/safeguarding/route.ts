import { NextRequest, NextResponse } from 'next/server'
import { adminClient }  from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can }          from '@/lib/auth/permissions'
import { forbidden }    from '@/lib/auth/responses'
import { bucketByPeriod, type Period } from '@/lib/analytics/compute'

export interface SafeguardingAnalytics {
  summary: {
    total_incidents_90d:      number
    open_incidents:           number
    critical_open:            number
    escalation_rate_pct:      number
    avg_resolution_days:      number | null
    unresolved_beyond_sla:    number   // open for >5 days
  }
  type_breakdown:  { type: string; count: number; pct: number }[]
  severity_breakdown: { severity: string; count: number }[]
  trend:           { label: string; value: number; date: string }[]
  high_risk_clients: { id: string; name: string; incident_count: number; last_severity: string }[]
  high_risk_workers: { id: string; name: string; incident_count: number }[]
  escalation_trend:  { label: string; value: number; date: string }[]
  timestamp:         string
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'safeguarding:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const period = (req.nextUrl.searchParams.get('period') ?? '30d') as Period
  const daysMap: Record<Period, number> = { '7d': 7, '30d': 30, '90d': 90, '12m': 365 }
  const now   = new Date()
  const since = new Date(now.getTime() - daysMap[period] * 86400_000).toISOString()
  const ago90 = new Date(now.getTime() - 90 * 86400_000).toISOString()

  const { data: incidents } = await adminClient
    .from('incidents')
    .select('id, incident_type, severity, status, occurred_at, created_at, escalation_required, client_id, staff_profile_id, clients!client_id(first_name, last_name), staff_profiles!staff_profile_id(first_name, last_name)')
    .eq('company_id', companyId)
    .gte('occurred_at', ago90)
    .order('occurred_at', { ascending: false })

  const allInc = incidents ?? []
  const periodInc = allInc.filter(i => i.occurred_at >= since)

  // Open incidents
  const open    = allInc.filter(i => ['open','investigating'].includes(i.status as string))
  const critical = open.filter(i => i.severity === 'critical')

  // Escalation rate
  const withEscalation = periodInc.filter(i => i.escalation_required)
  const escalationRate = periodInc.length > 0
    ? Math.round((withEscalation.length / periodInc.length) * 100)
    : 0

  // Avg resolution (resolved incidents)
  const resolved = allInc.filter(i => i.status === 'resolved')
  let avgResolutionDays: number | null = null
  if (resolved.length > 0) {
    const totalDays = resolved.reduce((sum, i) => {
      return sum + (now.getTime() - new Date(i.occurred_at as string).getTime()) / 86400_000
    }, 0)
    avgResolutionDays = Math.round(totalDays / resolved.length)
  }

  // Unresolved beyond SLA (5 days)
  const slaCutoff = new Date(now.getTime() - 5 * 86400_000).toISOString()
  const beyondSLA = open.filter(i => (i.occurred_at as string) < slaCutoff).length

  // Type breakdown
  const typeCounts = new Map<string, number>()
  for (const i of periodInc) {
    const t = i.incident_type as string
    typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1)
  }
  const typeBreakdown = [...typeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count, pct: Math.round((count / (periodInc.length || 1)) * 100) }))

  // Severity breakdown
  const sevCounts = new Map<string, number>()
  for (const i of periodInc) {
    const s = i.severity as string
    sevCounts.set(s, (sevCounts.get(s) ?? 0) + 1)
  }
  const severityBreakdown = [...sevCounts.entries()].map(([severity, count]) => ({ severity, count }))

  // Trend
  const incTs  = periodInc.map(i => i.occurred_at as string)
  const escTs  = periodInc.filter(i => i.escalation_required).map(i => i.occurred_at as string)
  const trend  = bucketByPeriod(incTs, period)
  const escTrend = bucketByPeriod(escTs, period)

  // High-risk clients
  const clientCounts = new Map<string, { name: string; count: number; last_severity: string }>()
  for (const i of allInc) {
    if (!i.client_id) continue
    const clientId = i.client_id as string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cl = (i as any).clients
    const name = cl ? `${cl.first_name ?? ''} ${cl.last_name ?? ''}`.trim() : 'Unknown'
    const prev = clientCounts.get(clientId)
    clientCounts.set(clientId, {
      name,
      count: (prev?.count ?? 0) + 1,
      last_severity: i.severity as string,
    })
  }
  const highRiskClients = [...clientCounts.entries()]
    .filter(([, v]) => v.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([id, v]) => ({ id, name: v.name, incident_count: v.count, last_severity: v.last_severity }))

  // High-risk workers
  const workerCounts = new Map<string, { name: string; count: number }>()
  for (const i of allInc) {
    if (!i.staff_profile_id) continue
    const wid = i.staff_profile_id as string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sp = (i as any).staff_profiles
    const name = sp ? `${sp.first_name ?? ''} ${sp.last_name ?? ''}`.trim() : 'Unknown'
    workerCounts.set(wid, { name, count: (workerCounts.get(wid)?.count ?? 0) + 1 })
  }
  const highRiskWorkers = [...workerCounts.entries()]
    .filter(([, v]) => v.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([id, v]) => ({ id, name: v.name, incident_count: v.count }))

  return NextResponse.json({
    summary: {
      total_incidents_90d:   allInc.length,
      open_incidents:        open.length,
      critical_open:         critical.length,
      escalation_rate_pct:   escalationRate,
      avg_resolution_days:   avgResolutionDays,
      unresolved_beyond_sla: beyondSLA,
    },
    type_breakdown:    typeBreakdown,
    severity_breakdown: severityBreakdown,
    trend,
    high_risk_clients: highRiskClients,
    high_risk_workers: highRiskWorkers,
    escalation_trend:  escTrend,
    timestamp:         now.toISOString(),
  } satisfies SafeguardingAnalytics)
}
