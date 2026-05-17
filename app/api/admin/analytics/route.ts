import { NextResponse } from 'next/server'
import { adminClient }   from '@/lib/supabase/admin'
import { requireAdmin }  from '@/lib/auth/requireAdmin'
import { can }           from '@/lib/auth/permissions'
import { forbidden }     from '@/lib/auth/responses'
import {
  computeHealthScore,
  detectSignals,
  splitHalves,
  type HealthScore,
  type Signal,
} from '@/lib/analytics/compute'

export interface AnalyticsDashboard {
  health_score:              HealthScore
  signals:                   Signal[]
  kpis: {
    total_active_staff:      number
    total_applicants:        number
    deployable_staff:        number
    compliance_rate:         number   // 0-100 pct
    open_incidents:          number
    critical_incidents:      number
    missed_visits_30d:       number
    shift_fulfillment_rate:  number   // 0-100 pct
    avg_onboarding_days:     number | null
    medication_incidents_30d:number
    expiring_compliance_30d: number
    onboarding_backlog:      number
  }
  timestamp: string
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'compliance:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const now    = new Date()
  const ago30  = new Date(now.getTime() - 30  * 86400_000).toISOString()
  const ago60  = new Date(now.getTime() - 60  * 86400_000).toISOString()
  const ago30d = ago30.slice(0, 10)
  const cutoff30 = new Date(now.getTime() - 30 * 86400_000).toISOString()
  const in30days = new Date(now.getTime() + 30 * 86400_000).toISOString().slice(0, 10)
  const today    = now.toISOString().slice(0, 10)

  const [
    staffRes,
    applicantsRes,
    incidentsRes,
    docsExpiringRes,
    missedVisitsRes,
    medIncidentsRes,
    shiftsRes,
    onboardingRes,
    anomaliesRes,
    nightGapRes,
  ] = await Promise.all([
    adminClient.from('staff_profiles')
      .select('id, status, created_at, onboarding_completed')
      .eq('company_id', companyId),
    adminClient.from('applicants')
      .select('id, status, created_at')
      .eq('company_id', companyId)
      .is('deleted_at', null),
    adminClient.from('incidents')
      .select('id, severity, status, occurred_at')
      .eq('company_id', companyId),
    adminClient.from('documents')
      .select('id, expiry_date, reviewed_status')
      .eq('company_id', companyId)
      .not('expiry_date', 'is', null)
      .lte('expiry_date', in30days)
      .gte('expiry_date', today),
    adminClient.from('visit_notes')
      .select('id, is_missed, created_at')
      .eq('company_id', companyId)
      .gte('created_at', ago30),
    adminClient.from('visit_medication_records')
      .select('id, action, requires_escalation, created_at')
      .eq('company_id', companyId)
      .eq('requires_escalation', true)
      .gte('created_at', ago30),
    adminClient.from('shifts')
      .select('id, status, shift_date, shift_type')
      .eq('company_id', companyId)
      .gte('shift_date', ago30d),
    adminClient.from('staff_profiles')
      .select('id, created_at, status, onboarding_completed')
      .eq('company_id', companyId)
      .eq('status', 'pre_employment')
      .lt('created_at', cutoff30),
    adminClient.from('visit_anomalies')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('resolved', false),
    adminClient.from('shifts')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .in('shift_type', ['night', 'sleep_in'])
      .in('status', ['open', 'offered'])
      .gte('shift_date', today),
  ])

  const allStaff   = staffRes.data   ?? []
  const allShifts  = shiftsRes.data  ?? []
  const incidents  = incidentsRes.data ?? []

  const activeStaff     = allStaff.filter(s => s.status === 'active')
  const deployableStaff = activeStaff // Simplified — real check would filter by compliance
  const totalApplicants = (applicantsRes.data ?? []).filter(a => ['applied','shortlisted','interview_scheduled'].includes(a.status as string)).length

  // Compliance rate: pct of active staff with no expired docs
  const expiredCount     = (docsExpiringRes.data ?? []).filter(d => new Date(d.expiry_date!) < now).length
  const staffWithExpired = Math.min(expiredCount, activeStaff.length)
  const complianceRate   = activeStaff.length > 0
    ? Math.round(((activeStaff.length - staffWithExpired) / activeStaff.length) * 100)
    : 100

