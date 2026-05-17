// Incident Intelligence & Safeguarding Risk Engine

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type TrendDirection = 'improving' | 'stable' | 'worsening'

// ── Severity base scores ───────────────────────────────────────────────────────

const SEVERITY_BASE: Record<string, number> = {
  low:      10,
  medium:   30,
  high:     60,
  critical: 90,
}

function severityScore(sev: string): number {
  return SEVERITY_BASE[sev] ?? 30
}

function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 75) return 'critical'
  if (score >= 50) return 'high'
  if (score >= 25) return 'medium'
  return 'low'
}

// ── Incident-level risk scoring ────────────────────────────────────────────────

export interface IncidentRiskResult {
  score:          number
  classification: RiskLevel
  factors:        string[]
}

export function scoreIncident(opts: {
  severity:               string
  incident_type:          string
  escalation_required:    boolean
  immediate_action_taken: string | null | undefined
  repeatCountForClient?:  number
  repeatCountForWorker?:  number
}): IncidentRiskResult {
  const factors: string[] = []
  let score = severityScore(opts.severity)

  if (opts.incident_type === 'safeguarding') {
    score += 25
    factors.push('Safeguarding incident')
  }
  if (opts.incident_type === 'medication_error') {
    score += 20
    factors.push('Medication error')
  }
  if (opts.incident_type === 'injury') {
    score += 15
    factors.push('Injury involved')
  }
  if (opts.escalation_required) {
    score += 15
    factors.push('Escalation required')
  }
  if (!opts.immediate_action_taken) {
    score += 10
    factors.push('No immediate action recorded')
  }
  if ((opts.repeatCountForClient ?? 0) >= 2) {
    score += 20
    factors.push('Repeat pattern — same client')
  }
  if ((opts.repeatCountForWorker ?? 0) >= 2) {
    score += 15
    factors.push('Repeat pattern — same worker')
  }

  score = Math.min(100, score)

  return { score, classification: riskLevelFromScore(score), factors }
}

// ── Shared types used by staff/client profiles ─────────────────────────────────

export interface IncidentSummary {
  id:                  string
  incident_type:       string
  severity:            string
  escalation_required: boolean
  occurred_at:         string | null
  risk_score:          number | null
  risk_classification: string | null
}

function avgSev(incidents: IncidentSummary[]): number {
  if (incidents.length === 0) return 0
  const sum = incidents.reduce((a, i) => a + severityScore(i.severity), 0)
  return Math.round(sum / incidents.length)
}

function inWindow(incidents: IncidentSummary[], days: number): IncidentSummary[] {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  return incidents.filter((i) => !i.occurred_at || new Date(i.occurred_at) >= cutoff)
}

function trend(
  recent: IncidentSummary[],
  older:  IncidentSummary[],
): TrendDirection {
  if (recent.length === 0 && older.length === 0) return 'stable'
  if (older.length === 0) return recent.length > 0 ? 'worsening' : 'stable'
  if (recent.length === 0) return 'improving'

  const recentHigh = recent.filter((i) => i.severity === 'high' || i.severity === 'critical').length
  const olderHigh  = older.filter((i)  => i.severity === 'high' || i.severity === 'critical').length

  if (recent.length < older.length && recentHigh <= olderHigh) return 'improving'
  if (recent.length > older.length || recentHigh > olderHigh)  return 'worsening'
  return 'stable'
}

// ── Staff risk profile ─────────────────────────────────────────────────────────

export interface StaffRiskProfile {
  staff_profile_id:            string
  staff_name:                  string
  job_role:                    string | null
  incident_count:              number
  safeguarding_count:          number
  medication_errors:           number
  missed_visits:               number
  escalation_count:            number
  complaint_count:             number
  avg_severity_score:          number
  risk_score:                  number
  risk_level:                  RiskLevel
  trend:                       TrendDirection
  intervention_recommendation: string | null
  recent_incidents:            IncidentSummary[]
}

export function buildStaffRiskProfile(
  staff: {
    id:         string
    first_name: string | null
    last_name:  string | null
    email:      string | null
    job_role?:  string | null
  },
  allIncidents: IncidentSummary[],
  windowDays = 90,
): StaffRiskProfile {
  const w90   = inWindow(allIncidents, windowDays)
  const w45   = inWindow(allIncidents, Math.floor(windowDays / 2))
  const older = w90.filter((i) => !w45.find((r) => r.id === i.id))

  const safeguarding_count = w90.filter((i) => i.incident_type === 'safeguarding').length
  const medication_errors  = w90.filter((i) => i.incident_type === 'medication_error').length
  const missed_visits      = w90.filter((i) => i.incident_type === 'missed_visit').length
  const escalation_count   = w90.filter((i) => i.escalation_required).length
  const complaint_count    = w90.filter((i) => i.incident_type === 'complaint').length

  let score = 0
  score += Math.min(40, w90.length * 8)
  score += safeguarding_count * 15
  score += medication_errors  * 12
  score += escalation_count   * 10
  score += complaint_count    * 8
  score += missed_visits      * 5

  const t = trend(w45, older)
  if (t === 'worsening') score = Math.min(100, score + 10)
  if (t === 'improving') score = Math.max(0,   score - 10)
  score = Math.min(100, score)

  const risk_level = riskLevelFromScore(score)

  const intervention: Record<RiskLevel, string | null> = {
    critical: 'Immediate review required. Consider suspension of duties pending investigation.',
    high:     'Supervisor meeting required. Review recent shifts and implement additional monitoring.',
    medium:   'Schedule 1:1 supervision session. Review training and support needs.',
    low:      null,
  }

  const staff_name = [staff.first_name, staff.last_name].filter(Boolean).join(' ') || staff.email || 'Unknown'

  return {
    staff_profile_id:            staff.id,
    staff_name,
    job_role:                    staff.job_role ?? null,
    incident_count:              w90.length,
    safeguarding_count,
    medication_errors,
    missed_visits,
    escalation_count,
    complaint_count,
    avg_severity_score:          avgSev(w90),
    risk_score:                  score,
    risk_level,
    trend:                       t,
    intervention_recommendation: intervention[risk_level],
    recent_incidents:            w90.slice(0, 5),
  }
}

