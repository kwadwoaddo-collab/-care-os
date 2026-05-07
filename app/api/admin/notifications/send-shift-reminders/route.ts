import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { getCompanyName, writeLog, sendEmail, APP_URL } from '@/lib/notifications/sendNotification'
import { shiftAssignedTemplate } from '@/lib/notifications/templates/shiftAssigned'

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const dryRun    = request.nextUrl.searchParams.get('dry_run') === 'true'
  const now       = new Date()
  const today     = now.toISOString().slice(0, 10)
  const tomorrow  = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const twoHours  = new Date(now.getTime() + 2  * 60 * 60 * 1000).toISOString().slice(11, 16)

  // ── Check preference ───────────────────────────────────────────────────────
  const { data: prefs } = await adminClient
    .from('company_notification_preferences')
    .select('reminder_emails_enabled')
    .eq('company_id', companyId)
    .maybeSingle()

  if (prefs && !(prefs as { reminder_emails_enabled: boolean }).reminder_emails_enabled && !dryRun) {
    return NextResponse.json({ message: 'Shift reminders disabled for this company' })
  }

  // ── Fetch tomorrow's shifts + shifts starting within 2 hours today ─────────
  const { data: shiftRows, error } = await adminClient
    .from('shifts')
    .select(`
      id, title, shift_date, start_time, end_time, client_name, location,
      clients!client_id ( first_name, last_name ),
      staff_profiles!assigned_staff_id ( id, first_name, last_name, email, receive_reminder_emails )
    `)
    .eq('company_id', companyId)
    .in('status', ['scheduled', 'confirmed'])
    .not('assigned_staff_id', 'is', null)
    .or(`shift_date.eq.${tomorrow},and(shift_date.eq.${today},start_time.lte.${twoHours})`)
    .order('shift_date')
    .order('start_time')

  if (error) {
    console.error('[send-shift-reminders] query error:', error.message)
    return NextResponse.json({ error: 'Failed to fetch shifts' }, { status: 500 })
  }

  const companyName = await getCompanyName(companyId)
  const results: { shiftId: string; workerEmail: string; status: string }[] = []

  type ShiftRow = {
    id: string; title: string; shift_date: string; start_time: string; end_time: string
    client_name: string | null; location: string | null
    clients:         { first_name: string; last_name: string }[]
    staff_profiles:  { id: string; first_name: string | null; last_name: string | null; email: string | null; receive_reminder_emails: boolean | null }[]
  }

  for (const raw of (shiftRows ?? []) as unknown as ShiftRow[]) {
    const staff = raw.staff_profiles?.[0]
    if (!staff?.email) continue
    if ((staff.receive_reminder_emails ?? true) === false) continue

    // Duplicate guard — skip if already sent a reminder for this shift in the last 12 hours
    const cutoff = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString()
    const { data: recentLog } = await adminClient
      .from('notification_logs')
      .select('id')
      .eq('entity_id', raw.id)
      .eq('event_type', 'shift.reminder')
      .eq('status', 'sent')
      .gte('created_at', cutoff)
      .maybeSingle()

    if (recentLog) {
      results.push({ shiftId: raw.id, workerEmail: staff.email, status: 'skipped_duplicate' })
      continue
    }

    const client     = raw.clients?.[0]
    const clientName = client ? `${client.first_name} ${client.last_name}` : raw.client_name
    const workerName = [staff.first_name, staff.last_name].filter(Boolean).join(' ') || 'Worker'
    const shiftDate  = new Date(raw.shift_date + 'T00:00:00').toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long',
    })

    const { subject, html, text } = shiftAssignedTemplate({
      companyName,
      workerName,
      shiftTitle:  raw.title,
      shiftDate,
      startTime:   raw.start_time.slice(0, 5),
      endTime:     raw.end_time.slice(0, 5),
      clientName,
      location:    raw.location,
      portalLink:  `${APP_URL}/worker/dashboard`,
    })

    const reminderSubject = `Shift reminder: ${raw.title} on ${shiftDate}`

    if (dryRun) {
      results.push({ shiftId: raw.id, workerEmail: staff.email, status: 'dry_run' })
      continue
    }

    const sendResult = await sendEmail({ to: staff.email, subject: reminderSubject, html, text })
    await writeLog({
      companyId,
      eventType:      'shift.reminder',
      recipientEmail: staff.email,
      subject:        reminderSubject,
      status:         sendResult.success ? 'sent' : 'failed',
      errorMessage:   sendResult.error,
      entityType:     'shift',
      entityId:       raw.id,
    })
    results.push({ shiftId: raw.id, workerEmail: staff.email, status: sendResult.success ? 'sent' : 'failed' })
  }

  return NextResponse.json({
    sent:    results.filter((r) => r.status === 'sent').length,
    skipped: results.filter((r) => r.status.startsWith('skipped')).length,
    failed:  results.filter((r) => r.status === 'failed').length,
    dry_run: dryRun,
    results,
  })
}
