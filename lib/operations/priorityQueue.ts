// Operations priority queue — shared types and priority scoring

export type QueuePriority = 'critical' | 'urgent' | 'warning' | 'informational'
export type QueueCategory =
  | 'safeguarding'
  | 'compliance'
  | 'staffing'
  | 'onboarding'
  | 'incident'
  | 'medication'
  | 'shift_coverage'
  | 'other'

export type QueueStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed'

export interface QueueItem {
  id:                          string
  company_id:                  string
  priority:                    QueuePriority
  category:                    QueueCategory
  title:                       string
  description:                 string | null
  entity_type:                 string | null
  entity_id:                   string | null
  entity_url:                  string | null
  assigned_to:                 string | null
  assigned_at:                 string | null
  due_date:                    string | null
  status:                      QueueStatus
  auto_generated:              boolean
  source:                      string | null
  escalation_triggered_at:     string | null
  escalation_acknowledged_at:  string | null
  escalation_acknowledged_by:  string | null
  resolution_notes:            string | null
  resolved_at:                 string | null
  resolved_by:                 string | null
  created_at:                  string
  updated_at:                  string
}

export interface HandoverNote {
  id:               string
  company_id:       string
  handover_date:    string
  shift_period:     string
  author_name:      string
  author_id:        string | null
  summary:          string
  flagged_items:    HandoverFlaggedItem[]
  follow_up_actions: HandoverAction[]
  status:           string
  reviewed_by:      string | null
  reviewed_at:      string | null
  created_at:       string
  updated_at:       string
}

export interface HandoverFlaggedItem {
  type:        string
  description: string
  priority:    QueuePriority
  entity_id?:  string
  entity_url?: string
}

export interface HandoverAction {
  action: string
  owner?: string
  due?:   string
  done?:  boolean
}

// ── Priority ordering ──────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<QueuePriority, number> = {
  critical:      4,
  urgent:        3,
  warning:       2,
  informational: 1,
}

export function sortByPriority(a: QueueItem, b: QueueItem): number {
  const pd = PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority]
  if (pd !== 0) return pd
  if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
}

// ── Feed event type ────────────────────────────────────────────────────────────

export type FeedEventSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type FeedEventType =
  | 'incident'
  | 'compliance'
  | 'staffing'
  | 'handover'
  | 'queue'
  | 'override'
  | 'onboarding'
  | 'safeguarding'

export interface FeedEvent {
  id:           string
  type:         FeedEventType
  severity:     FeedEventSeverity
  title:        string
  description:  string
  entity_type?: string
  entity_id?:   string
  entity_url?:  string
  occurred_at:  string
  actor?:       string
}

// ── OCC summary types ──────────────────────────────────────────────────────────

export interface ShiftSummary {
  id:         string
  title:      string
  shift_date: string
  start_time: string
  end_time:   string
  client_name: string | null
}

export interface SafeguardingIncident {
  id:           string
  description:  string
  severity:     string
  status:       string
  occurred_at:  string | null
  client_name:  string | null
  staff_name:   string | null
  risk_score:   number | null
}

export interface ComplianceAlert {
  staff_id:    string
  staff_name:  string
  doc_type:    string
  expiry_date: string
  days_left:   number
  is_expired:  boolean
}

export interface OccSummary {
  open_incidents:         number
  safeguarding_alerts:    number
  uncovered_shifts:       number
  onboarding_stalls:      number
  expiring_critical_docs: number
  active_overrides:       number
  overdue_follow_ups:     number
  queue: {
    critical_count: number
    urgent_count:   number
    warning_count:  number
    total_open:     number
    top_items:      QueueItem[]
  }
  feed:               FeedEvent[]
  shift_coverage: {
    total_shifts:      number
    covered:           number
    uncovered:         number
    uncovered_shifts:  ShiftSummary[]
  }
  safeguarding: {
    open_count: number
    incidents:  SafeguardingIncident[]
  }
  latest_handover:    HandoverNote | null
  compliance_alerts:  ComplianceAlert[]
  last_updated:       string
}
