import 'server-only'

import { adminClient } from '@/lib/supabase/admin'
import { sendEmail as centralSendEmail } from '@/lib/email/sendEmail'
import { emailConfig } from '@/lib/email/config'
import { shiftAssignedTemplate,   type ShiftAssignedData   } from './templates/shiftAssigned'
import { shiftDeclinedTemplate,   type ShiftDeclinedData   } from './templates/shiftDeclined'
import { runningLateTemplate,     type RunningLateData     } from './templates/runningLate'
import { incidentEscalatedTemplate, type IncidentEscalatedData } from './templates/incidentEscalated'

const APP_URL = emailConfig.appUrl

// ── Event types ───────────────────────────────────────────────────────────────

export type NotificationEventType =
  | 'shift.assigned'
  | 'shift.declined'
  | 'shift.running_late'
  | 'compliance.expiring'
  | 'compliance.expired'          // items past their expiry date
  | 'compliance.missing'          // items never started
  | 'compliance.digest'           // combined compliance reminder digest
  | 'compliance.worker_reminder'  // per-worker individual compliance email
  | 'onboarding.incomplete'
  | 'incident.escalated'
  | 'shift.reminder'
  | 'daily.digest'

// ── Payload per event type ────────────────────────────────────────────────────

export type NotificationPayload =
  | { type: 'shift.assigned';    companyId: string; entityId: string; data: ShiftAssignedData;    recipientEmail: string }
  | { type: 'shift.declined';    companyId: string; entityId: string; data: ShiftDeclinedData;    recipientEmails: string[] }
  | { type: 'shift.running_late'; companyId: string; entityId: string; data: RunningLateData;    recipientEmails: string[] }
  | { type: 'incident.escalated'; companyId: string; entityId: string; data: IncidentEscalatedData; recipientEmails: string[] }

// ── Result ────────────────────────────────────────────────────────────────────

export interface NotificationResult {
  success:   boolean
  error?:    string
  skipped?:  boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getCompanyName(companyId: string): Promise<string> {
  const { data } = await adminClient
    .from('companies')
    .select('name')
    .eq('id', companyId)
    .maybeSingle()
  return (data?.name as string) ?? 'Your Company'
}

async function getCoordinatorEmails(companyId: string): Promise<string[]> {
  const { data } = await adminClient
    .from('profiles')
    .select('email')
    .eq('company_id', companyId)
    .in('role', ['admin', 'company_admin', 'coordinator', 'super_admin'])
    .limit(10)
  if (!data || data.length === 0) return []
  return (data as { email: string }[]).map((p) => p.email).filter(Boolean)
}

/** Compliance reminders go to owners/admins only — not coordinators. */
async function getAdminOnlyEmails(companyId: string): Promise<string[]> {
  const { data } = await adminClient
    .from('profiles')
    .select('email')
    .eq('company_id', companyId)
    .in('role', ['admin', 'company_admin', 'super_admin'])
    .limit(10)
  if (!data || data.length === 0) return []
  return (data as { email: string }[]).map((p) => p.email).filter(Boolean)
}

async function isPreferenceEnabled(
  companyId: string,
  field: 'decline_alerts_enabled' | 'incident_alerts_enabled' | 'compliance_alerts_enabled' | 'reminder_emails_enabled',
): Promise<boolean> {
  const { data } = await adminClient
    .from('company_notification_preferences')
    .select(field)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!data) return true // default on when no preferences row exists
  return (data as Record<string, boolean>)[field] ?? true
}

async function writeLog(params: {
  companyId:      string
  eventType:      NotificationEventType
  recipientEmail: string | null
  subject:        string | null
  status:         'sent' | 'failed' | 'skipped'
  errorMessage?:  string
  entityType?:    string
  entityId?:      string
}): Promise<void> {
  try {
    await adminClient.from('notification_logs').insert({
      company_id:      params.companyId,
      event_type:      params.eventType,
      recipient_email: params.recipientEmail,
      subject:         params.subject,
      status:          params.status,
      error_message:   params.errorMessage ?? null,
      entity_type:     params.entityType   ?? null,
      entity_id:       params.entityId     ?? null,
    })
  } catch (err) {
    console.error('[notifications] failed to write log:', err)
  }
}

