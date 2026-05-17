import { NextResponse } from 'next/server'
import { adminClient }  from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can }          from '@/lib/auth/permissions'
import { forbidden }    from '@/lib/auth/responses'
import { computeHealthScore, detectSignals, splitHalves } from '@/lib/analytics/compute'

// GET — full analytics export bundle for PDF/briefing generation
export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'compliance:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const now    = new Date()
  const ago30  = new Date(now.getTime() - 30 * 86400_000).toISOString()
  const ago90  = new Date(now.getTime() - 90 * 86400_000).toISOString()
  const today  = now.toISOString().slice(0, 10)
  const in30d  = new Date(now.getTime() + 30 * 86400_000).toISOString().slice(0, 10)
  const cutoff = new Date(now.getTime() - 30 * 86400_000).toISOString()

  const [compRes, incRes, staffRes, shiftRes, visitRes, medRes, onbRes, docsRes] = await Promise.all([
    adminClient.from('documents').select('id, expiry_date, reviewed_status, document_type').eq('company_id', companyId),
    adminClient.from('incidents').select('id, incident_type, severity, status, occurred_at, escalation_required').eq('company_id', companyId).gte('occurred_at', ago90),
    adminClient.from('staff_profiles').select('id, status, created_at').eq('company_id', companyId),
    adminClient.from('shifts').select('id, status, shift_date, shift_type').eq('company_id', companyId).gte('shift_date', ago30.slice(0, 10)),
    adminClient.from('visit_notes').select('id, is_missed, created_at, escalation_raised').eq('company_id', companyId).gte('created_at', ago30),
    adminClient.from('visit_medication_records').select('id, action, requires_escalation, created_at').eq('company_id', companyId).gte('created_at', ago30),
    adminClient.from('staff_profiles').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'pre_employment').lt('created_at', cutoff),
    adminClient.from('documents').select('*', { count: 'exact', head: true }).eq('company_id', companyId).not('expiry_date', 'is', null).lte('expiry_date', in30d).gte('expiry_date', today),
  ])

  const staff    = staffRes.data ?? []
  const incidents = incRes.data ?? []
  const visits   = visitRes.data ?? []
  const shifts   = shiftRes.data ?? []

  const activeStaff = staff.filter(s => s.status === 'active')
  const expiredDocs = (compRes.data ?? []).filter(d => d.expiry_date && new Date(d.expiry_date as string) < now)
  const complianceRate = activeStaff.length > 0
    ? Math.round(((activeStaff.length - expiredDocs.length) / activeStaff.length) * 100)
    : 100

  const openInc  = incidents.filter(i => ['open','investigating'].includes(i.status as string))
  const critInc  = openInc.filter(i => i.severity === 'critical')
  const highInc  = openInc.filter(i => i.severity === 'high')

  const completedShifts = shifts.filter(s => s.status === 'completed')
  const missedShifts    = shifts.filter(s => s.status === 'missed')
  const shiftFulfillment = (completedShifts.length + missedShifts.length) > 0
    ? Math.round((completedShifts.length / (completedShifts.length + missedShifts.length)) * 100)
    : 100

  const missedVisits    = visits.filter(v => v.is_missed)
  const visitCompletion = visits.length > 0
    ? Math.round(((visits.length - missedVisits.length) / visits.length) * 100)
    : 100

  const healthScore = computeHealthScore({
    compliantStaff:        activeStaff.length - expiredDocs.length,
    totalActiveStaff:      activeStaff.length,
    deployableStaff:       activeStaff.length,
    totalStaff:            staff.filter(s => s.status !== 'terminated').length,
    openCriticalIncidents: critInc.length,
    openHighIncidents:     highInc.length,
    visitCompletionRate:   visitCompletion,
    onboardingBacklog:     onbRes.count ?? 0,
  })

  const incTs  = incidents.map(i => i.occurred_at as string)
  const missTs = missedVisits.map(v => v.created_at as string)
  const medTs  = (medRes.data ?? []).map(m => m.created_at as string)
  const signals = detectSignals({
    incidentsCurrent:    splitHalves(incTs, '30d').current,
    incidentsPrevious:   splitHalves(incTs, '30d').previous,
    missedVisitsCurrent: splitHalves(missTs, '30d').current,
    missedVisitsPrevious: splitHalves(missTs, '30d').previous,
    medIncidentsCurrent: splitHalves(medTs, '30d').current,
    medIncidentsPrevious: splitHalves(medTs, '30d').previous,
    onboardingBacklog:   onbRes.count ?? 0,
    complianceExpiring:  docsRes.count ?? 0,
    totalStaff:          activeStaff.length,
    nightShiftGap:       shifts.filter(s => ['night','sleep_in'].includes(s.shift_type as string) && s.status === 'open').length,
    unresolvedAnomalies: 0,
  })

  // Company name
  const { data: company } = await adminClient.from('companies').select('name').eq('id', companyId).maybeSingle()

  return NextResponse.json({
    generated_at:       now.toISOString(),
    report_period:      '30 days',
    company_name:       company?.name ?? 'Unknown',
    health_score:       healthScore,
    signals,
    kpis: {
      total_active_staff:       activeStaff.length,
      compliance_rate:          complianceRate,
      open_incidents:           openInc.length,
      critical_incidents:       critInc.length,
      shift_fulfillment_rate:   shiftFulfillment,
      missed_visits_30d:        missedVisits.length,
      visit_completion_rate:    visitCompletion,
      medication_incidents_30d: (medRes.data ?? []).filter(m => m.requires_escalation).length,
      expiring_compliance_30d:  docsRes.count ?? 0,
      onboarding_backlog:       onbRes.count ?? 0,
    },
    incident_breakdown: (() => {
      const m = new Map<string, number>()
      for (const i of incidents) m.set(i.incident_type as string, (m.get(i.incident_type as string) ?? 0) + 1)
      return [...m.entries()].map(([type, count]) => ({ type, count }))
    })(),
  })
}
