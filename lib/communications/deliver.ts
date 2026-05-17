import 'server-only'

import { adminClient } from '@/lib/supabase/admin'
import { createNotification } from '@/lib/notifications/createNotification'
import { sendEmail as centralSendEmail } from '@/lib/email/sendEmail'
import { emailShell } from '@/lib/notifications/templates/shell'

export type DeliveryChannel = 'in_app' | 'email' | 'multi'

export interface RecipientSpec {
  staffProfileId?: string
  profileId?:      string
  name:            string
  email?:          string
}

export interface MessageSpec {
  messageId:   string
  companyId:   string
  senderId:    string
  subject:     string
  body:        string
  messageType: string
  priority:    'normal' | 'urgent' | 'critical'
  channel:     DeliveryChannel
  entityType?: string
  entityId?:   string
  actionUrl?:  string
}

export interface DeliveryResult {
  sent:   number
  failed: number
  errors: string[]
}

/**
 * Deliver a message to a list of recipients via the configured channel(s).
 * - Creates message_recipients rows for tracking
 * - Fans out in_app_notifications via createNotification
 * - Sends email via centralSendEmail when channel includes email
 * - Updates message status to 'sent' when complete
 */
export async function deliverMessage(
  spec: MessageSpec,
  recipients: RecipientSpec[],
): Promise<DeliveryResult> {
  const result: DeliveryResult = { sent: 0, failed: 0, errors: [] }
  const now = new Date().toISOString()

  for (const r of recipients) {
    // ── in_app ────────────────────────────────────────────────────────────────
    if (spec.channel === 'in_app' || spec.channel === 'multi') {
      const eventType = messageTypeToEvent(spec.messageType)

      if (r.staffProfileId) {
        await createNotification({
          recipient:      'worker',
          staffProfileId: r.staffProfileId,
          companyId:      spec.companyId,
          eventType,
          title:          spec.subject,
          message:        spec.body.slice(0, 300),
          actionUrl:      spec.actionUrl,
          entityId:       spec.entityId,
          actorId:        spec.senderId,
        })
      } else if (r.profileId) {
        await createNotification({
          recipient:  'admin',
          companyId:  spec.companyId,
          eventType,
          title:      spec.subject,
          message:    spec.body.slice(0, 300),
          actionUrl:  spec.actionUrl,
          entityId:   spec.entityId,
          actorId:    spec.senderId,
        })
      }

      // Record in message_recipients
      await upsertRecipient({
        messageId:       spec.messageId,
        companyId:       spec.companyId,
        staffProfileId:  r.staffProfileId,
        profileId:       r.profileId,
        recipientName:   r.name,
        recipientEmail:  r.email,
        channel:         'in_app',
        status:          'sent',
        sentAt:          now,
      })
    }

    // ── email ─────────────────────────────────────────────────────────────────
    if ((spec.channel === 'email' || spec.channel === 'multi') && r.email) {
      const bodyHtml = `<h2 style="font-size:18px;font-weight:700;color:#111827;margin:0 0 16px">${spec.subject}</h2>
        <p style="font-size:14px;color:#374151;line-height:1.6">${spec.body.replace(/\n/g, '<br>')}</p>
        ${spec.actionUrl ? `<a href="${spec.actionUrl}" style="display:inline-block;margin-top:20px;background:#4f46e5;color:#fff;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none">View Details</a>` : ''}`
      const html = emailShell('Care OS', spec.subject, bodyHtml)
      const emailResult = await centralSendEmail({
        to:      r.email,
        subject: spec.subject,
        html,
        text:    spec.body,
      })

      await upsertRecipient({
        messageId:       spec.messageId,
        companyId:       spec.companyId,
        staffProfileId:  r.staffProfileId,
        profileId:       r.profileId,
        recipientName:   r.name,
        recipientEmail:  r.email,
        channel:         'email',
        status:          emailResult.success ? 'sent' : 'failed',
        sentAt:          emailResult.success ? now : undefined,
        errorMessage:    emailResult.success ? undefined : emailResult.error,
      })

      // Log to notification_logs (existing system)
      await adminClient.from('notification_logs').insert({
        company_id:      spec.companyId,
        event_type:      spec.messageType,
        recipient_email: r.email,
        subject:         spec.subject,
        status:          emailResult.success ? 'sent' : 'failed',
        error_message:   emailResult.success ? null : emailResult.error,
        entity_type:     spec.entityType ?? 'message',
        entity_id:       spec.entityId ?? null,
      })

      if (emailResult.success) {
        result.sent++
      } else {
        result.failed++
        result.errors.push(`Email to ${r.email}: ${emailResult.success === false ? emailResult.error : 'unknown error'}`)
      }
    } else if (spec.channel === 'in_app') {
      result.sent++
    }
  }

  // Update message row: status + recipient_count + sent_at
  await adminClient
    .from('operational_messages')
    .update({
      status:          result.failed === recipients.length ? 'failed' : 'sent',
      sent_at:         now,
      recipient_count: recipients.length,
      updated_at:      now,
    })
    .eq('id', spec.messageId)

  return result
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function messageTypeToEvent(messageType: string): Parameters<typeof createNotification>[0]['eventType'] {
  const map: Record<string, Parameters<typeof createNotification>[0]['eventType']> = {
    compliance_reminder:     'compliance_expiring',
    onboarding_reminder:     'onboarding_reminder',
    safeguarding_escalation: 'incident_created',
    shift_communication:     'shift_assigned',
    staffing_alert:          'compliance_alert',
    announcement:            'compliance_alert',
    broadcast:               'compliance_alert',
    thread_reply:            'compliance_alert',
  }
  return map[messageType] ?? 'compliance_alert'
}

interface RecipientRow {
  messageId:      string
  companyId:      string
  staffProfileId?: string
  profileId?:      string
  recipientName:   string
  recipientEmail?: string
  channel:         'in_app' | 'email' | 'sms'
  status:          'sent' | 'failed' | 'pending'
  sentAt?:         string
  errorMessage?:   string
}

async function upsertRecipient(r: RecipientRow): Promise<void> {
  try {
    await adminClient.from('message_recipients').insert({
      message_id:       r.messageId,
      company_id:       r.companyId,
      staff_profile_id: r.staffProfileId ?? null,
      profile_id:       r.profileId      ?? null,
      recipient_name:   r.recipientName,
      recipient_email:  r.recipientEmail ?? null,
      delivery_channel: r.channel,
      status:           r.status,
      sent_at:          r.sentAt ?? null,
      error_message:    r.errorMessage ?? null,
    })
  } catch (err) {
    console.error('[deliverMessage/upsertRecipient]', err)
  }
}