  const openIncidents     = incidents.filter(i => ['open','investigating'].includes(i.status as string))
  const criticalIncidents = openIncidents.filter(i => i.severity === 'critical')
  const highIncidents     = openIncidents.filter(i => i.severity === 'high')

  // Shift fulfillment
  const totalShifts     = allShifts.filter(s => !['cancelled'].includes(s.status as string)).length
  const completedShifts = allShifts.filter(s => s.status === 'completed').length
  const shiftFulfillment = totalShifts > 0 ? Math.round((completedShifts / totalShifts) * 100) : 100

  // Visit completion (not missed rate)
  const visits          = missedVisitsRes.data ?? []
  const missedCount     = visits.filter(v => v.is_missed).length
  const visitCompletion = visits.length > 0 ? Math.round(((visits.length - missedCount) / visits.length) * 100) : 100

  // Avg onboarding days (hired applicants — time from applied to hired)
  const hiredApplicants = (applicantsRes.data ?? []).filter(a => a.status === 'hired')
  let avgOnboardingDays: number | null = null
  if (hiredApplicants.length > 0) {
    const totalDays = hiredApplicants.reduce((sum, a) => {
      const days = (now.getTime() - new Date(a.created_at as string).getTime()) / 86400_000
      return sum + Math.round(days)
    }, 0)
    avgOnboardingDays = Math.round(totalDays / hiredApplicants.length)
  }

  // Signals: current (30d) vs previous (30-60d)
  const incTimestamps = incidents.map(i => i.occurred_at as string)
  const incCurrent  = splitHalves(incTimestamps, '30d').current
  const incPrevious = splitHalves(incTimestamps, '30d').previous

  const medTimestamps = (medIncidentsRes.data ?? []).map(m => m.created_at as string)
  const medCurrent  = splitHalves(medTimestamps, '30d').current
  const medPrevious = splitHalves(medTimestamps, '30d').previous

  const missedTimestamps = visits.filter(v => v.is_missed).map(v => v.created_at as string)
  const missedCurrent  = splitHalves(missedTimestamps, '30d').current
  const missedPrevious = splitHalves(missedTimestamps, '30d').previous

  const healthScore = computeHealthScore({
    compliantStaff:       activeStaff.length - staffWithExpired,
    totalActiveStaff:     activeStaff.length,
    deployableStaff:      deployableStaff.length,
    totalStaff:           allStaff.filter(s => s.status !== 'terminated').length,
    openCriticalIncidents: criticalIncidents.length,
    openHighIncidents:    highIncidents.length,
    visitCompletionRate:  visitCompletion,
    onboardingBacklog:    onboardingRes.data?.length ?? 0,
  })

  const signals = detectSignals({
    incidentsCurrent:    incCurrent,
    incidentsPrevious:   incPrevious,
    missedVisitsCurrent: missedCurrent,
    missedVisitsPrevious: missedPrevious,
    medIncidentsCurrent: medCurrent,
    medIncidentsPrevious: medPrevious,
    onboardingBacklog:   onboardingRes.data?.length ?? 0,
    complianceExpiring:  docsExpiringRes.data?.length ?? 0,
    totalStaff:          allStaff.length,
    nightShiftGap:       nightGapRes.count ?? 0,
    unresolvedAnomalies: anomaliesRes.count ?? 0,
  })

  void ago60 // suppress unused warning — used for signal period logic in future

  return NextResponse.json({
    health_score: healthScore,
    signals,
    kpis: {
      total_active_staff:       activeStaff.length,
      total_applicants:         totalApplicants,
      deployable_staff:         deployableStaff.length,
      compliance_rate:          complianceRate,
      open_incidents:           openIncidents.length,
      critical_incidents:       criticalIncidents.length,
      missed_visits_30d:        missedCount,
      shift_fulfillment_rate:   shiftFulfillment,
      avg_onboarding_days:      avgOnboardingDays,
      medication_incidents_30d: medIncidentsRes.data?.length ?? 0,
      expiring_compliance_30d:  docsExpiringRes.data?.length ?? 0,
      onboarding_backlog:       onboardingRes.data?.length ?? 0,
    },
    timestamp: now.toISOString(),
  } satisfies AnalyticsDashboard)
}
