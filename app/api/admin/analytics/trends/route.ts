import { NextRequest, NextResponse } from 'next/server'
import { adminClient }  from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can }          from '@/lib/auth/permissions'
import { forbidden }    from '@/lib/auth/responses'
import { bucketByPeriod, type Period, type TrendPoint } from '@/lib/analytics/compute'

export interface TrendsResponse {
  period:         Period
  incidents:      TrendPoint[]
  missed_visits:  TrendPoint[]
  new_staff:      TrendPoint[]
  new_applicants: TrendPoint[]
  compliance_issues: TrendPoint[]
  medication_incidents: TrendPoint[]
  timestamp:      string
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'compliance:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const period = (req.nextUrl.searchParams.get('period') ?? '30d') as Period
  const validPeriods: Period[] = ['7d', '30d', '90d', '12m']
  if (!validPeriods.includes(period)) {
    return NextResponse.json({ error: 'Invalid period' }, { status: 400 })
  }

  // Compute window start date
  const now = new Date()
  const daysMap: Record<Period, number> = { '7d': 7, '30d': 30, '90d': 90, '12m': 365 }
  const since = new Date(now.getTime() - daysMap[period] * 86400_000).toISOString()

  const [incRes, visitsRes, staffRes, applicantsRes, docsRes, medRes] = await Promise.all([
    adminClient.from('incidents').select('occurred_at').eq('company_id', companyId).gte('occurred_at', since),
    adminClient.from('visit_notes').select('created_at, is_missed').eq('company_id', companyId).gte('created_at', since),
    adminClient.from('staff_profiles').select('created_at').eq('company_id', companyId).gte('created_at', since),
    adminClient.from('applicants').select('created_at').eq('company_id', companyId).gte('created_at', since).is('deleted_at', null),
    adminClient.from('documents').select('created_at, expiry_date').eq('company_id', companyId).gte('created_at', since),
    adminClient.from('visit_medication_records').select('created_at').eq('company_id', companyId).eq('requires_escalation', true).gte('created_at', since),
  ])

  const incTs     = (incRes.data ?? []).map(r => r.occurred_at as string)
  const missedTs  = (visitsRes.data ?? []).filter(v => v.is_missed).map(v => v.created_at as string)
  const staffTs   = (staffRes.data ?? []).map(r => r.created_at as string)
  const appTs     = (applicantsRes.data ?? []).map(r => r.created_at as string)
  const docsTs    = (docsRes.data ?? []).filter(d => d.expiry_date && new Date(d.expiry_date as string) < new Date()).map(d => d.created_at as string)
  const medTs     = (medRes.data ?? []).map(r => r.created_at as string)

  return NextResponse.json({
    period,
    incidents:            bucketByPeriod(incTs,    period),
    missed_visits:        bucketByPeriod(missedTs, period),
    new_staff:            bucketByPeriod(staffTs,  period),
    new_applicants:       bucketByPeriod(appTs,    period),
    compliance_issues:    bucketByPeriod(docsTs,   period),
    medication_incidents: bucketByPeriod(medTs,    period),
    timestamp:            now.toISOString(),
  } satisfies TrendsResponse)
}