async function sendEmail(params: {
  to:       string | string[]
  subject:  string
  html:     string
  text:     string
}): Promise<{ success: boolean; error?: string }> {
  const result = await centralSendEmail(params)
  if (!result.success) return { success: false, error: result.error }
  return { success: true }
}

// ── Main function ─────────────────────────────────────────────────────────────

export async function sendNotification(payload: NotificationPayload): Promise<NotificationResult> {
  const { type, companyId, entityId } = payload

  try {

    // ── shift.assigned ────────────────────────────────────────────────────────
    if (type === 'shift.assigned') {
      const { subject, html, text } = shiftAssignedTemplate(payload.data)
      const result = await sendEmail({ to: payload.recipientEmail, subject, html, text })
      await writeLog({
        companyId,
        eventType:      type,
        recipientEmail: payload.recipientEmail,
        subject,
        status:         result.success ? 'sent' : 'failed',
        errorMessage:   result.error,
        entityType:     'shift',
        entityId,
      })
      return result
    }

    // ── shift.declined ────────────────────────────────────────────────────────
    if (type === 'shift.declined') {
      const enabled = await isPreferenceEnabled(companyId, 'decline_alerts_enabled')
      if (!enabled) {
        await writeLog({ companyId, eventType: type, recipientEmail: null, subject: null, status: 'skipped', entityType: 'shift', entityId })
        return { success: true, skipped: true }
      }
      const recipients = payload.recipientEmails.length > 0
        ? payload.recipientEmails
        : await getCoordinatorEmails(companyId)
      if (recipients.length === 0) return { success: true, skipped: true }

      const { subject, html, text } = shiftDeclinedTemplate(payload.data)
      const result = await sendEmail({ to: recipients, subject, html, text })
      for (const email of recipients) {
        await writeLog({ companyId, eventType: type, recipientEmail: email, subject, status: result.success ? 'sent' : 'failed', errorMessage: result.error, entityType: 'shift', entityId })
      }
      return result
    }

    // ── shift.running_late ────────────────────────────────────────────────────
    if (type === 'shift.running_late') {
      const recipients = payload.recipientEmails.length > 0
        ? payload.recipientEmails
        : await getCoordinatorEmails(companyId)
      if (recipients.length === 0) return { success: true, skipped: true }

      const { subject, html, text } = runningLateTemplate(payload.data)
      const result = await sendEmail({ to: recipients, subject, html, text })
      for (const email of recipients) {
        await writeLog({ companyId, eventType: type, recipientEmail: email, subject, status: result.success ? 'sent' : 'failed', errorMessage: result.error, entityType: 'shift', entityId })
      }
      return result
    }

    // ── incident.escalated ────────────────────────────────────────────────────
    if (type === 'incident.escalated') {
      const enabled = await isPreferenceEnabled(companyId, 'incident_alerts_enabled')
      if (!enabled) {
        await writeLog({ companyId, eventType: type, recipientEmail: null, subject: null, status: 'skipped', entityType: 'incident', entityId })
        return { success: true, skipped: true }
      }
      const recipients = payload.recipientEmails.length > 0
        ? payload.recipientEmails
        : await getCoordinatorEmails(companyId)
      if (recipients.length === 0) return { success: true, skipped: true }

      const { subject, html, text } = incidentEscalatedTemplate(payload.data)
      const result = await sendEmail({ to: recipients, subject, html, text })
      for (const email of recipients) {
        await writeLog({ companyId, eventType: type, recipientEmail: email, subject, status: result.success ? 'sent' : 'failed', errorMessage: result.error, entityType: 'incident', entityId })
      }
      return result
    }

    return { success: false, error: `Unknown event type: ${String(type)}` }

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error(`[notifications] sendNotification error (${type}):`, errorMessage)
    try {
      await writeLog({ companyId, eventType: type, recipientEmail: null, subject: null, status: 'failed', errorMessage, entityType: 'shift', entityId })
    } catch { /* log write also failed — continue */ }
    return { success: false, error: errorMessage }
  }
}

// ── Re-export helpers for use in digest/reminder routes ───────────────────────
export { getCompanyName, getCoordinatorEmails, getAdminOnlyEmails, writeLog, sendEmail, APP_URL }
