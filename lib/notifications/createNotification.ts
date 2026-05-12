import 'server-only'

import { adminClient } from '@/lib/supabase/admin'

// ── Event types ───────────────────────────────────────────────────────────────
//
// Worker-facing events (staff_profile_id recipient)
// Admin-facing events  (profile_id recipients — all admins/coordinators in company)

export type InAppEventType =
  // Worker-facing
  | 'shift_offer'
  | 'shift_assigned'
  | 'shift_cancelled'
  | 'document_rejected'
  | 'onboarding_reminder'
  | 'policy_required'
  | 'compliance_expiring'
  // Admin-facing
  | 'shift_accepted'
  | 'shift_declined'
  | 'running_late'
  | 'shift_completed'
  | 'visit_note'
  | 'incident_created'
  | 'compliance_alert'
  | 'onboarding_completed'

// ── Payload types ─────────────────────────────────────────────────────────────

/** Notification targeted at a specific worker (staff_profiles row) */
export interface WorkerNotificationPayload {
  recipient:       'worker'
  staffProfileId:  string
  companyId:       string
  eventType:       InAppEventType
  title:           string
  message?:        string
  actionUrl?:      string
  entityId?:       string   // shift id, doc id, etc. — used for deduplication
  actorId?:        string   // admin profile.id who triggered the action
}

/** Notification fanned out to all admins/coordinators in the company */
export interface AdminNotificationPayload {
  recipient:  'admin'
  companyId:  string
  eventType:  InAppEventType
  title:      string
  message?:   string
  actionUrl?: string
  entityId?:  string   // entity id — used for deduplication
  actorId?:   string   // worker staff_profile_id who triggered the action
}

export type CreateNotificationPayload =
  | WorkerNotificationPayload
  | AdminNotificationPayload

// ── Result ────────────────────────────────────────────────────────────────────

export interface CreateNotificationResult {
  ok:        boolean
  skipped?:  boolean   // true if deduped
  count?:    number    // how many rows inserted (admin fan-out)
  error?:    string
}

// ── Dedupe window ─────────────────────────────────────────────────────────────
// Suppress identical unread notifications within this window to prevent spam.
const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000  // 24 hours

// ── Internal helpers ──────────────────────────────────────────────────────────

async function getAdminProfileIds(companyId: string): Promise<string[]> {
  const { data } = await adminClient
    .from('profiles')
    .select('id')
    .eq('company_id', companyId)
    .in('role', ['admin', 'company_admin', 'coordinator', 'super_admin'])
    .limit(20)
  return ((data ?? []) as { id: string }[]).map((p) => p.id)
}

async function isWorkerDupe(
  staffProfileId: string,
  eventType:      string,
  entityId:       string | undefined,
): Promise<boolean> {
  const since = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString()
  let q = adminClient
    .from('in_app_notifications')
    .select('id')
    .eq('staff_profile_id', staffProfileId)
    .eq('event_type', eventType)
    .is('read_at', null)
    .gte('created_at', since)
    .limit(1)

  if (entityId) {
    // action_url is our surrogate for entity_id — check it contains the id
    // We store entity_id in action_url so no schema change is required.
    // A loose match is fine for spam prevention.
    q = q.ilike('action_url', `%${entityId}%`)
  }

  const { data } = await q
  return Array.isArray(data) && data.length > 0
}

async function isAdminDupe(
  profileId: string,
  eventType: string,
  entityId:  string | undefined,
): Promise<boolean> {
  const since = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString()
  let q = adminClient
    .from('in_app_notifications')
    .select('id')
    .eq('profile_id', profileId)
    .eq('event_type', eventType)
    .is('read_at', null)
    .gte('created_at', since)
    .limit(1)

  if (entityId) {
    q = q.ilike('action_url', `%${entityId}%`)
  }

  const { data } = await q
  return Array.isArray(data) && data.length > 0
}

async function writeAuditLog(params: {
  companyId:  string
  eventType:  string
  entityId?:  string
  actorId?:   string
  recipientCount: number
}): Promise<void> {
  try {
    await adminClient.from('audit_logs').insert({
      company_id:  params.companyId,
      actor_id:    params.actorId ?? null,
      action:      'notification.created',
      entity_type: 'notification',
      entity_id:   params.entityId ?? null,
      metadata: {
        event_type:      params.eventType,
        recipient_count: params.recipientCount,
      },
    })
  } catch {
    // Audit log write failing must never surface to callers
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Creates one or more in-app notifications.
 *
 * - Worker notifications: one row, deduplicated per worker + event + entity
 * - Admin notifications: one row per admin/coordinator, each deduplicated
 *
 * Never throws — all errors are caught and returned as `{ ok: false, error }`.
 * Safe to call fire-and-forget: `void createNotification(...)`.
 */
export async function createNotification(
  payload: CreateNotificationPayload,
): Promise<CreateNotificationResult> {
  try {
    const {
      companyId, eventType, title, message, actionUrl, entityId, actorId,
    } = payload

    // ── Worker notification ────────────────────────────────────────────────
    if (payload.recipient === 'worker') {
      const { staffProfileId } = payload

      // Dedupe check
      const dupe = await isWorkerDupe(staffProfileId, eventType, entityId)
      if (dupe) {
        return { ok: true, skipped: true, count: 0 }
      }

      const { error } = await adminClient
        .from('in_app_notifications')
        .insert({
          company_id:       companyId,
          staff_profile_id: staffProfileId,
          profile_id:       null,
          title:            title.slice(0, 200),
          message:          message?.slice(0, 1000) ?? null,
          action_url:       actionUrl ?? null,
          event_type:       eventType,
        })

      if (error) {
        console.error('[createNotification/worker] insert error:', error.message)
        return { ok: false, error: error.message }
      }

      void writeAuditLog({ companyId, eventType, entityId, actorId, recipientCount: 1 })
      return { ok: true, count: 1 }
    }

    // ── Admin fan-out notification ─────────────────────────────────────────
    const adminIds = await getAdminProfileIds(companyId)
    if (adminIds.length === 0) {
      return { ok: true, skipped: true, count: 0 }
    }

    // Check dupes and build rows
    const rows: object[] = []
    for (const profileId of adminIds) {
      const dupe = await isAdminDupe(profileId, eventType, entityId)
      if (!dupe) {
        rows.push({
          company_id:       companyId,
          staff_profile_id: null,
          profile_id:       profileId,
          title:            title.slice(0, 200),
          message:          message?.slice(0, 1000) ?? null,
          action_url:       actionUrl ?? null,
          event_type:       eventType,
        })
      }
    }

    if (rows.length === 0) {
      return { ok: true, skipped: true, count: 0 }
    }

    const { error } = await adminClient
      .from('in_app_notifications')
      .insert(rows)

    if (error) {
      console.error('[createNotification/admin] insert error:', error.message)
      return { ok: false, error: error.message }
    }

    void writeAuditLog({ companyId, eventType, entityId, actorId, recipientCount: rows.length })
    return { ok: true, count: rows.length }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[createNotification] unexpected error:', msg)
    return { ok: false, error: msg }
  }
}
