import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/auth/permissions'
import { forbidden } from '@/lib/auth/responses'
import { getAllReminders } from '@/lib/compliance/reminders'
import {
  getCompanyName,
  getAdminOnlyEmails,
  writeLog,
  sendEmail,
  APP_URL,
} from '@/lib/notifications/sendNotification'
import { complianceReminderDigestTemplate } from '@/lib/notifications/templates/complianceReminderDigest'
import type { ReminderPayload } from '@/lib/compliance/reminders'

/**
 * POST /api/admin/compliance/reminders/send
 *
 * Builds a compliance reminder digest and sends it to company_admin and
 * super_admin recipients only.
 *
 * Query params:
 *   ?dry_run=true  — renders the digest but skips sending
 *   ?force=true    — bypasses the 24-hour duplicate guard
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'compliance:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const dryRun = request.nextUrl.searchParams.get('dry_run') === 'true'
  const force  = request.nextUrl.searchParams.get('force')   === 'true'

  // ── Check compliance alerts preference ────────────────────────────────────
  const { data: prefs } = await adminClient
    .from('company_notification_preferences')
    .select('compliance_alerts_enabled')
    .eq('company_id', companyId)
    .maybeSingle()

  if (prefs && !(prefs as { compliance_alerts_enabled: boolean }).compliance_alerts_enabled && !dryRun) {
    return NextResponse.json({ message: 'Compliance alerts disabled for this company', skipped: true })
  }

  // ── Duplicate guard — prevent re-sending within 24 hours ─────────────────
  if (!dryRun && !force) {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: recentSend } = await adminClient
      .from('notification_logs')
      .select('id, created_at')
      .eq('company_id', companyId)
      .eq('event_type', 'compliance.digest')
      .eq('status', 'sent')
      .gte('created_at', cutoff)
      .limit(1)
      .maybeSingle()

    if (recentSend) {
      return NextResponse.json({
        message: 'Compliance reminders already sent in the last 24 hours. Use ?force=true to override.',
        skipped: true,
        lastSentAt: (recentSend as { created_at: string }).created_at,
      })
    }
  }

  // ── Gather reminders ──────────────────────────────────────────────────────
  const reminders = await getAllReminders(companyId)

  if (reminders.length === 0) {
    console.info('[compliance/reminders/send] no reminders to send', { companyId })
    return NextResponse.json({ message: 'No compliance reminders to send.', sent: 0, skipped: true })
  }

  const expired:      ReminderPayload[] = []
  const expiringSoon: ReminderPayload[] = []
  const missing:      ReminderPayload[] = []

  for (const r of reminders) {
    if (r.itemStatus === 'expired')            expired.push(r)
    else if (r.itemStatus === 'expiring_soon') expiringSoon.push(r)
    else if (r.itemStatus === 'missing')       missing.push(r)
  }

  const companyName = await getCompanyName(companyId)
  const dateLabel   = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const { subject, html, text } = complianceReminderDigestTemplate({
    companyName,
    date: dateLabel,
    expired,
    expiringSoon,
    missing,
    adminLink: `${APP_URL}/admin/compliance`,
  })

  // ── Dry-run path ──────────────────────────────────────────────────────────
  if (dryRun) {
    console.info('[compliance/reminders/send] dry_run', {
      companyId,
      expired:      expired.length,
      expiringSoon: expiringSoon.length,
      missing:      missing.length,
      subject,
    })
    return NextResponse.json({
      dry_run:      true,
      subject,
      text_preview: text,
      counts: {
        expired:      expired.length,
        expiringSoon: expiringSoon.length,
        missing:      missing.length,
        total:        reminders.length,
      },
    })
  }

  // ── Recipients — admin and company_admin only ─────────────────────────────
  const recipients = await getAdminOnlyEmails(companyId)

  if (recipients.length === 0) {
    console.warn('[compliance/reminders/send] no admin recipients found', { companyId })
    return NextResponse.json({ message: 'No admin recipients found.', sent: 0, skipped: true })
  }

  // ── Send ──────────────────────────────────────────────────────────────────
  const result = await sendEmail({ to: recipients, subject, html, text })

  // ── Log one entry per recipient ───────────────────────────────────────────
  for (const email of recipients) {
    await writeLog({
      companyId,
      eventType:      'compliance.digest',
      recipientEmail: email,
      subject,
      status:         result.success ? 'sent' : 'failed',
      errorMessage:   result.error,
      entityType:     'compliance',
      entityId:       companyId,
    })
  }

  console.info('[compliance/reminders/send]', {
    companyId,
    expired:      expired.length,
    expiringSoon: expiringSoon.length,
    missing:      missing.length,
    recipients:   recipients.length,
    status:       result.success ? 'sent' : 'failed',
    error:        result.error,
  })

  if (!result.success) {
    return NextResponse.json(
      { error: result.error, sent: 0 },
      { status: 500 },
    )
  }

  return NextResponse.json({
    sent:       recipients.length,
    recipients,
    subject,
    counts: {
      expired:      expired.length,
      expiringSoon: expiringSoon.length,
      missing:      missing.length,
      total:        reminders.length,
    },
  })
}
