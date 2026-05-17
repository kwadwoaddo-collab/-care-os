import { NextRequest, NextResponse } from 'next/server'
import { adminClient }              from '@/lib/supabase/admin'
import { requireAdmin }             from '@/lib/auth/requireAdmin'
import { can }                      from '@/lib/auth/permissions'
import { forbidden }                from '@/lib/auth/responses'
import { daysNonCompliant, ESCALATION_LABELS, ESCALATION_THRESHOLDS } from '@/lib/compliance/escalation'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EscalationEvent {
  id:               string
  timestamp:        string
  level:            string
  levelLabel:       string
  daysNonCompliant: number
  missingDocs:      string[]
  missingTraining:  string[]
  complianceState:  string
  percentage:       number
}

export interface EscalationHistoryResponse {
  staffId:            string
  nonCompliantSince:  string | null
  currentDays:        number
  thresholds: {
    worker_notified:        number
    coordinator_escalated:  number
    manager_escalated:      number
  }
  history:            EscalationEvent[]
  remindersLog:       Array<{
    id:        string
    timestamp: string
    subject:   string | null
    status:    string
  }>
}

// ── GET /api/admin/staff/[id]/compliance/escalation ───────────────────────────
//
// Returns the escalation history for a staff member — when escalations
// triggered, why, how long they were non-compliant, and who was notified.

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'compliance:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const { id } = await params

  // Verify staff is in company
  const { data: staff, error: spErr } = await adminClient
    .from('staff_profiles')
    .select('id, non_compliant_since')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (spErr || !staff) {
    return NextResponse.json({ error: 'Staff profile not found' }, { status: 404 })
  }

  const nonCompliantSince = (staff.non_compliant_since as string | null) ?? null
  const currentDays = daysNonCompliant(nonCompliantSince)

  // Fetch escalation audit events for this staff member
  const { data: escalationRows } = await adminClient
    .from('audit_logs')
    .select('id, created_at, metadata')
    .eq('company_id', companyId)
    .eq('entity_id', id)
    .eq('action', 'compliance.escalation')
    .order('created_at', { ascending: false })
    .limit(50)

  const history: EscalationEvent[] = (escalationRows ?? []).map((row) => {
    const meta = (row.metadata as {
      level?:              string
      days_non_compliant?: number
      missing_docs?:       string[]
      missing_training?:   string[]
      compliance_state?:   string
      percentage?:         number
    }) ?? {}

    const level = meta.level ?? 'unknown'
    return {
      id:               row.id,
      timestamp:        row.created_at,
      level,
      levelLabel:       ESCALATION_LABELS[level as keyof typeof ESCALATION_LABELS] ?? level,
      daysNonCompliant: meta.days_non_compliant ?? 0,
      missingDocs:      meta.missing_docs     ?? [],
      missingTraining:  meta.missing_training ?? [],
      complianceState:  meta.compliance_state ?? 'unknown',
      percentage:       meta.percentage        ?? 0,
    }
  })

  // Fetch compliance reminder logs for this staff member (who was notified)
  const { data: reminderRows } = await adminClient
    .from('notification_logs')
    .select('id, created_at, subject, status')
    .eq('entity_type', 'staff_profile')
    .eq('entity_id', id)
    .in('event_type', ['compliance.worker_reminder', 'compliance.digest'])
    .order('created_at', { ascending: false })
    .limit(20)

  const remindersLog = (reminderRows ?? []).map((row) => ({
    id:        row.id,
    timestamp: row.created_at,
    subject:   (row.subject as string | null) ?? null,
    status:    row.status,
  }))

  return NextResponse.json({
    staffId:           staff.id,
    nonCompliantSince,
    currentDays,
    thresholds: {
      worker_notified:       ESCALATION_THRESHOLDS.worker_notified,
      coordinator_escalated: ESCALATION_THRESHOLDS.coordinator_escalated,
      manager_escalated:     ESCALATION_THRESHOLDS.manager_escalated,
    },
    history,
    remindersLog,
  } satisfies EscalationHistoryResponse)
}
