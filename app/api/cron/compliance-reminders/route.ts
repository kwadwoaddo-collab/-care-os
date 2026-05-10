import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
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

// ── Types ─────────────────────────────────────────────────────────────────────

interface CompanyResult {
  companyId:   string
  companyName: string
  status:      'sent' | 'skipped' | 'failed' | 'no_reminders' | 'no_recipients'
  reason?:     string
  sent?:       number
  counts?: {
    expired:      number
    expiringSoon: number
    missing:      number
    total:        number
  }
}

// ── Security guard ────────────────────────────────────────────────────────────

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  // No secret configured → deny all (fail-safe)
  if (!secret) return false
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

// ── Per-company send logic ────────────────────────────────────────────────────

async function processCompany(companyId: string): Promise<CompanyResult> {
  const companyName = await getCompanyName(companyId)

  // Check compliance_alerts_enabled preference
  const { data: prefs } = await adminClient
    .from('company_notification_preferences')
    .select('compliance_alerts_enabled')
    .eq('company_id', companyId)
    .maybeSingle()

  if (prefs && !(prefs as { compliance_alerts_enabled: boolean }).compliance_alerts_enabled) {
    return { companyId, companyName, status: 'skipped', reason: 'compliance_alerts_disabled' }
  }

  // Duplicate guard — skip if sent within last 24 hours
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: recentSend } = await adminClient
    .from('notification_logs')
    .select('id')
    .eq('company_id', companyId)
    .eq('event_type', 'compliance.digest')
    .eq('status', 'sent')
    .gte('created_at', cutoff)
    .limit(1)
    .maybeSingle()

  if (recentSend) {
    return { companyId, companyName, status: 'skipped', reason: 'sent_within_24h' }
  }

  // Gather reminders
  const reminders = await getAllReminders(companyId)

  if (reminders.length === 0) {
    return { companyId, companyName, status: 'no_reminders' }
  }

  const expired:      ReminderPayload[] = []
  const expiringSoon: ReminderPayload[] = []
  const missing:      ReminderPayload[] = []

  for (const r of reminders) {
    if (r.itemStatus === 'expired')            expired.push(r)
    else if (r.itemStatus === 'expiring_soon') expiringSoon.push(r)
    else if (r.itemStatus === 'missing')       missing.push(r)
  }

  // Recipients — admin and company_admin only
  const recipients = await getAdminOnlyEmails(companyId)

  if (recipients.length === 0) {
    return { companyId, companyName, status: 'no_recipients' }
  }

  const dateLabel = new Date().toLocaleDateString('en-GB', {
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

  const result = await sendEmail({ to: recipients, subject, html, text })

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

  if (!result.success) {
    return {
      companyId, companyName, status: 'failed',
      reason: result.error,
      counts: { expired: expired.length, expiringSoon: expiringSoon.length, missing: missing.length, total: reminders.length },
    }
  }

  return {
    companyId, companyName, status: 'sent',
    sent: recipients.length,
    counts: { expired: expired.length, expiringSoon: expiringSoon.length, missing: missing.length, total: reminders.length },
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

/**
 * GET /api/cron/compliance-reminders
 *
 * Vercel Cron endpoint — runs once daily at 07:00 UTC.
 * Iterates every company and sends a compliance reminder digest
 * to admin-only recipients, respecting per-company preferences and the
 * 24-hour duplicate guard.
 *
 * Security: requires Authorization: Bearer {CRON_SECRET}.
 * Vercel Cron sets this header automatically when CRON_SECRET is configured.
 *
 * Manual trigger (local or production):
 *   curl -X GET https://your-app.vercel.app/api/cron/compliance-reminders \
 *     -H "Authorization: Bearer $CRON_SECRET"
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = new Date().toISOString()

  // Fetch all companies
  const { data: companies, error: companiesError } = await adminClient
    .from('companies')
    .select('id, name')
    .order('created_at', { ascending: true })

  if (companiesError) {
    console.error('[cron/compliance-reminders] failed to fetch companies:', companiesError.message)
    return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 })
  }

  if (!companies || companies.length === 0) {
    return NextResponse.json({ processed: 0, results: [], startedAt })
  }

  const results: CompanyResult[] = []

  for (const company of companies) {
    try {
      const result = await processCompany(company.id as string)
      results.push(result)
      console.info('[cron/compliance-reminders]', {
        companyId:   company.id,
        companyName: company.name,
        status:      result.status,
        sent:        result.sent,
        counts:      result.counts,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[cron/compliance-reminders] error processing company', {
        companyId: company.id,
        error:     message,
      })
      results.push({
        companyId:   company.id as string,
        companyName: (company.name as string) ?? 'Unknown',
        status:      'failed',
        reason:      message,
      })
    }
  }

  const summary = {
    processed:   results.length,
    sent:        results.filter((r) => r.status === 'sent').length,
    skipped:     results.filter((r) => r.status === 'skipped').length,
    no_reminders:results.filter((r) => r.status === 'no_reminders').length,
    no_recipients:results.filter((r) => r.status === 'no_recipients').length,
    failed:      results.filter((r) => r.status === 'failed').length,
  }

  console.info('[cron/compliance-reminders] complete', { ...summary, startedAt })

  return NextResponse.json({ ...summary, startedAt, results })
}
