/**
 * lib/analytics/compute.ts
 * Pure computation helpers for executive analytics — no server imports.
 */

// ── Date bucketing ────────────────────────────────────────────────────────────

export type Period = '7d' | '30d' | '90d' | '12m'

export interface TrendPoint {
  label: string   // "Mon", "12 May", "May"
  value: number
  date:  string   // ISO date of bucket start
}

/** Bucket an array of ISO timestamps into daily/weekly/monthly trend points. */
export function bucketByPeriod(
  timestamps: string[],
  period: Period,
): TrendPoint[] {
  const now = new Date()

  if (period === '7d') {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now)
      d.setDate(d.getDate() - (6 - i))
      const date = d.toISOString().slice(0, 10)
      return {
        label: d.toLocaleDateString('en-GB', { weekday: 'short' }),
        value: timestamps.filter(t => t.slice(0, 10) === date).length,
        date,
      }
    })
  }

  if (period === '30d') {
    // Weekly buckets — 4 weeks
    return Array.from({ length: 4 }, (_, i) => {
      const end   = new Date(now); end.setDate(end.getDate() - i * 7)
      const start = new Date(end); start.setDate(start.getDate() - 6)
      const endStr   = end.toISOString().slice(0, 10)
      const startStr = start.toISOString().slice(0, 10)
      return {
        label: `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
        value: timestamps.filter(t => t.slice(0, 10) >= startStr && t.slice(0, 10) <= endStr).length,
        date:  startStr,
      }
    }).reverse()
  }

  if (period === '90d') {
    // Bi-weekly buckets — 6 periods
    return Array.from({ length: 6 }, (_, i) => {
      const end   = new Date(now); end.setDate(end.getDate() - i * 14)
      const start = new Date(end); start.setDate(start.getDate() - 13)
      const endStr   = end.toISOString().slice(0, 10)
      const startStr = start.toISOString().slice(0, 10)
      return {
        label: start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        value: timestamps.filter(t => t.slice(0, 10) >= startStr && t.slice(0, 10) <= endStr).length,
        date:  startStr,
      }
    }).reverse()
  }

  // 12m — monthly buckets
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
    const monthStr = d.toISOString().slice(0, 7)
    return {
      label: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
      value: timestamps.filter(t => t.slice(0, 7) === monthStr).length,
      date:  d.toISOString().slice(0, 10),
    }
  })
}

/** Compute percentage change vs previous period. */
export function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

/** Split period in half: current half vs previous half. */
export function splitHalves(timestamps: string[], period: Period): { current: number; previous: number } {
  const now = new Date()
  let halfDays: number

  if      (period === '7d')  halfDays = 3
  else if (period === '30d') halfDays = 15
  else if (period === '90d') halfDays = 45
  else                       halfDays = 182

  const midpoint = new Date(now.getTime() - halfDays * 86400_000).toISOString()
  const start    = new Date(now.getTime() - halfDays * 2 * 86400_000).toISOString()

  return {
    current:  timestamps.filter(t => t >= midpoint).length,
    previous: timestamps.filter(t => t >= start && t < midpoint).length,
  }
}

// ── Health score ──────────────────────────────────────────────────────────────

export interface HealthScoreInputs {
  compliantStaff:       number
  totalActiveStaff:     number
  deployableStaff:      number
  totalStaff:           number
  openCriticalIncidents:number
  openHighIncidents:    number
  visitCompletionRate:  number  // 0-100
  onboardingBacklog:    number  // count of pre_employment > 30 days
}

export interface HealthScore {
  score:           number   // 0-100
  label:           'Critical' | 'At Risk' | 'Moderate' | 'Good'
  colour:          'red' | 'orange' | 'amber' | 'emerald'
  compliance_pts:  number
  workforce_pts:   number
  incident_pts:    number
  visit_pts:       number
  onboarding_pts:  number
  breakdown:       string[]
}

export function computeHealthScore(inputs: HealthScoreInputs): HealthScore {
  const breakdown: string[] = []

  // Compliance health (0-25)
  const complianceRatio = inputs.totalActiveStaff > 0
    ? inputs.compliantStaff / inputs.totalActiveStaff
    : 1
  const compliance_pts = Math.round(complianceRatio * 25)
  if (compliance_pts < 15) breakdown.push(`Compliance at ${Math.round(complianceRatio * 100)}%`)

  // Workforce readiness (0-25)
  const readinessRatio = inputs.totalStaff > 0
    ? inputs.deployableStaff / inputs.totalStaff
    : 1
  const workforce_pts = Math.round(readinessRatio * 25)
  if (workforce_pts < 15) breakdown.push(`Only ${Math.round(readinessRatio * 100)}% of workforce deployable`)

  // Incident pressure (0-20) — deduct for open incidents
  const incidentDeduction = Math.min(20, inputs.openCriticalIncidents * 5 + inputs.openHighIncidents * 2)
  const incident_pts = 20 - incidentDeduction
  if (incidentDeduction > 5) breakdown.push(`${inputs.openCriticalIncidents} critical, ${inputs.openHighIncidents} high incidents open`)

  // Visit completion (0-20)
  const visit_pts = Math.round((inputs.visitCompletionRate / 100) * 20)
  if (visit_pts < 12) breakdown.push(`Visit completion at ${inputs.visitCompletionRate}%`)

  // Onboarding flow (0-10) — deduct for backlog
  const onboarding_pts = Math.max(0, 10 - Math.min(10, inputs.onboardingBacklog * 2))
  if (onboarding_pts < 6) breakdown.push(`${inputs.onboardingBacklog} workers stuck in onboarding`)

  const score = Math.max(0, Math.min(100, compliance_pts + workforce_pts + incident_pts + visit_pts + onboarding_pts))

  let label: HealthScore['label'] = 'Good'
  let colour: HealthScore['colour'] = 'emerald'
  if (score < 40)      { label = 'Critical'; colour = 'red' }
  else if (score < 60) { label = 'At Risk';  colour = 'orange' }
  else if (score < 80) { label = 'Moderate'; colour = 'amber' }

  return { score, label, colour, compliance_pts, workforce_pts, incident_pts, visit_pts, onboarding_pts, breakdown }
}

// ── Signal detection ──────────────────────────────────────────────────────────

export interface Signal {
  id:         string
  type:       'warning' | 'critical' | 'info'
  headline:   string
  detail:     string
  pct_change?: number
  area:        'incidents' | 'compliance' | 'workforce' | 'visits' | 'onboarding' | 'medication'
}

export interface SignalInputs {
  incidentsCurrent:     number
  incidentsPrevious:    number
  missedVisitsCurrent:  number
  missedVisitsPrevious: number
  medIncidentsCurrent:  number
  medIncidentsPrevious: number
  onboardingBacklog:    number
  complianceExpiring:   number
  totalStaff:           number
  nightShiftGap:        number
  unresolvedAnomalies:  number
}

export function detectSignals(inputs: SignalInputs): Signal[] {
  const signals: Signal[] = []

  const incidentChange = pctChange(inputs.incidentsCurrent, inputs.incidentsPrevious)
  if (inputs.incidentsCurrent > 0 && incidentChange >= 20) {
    signals.push({
      id: 'incidents_rising', type: incidentChange >= 50 ? 'critical' : 'warning',
      headline: `Incidents increased ${incidentChange}% this period`,
      detail: `${inputs.incidentsCurrent} vs ${inputs.incidentsPrevious} previous period`,
      pct_change: incidentChange, area: 'incidents',
    })
  }

  const missedChange = pctChange(inputs.missedVisitsCurrent, inputs.missedVisitsPrevious)
  if (inputs.missedVisitsCurrent > 0 && missedChange >= 20) {
    signals.push({
      id: 'missed_visits_rising', type: missedChange >= 50 ? 'critical' : 'warning',
      headline: `Missed visits up ${missedChange}% this period`,
      detail: `${inputs.missedVisitsCurrent} vs ${inputs.missedVisitsPrevious} previous period`,
      pct_change: missedChange, area: 'visits',
    })
  }

  const medChange = pctChange(inputs.medIncidentsCurrent, inputs.medIncidentsPrevious)
  if (inputs.medIncidentsCurrent > 0 && medChange >= 15) {
    signals.push({
      id: 'med_incidents_rising', type: 'critical',
      headline: `Medication incidents increased ${medChange}% this period`,
      detail: `${inputs.medIncidentsCurrent} medication issues requiring escalation`,
      pct_change: medChange, area: 'medication',
    })
  }

  if (inputs.onboardingBacklog >= 3) {
    signals.push({
      id: 'onboarding_backlog', type: inputs.onboardingBacklog >= 6 ? 'critical' : 'warning',
      headline: `${inputs.onboardingBacklog} workers stuck in onboarding`,
      detail: 'Workers in pre-employment for more than 30 days — capacity at risk',
      area: 'onboarding',
    })
  }

  if (inputs.complianceExpiring >= 5) {
    signals.push({
      id: 'compliance_expiring', type: 'warning',
      headline: `${inputs.complianceExpiring} compliance items expiring within 30 days`,
      detail: 'Action needed to prevent deployability loss',
      area: 'compliance',
    })
  }

  if (inputs.nightShiftGap >= 3) {
    signals.push({
      id: 'night_shift_gap', type: 'warning',
      headline: `${inputs.nightShiftGap} uncovered night/sleep-in shifts`,
      detail: 'Night coverage risk — high-risk clients may be unprotected',
      area: 'workforce',
    })
  }

  if (inputs.unresolvedAnomalies >= 5) {
    signals.push({
      id: 'anomalies_backlog', type: 'warning',
      headline: `${inputs.unresolvedAnomalies} unresolved visit anomalies`,
      detail: 'Late arrivals, short visits, and no-shows need review',
      area: 'visits',
    })
  }

  return signals.sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 }
    return (order[a.type] ?? 2) - (order[b.type] ?? 2)
  })
}
