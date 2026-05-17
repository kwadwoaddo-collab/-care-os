import { NextResponse } from 'next/server'
import { adminClient }  from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can }          from '@/lib/auth/permissions'
import { forbidden }    from '@/lib/auth/responses'
import { detectSignals, splitHalves, type Signal } from '@/lib/analytics/compute'

export interface SignalsResponse {
  signals:   Signal[]
  generated: string
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'compliance:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const now  = new Date()
  const ago30 = new Date(now.getTime() - 30 * 86400_000).toISOString()
  const cutoff = new Date(now.getTime() - 30 * 86400_000).toISOString()
  const today  = now.toISOString().slice(0, 10)
  const in30d  = new Date(now.getTime() + 30 * 86400_000).toISOString().slice(0, 10)

  const [incRes, missedRes, medRes, onbRes, docsRes, anomalyRes, nightRes] = await Promise.all([
    adminClient.from('incidents').select('occurred_at').eq('company_id', companyId).gte('occurred_at', ago30),
    adminClient.from('visit_notes').select('created_at').eq('company_id', companyId).eq('is_missed', true).gte('created_at', ago30),
    adminClient.from('visit_medication_records').select('created_at').eq('company_id', companyId).eq('requires_escalation', true).gte('created_at', ago30),
    adminClient.from('staff_profiles').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'pre_employment').lt('created_at', cutoff),
    adminClient.from('documents').select('*', { count: 'exact', head: true }).eq('company_id', companyId).not('expiry_date', 'is', null).lte('expiry_date', in30d).gte('expiry_date', today),
    adminClient.from('visit_anomalies').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('resolved', false),
    adminClient.from('shifts').select('*', { count: 'exact', head: true }).eq('company_id', companyId).in('shift_type', ['night', 'sleep_in']).in('status', ['open', 'offered']).gte('shift_date', today),
  ])

  const incTs  = (incRes.data ?? []).map(r => r.occurred_at as string)
  const missTs = (missedRes.data ?? []).map(r => r.created_at as string)
  const medTs  = (medRes.data ?? []).map(r => r.created_at as string)

  const signals = detectSignals({
    incidentsCurrent:    splitHalves(incTs, '30d').current,
    incidentsPrevious:   splitHalves(incTs, '30d').previous,
    missedVisitsCurrent: splitHalves(missTs, '30d').current,
    missedVisitsPrevious: splitHalves(missTs, '30d').previous,
    medIncidentsCurrent: splitHalves(medTs, '30d').current,
    medIncidentsPrevious: splitHalves(medTs, '30d').previous,
    onboardingBacklog:   onbRes.count ?? 0,
    complianceExpiring:  docsRes.count ?? 0,
    totalStaff:          0,
    nightShiftGap:       nightRes.count ?? 0,
    unresolvedAnomalies: anomalyRes.count ?? 0,
  })

  return NextResponse.json({ signals, generated: now.toISOString() } satisfies SignalsResponse)
}