// ── Client risk profile ────────────────────────────────────────────────────────

export interface ClientRiskProfile {
  client_id:             string
  client_name:           string
  incident_count:        number
  falls_count:           number
  medication_issues:     number
  behaviour_escalations: number
  safeguarding_alerts:   number
  missed_care:           number
  avg_severity_score:    number
  risk_score:            number
  risk_level:            RiskLevel
  review_recommendation: string | null
  recent_incidents:      IncidentSummary[]
}

export function buildClientRiskProfile(
  client: { id: string; first_name: string; last_name: string },
  allIncidents: IncidentSummary[],
  windowDays = 90,
): ClientRiskProfile {
  const w90 = inWindow(allIncidents, windowDays)

  const falls_count            = w90.filter((i) => i.incident_type === 'fall').length
  const medication_issues      = w90.filter((i) => i.incident_type === 'medication_error').length
  const behaviour_escalations  = w90.filter((i) => i.incident_type === 'behaviour').length
  const safeguarding_alerts    = w90.filter((i) => i.incident_type === 'safeguarding').length
  const missed_care            = w90.filter((i) => i.incident_type === 'missed_visit').length

  let score = 0
  score += Math.min(40, w90.length * 8)
  score += safeguarding_alerts  * 15
  score += falls_count          * 12
  score += medication_issues    * 12
  score += behaviour_escalations * 8
  score += missed_care          * 5
  score = Math.min(100, score)

  const risk_level = riskLevelFromScore(score)

  const review: Record<RiskLevel, string | null> = {
    critical: 'Urgent care plan review required. Notify care manager and family.',
    high:     'Care plan review needed within 48 hours. Increase monitoring frequency.',
    medium:   'Schedule care review at next assessment window.',
    low:      null,
  }

  return {
    client_id:             client.id,
    client_name:           `${client.first_name} ${client.last_name}`,
    incident_count:        w90.length,
    falls_count,
    medication_issues,
    behaviour_escalations,
    safeguarding_alerts,
    missed_care,
    avg_severity_score:    avgSev(w90),
    risk_score:            score,
    risk_level,
    review_recommendation: review[risk_level],
    recent_incidents:      w90.slice(0, 5),
  }
}

// ── Weekly trend builder ───────────────────────────────────────────────────────

export interface WeeklyTrendPoint {
  week_start:       string  // ISO date
  count:            number
  high_critical:    number
  safeguarding:     number
}

export function buildWeeklyTrend(
  incidents: IncidentSummary[],
  weeks = 8,
): WeeklyTrendPoint[] {
  const points: WeeklyTrendPoint[] = []
  const now = new Date()

  for (let w = weeks - 1; w >= 0; w--) {
    const start = new Date(now)
    start.setDate(start.getDate() - (w + 1) * 7)
    start.setHours(0, 0, 0, 0)

    const end = new Date(now)
    end.setDate(end.getDate() - w * 7)
    end.setHours(23, 59, 59, 999)

    const inWeek = incidents.filter((i) => {
      const d = i.occurred_at ? new Date(i.occurred_at) : null
      return d && d >= start && d <= end
    })

    points.push({
      week_start:    start.toISOString().slice(0, 10),
      count:         inWeek.length,
      high_critical: inWeek.filter((i) => i.severity === 'high' || i.severity === 'critical').length,
      safeguarding:  inWeek.filter((i) => i.incident_type === 'safeguarding').length,
    })
  }

  return points
}

// ── Pattern alerts ─────────────────────────────────────────────────────────────

export interface PatternAlert {
  type:     string
  message:  string
  severity: 'warning' | 'danger'
}

export function detectPatternAlerts(incidents: IncidentSummary[]): PatternAlert[] {
  const alerts: PatternAlert[] = []
  const w30 = inWindow(incidents, 30)
  const w7  = inWindow(incidents, 7)

  const medErrors30 = w30.filter((i) => i.incident_type === 'medication_error').length
  if (medErrors30 >= 3) {
    alerts.push({
      type:     'medication_cluster',
      message:  `${medErrors30} medication errors in the last 30 days`,
      severity: medErrors30 >= 5 ? 'danger' : 'warning',
    })
  }

  const safeguarding30 = w30.filter((i) => i.incident_type === 'safeguarding').length
  if (safeguarding30 >= 2) {
    alerts.push({
      type:     'safeguarding_cluster',
      message:  `${safeguarding30} safeguarding incidents in the last 30 days`,
      severity: 'danger',
    })
  }

  const escalated30 = w30.filter((i) => i.escalation_required).length
  if (escalated30 >= 4) {
    alerts.push({
      type:     'escalation_spike',
      message:  `${escalated30} escalated incidents in the last 30 days`,
      severity: escalated30 >= 6 ? 'danger' : 'warning',
    })
  }

  const critical7 = w7.filter((i) => i.severity === 'critical').length
  if (critical7 >= 2) {
    alerts.push({
      type:     'critical_spike',
      message:  `${critical7} critical incidents in the last 7 days`,
      severity: 'danger',
    })
  }

  const missed30 = w30.filter((i) => i.incident_type === 'missed_visit').length
  if (missed30 >= 5) {
    alerts.push({
      type:     'missed_visit_pattern',
      message:  `${missed30} missed visits flagged in the last 30 days`,
      severity: 'warning',
    })
  }

  return alerts
}
