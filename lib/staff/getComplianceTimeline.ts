// lib/staff/getComplianceTimeline.ts
//
// Builds a chronological compliance history for a staff member by querying
// the audit_logs table for document and compliance events.

import 'server-only'
import { adminClient } from '@/lib/supabase/admin'

export type ComplianceEventType =
  | 'uploaded'
  | 'approved'
  | 'rejected'
  | 'superseded'
  | 'expired'
  | 'reminder_sent'
  | 'renewed'

export interface ComplianceEvent {
  id:        string
  timestamp: string
  eventType: ComplianceEventType
  label:     string
  detail:    string | null
}

const ACTION_MAP: Record<string, ComplianceEventType> = {
  'document.uploaded':   'uploaded',
  'document.approved':   'approved',
  'document.rejected':   'rejected',
  'document.superseded': 'superseded',
  'compliance.reminder': 'reminder_sent',
  'document.renewed':    'renewed',
}

function labelFor(eventType: ComplianceEventType, meta: Record<string, unknown>): string {
  const docType      = String(meta?.document_type   ?? meta?.doc_type   ?? '')
  const trainingCat  = String(meta?.training_category ?? '')
  const subject      = String(meta?.subject ?? '')

  switch (eventType) {
    case 'uploaded':       return `Document uploaded${docType ? `: ${docType.replace(/_/g, ' ')}` : ''}`
    case 'approved':       return `Approved${trainingCat ? `: ${trainingCat.replace(/_/g, ' ')}` : docType ? `: ${docType.replace(/_/g, ' ')}` : ''}`
    case 'rejected':       return `Rejected${trainingCat ? `: ${trainingCat.replace(/_/g, ' ')}` : docType ? `: ${docType.replace(/_/g, ' ')}` : ''}`
    case 'superseded':     return `Certificate superseded${trainingCat ? `: ${trainingCat.replace(/_/g, ' ')}` : ''}`
    case 'expired':        return `Certificate expired${trainingCat ? `: ${trainingCat.replace(/_/g, ' ')}` : docType ? `: ${docType.replace(/_/g, ' ')}` : ''}`
    case 'reminder_sent':  return `Compliance reminder sent${subject ? ` — ${subject}` : ''}`
    case 'renewed':        return `Certificate renewed${trainingCat ? `: ${trainingCat.replace(/_/g, ' ')}` : ''}`
    default:               return 'Compliance event'
  }
}

export async function getComplianceTimeline(
  staffProfileId: string,
  applicantId:    string | null,
): Promise<ComplianceEvent[]> {
  // Query audit_log for document events related to this staff member
  const entityIds = [staffProfileId, applicantId].filter(Boolean) as string[]

  const { data: auditRows, error } = await adminClient
    .from('audit_logs')
    .select('id, created_at, action, entity_type, entity_id, metadata')
    .in('entity_id', entityIds)
    .in('action', Object.keys(ACTION_MAP))
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[getComplianceTimeline] error:', error.message)
    return []
  }

  // Also pull compliance reminder logs
  const { data: reminderRows } = await adminClient
    .from('notification_logs')
    .select('id, created_at, event_type, subject, entity_id')
    .eq('entity_type', 'staff_profile')
    .eq('entity_id', staffProfileId)
    .eq('event_type', 'compliance.worker_reminder')
    .eq('status', 'sent')
    .order('created_at', { ascending: false })
    .limit(20)

  const events: ComplianceEvent[] = []

  // Audit log events
  for (const row of auditRows ?? []) {
    const eventType = ACTION_MAP[row.action]
    if (!eventType) continue
    const meta  = (row.metadata as Record<string, unknown>) ?? {}
    const label = labelFor(eventType, meta)

    events.push({
      id:        row.id,
      timestamp: row.created_at,
      eventType,
      label,
      detail:    (meta?.notes ?? meta?.reason ?? null) as string | null,
    })
  }

  // Reminder log events
  for (const row of reminderRows ?? []) {
    events.push({
      id:        `notif-${row.id}`,
      timestamp: row.created_at,
      eventType: 'reminder_sent',
      label:     'Compliance reminder sent',
      detail:    (row.subject as string | null) ?? null,
    })
  }

  // Sort combined list newest-first
  events.sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  return events.slice(0, 50)
}
