import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import {
  getCompanyName,
  getCoordinatorEmails,
  writeLog,
  sendEmail,
  APP_URL,
} from '@/lib/notifications/sendNotification'
import { dailyDigestTemplate, type DigestShift } from '@/lib/notifications/templates/dailyDigest'
import { getAllReminders } from '@/lib/compliance/reminders'

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const dryRun = request.nextUrl.searchParams.get('dry_run') === 'true'
  const today  = new Date().toISOString().slice(0, 10)
  const in14   = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // ── Check preference ───────────────────────────────────────────────────────
  const { data: prefs } = await adminClient
    .from('company_notification_preferences')
    .select('daily_digest_enabled')
    .eq('company_id', companyId)
    .maybeSingle()

  if (prefs && !(prefs as { daily_digest_enabled: boolean }).daily_digest_enabled && !dryRun) {
    return NextResponse.json({ message: 'Daily digest disabled for this company' })
  }

  // ── Parallel data queries ─────────────────────────────────────────────────
  const [
    todayShiftsResult,
    unassignedResult,
    declinedResult,
    runningLateResult,
    draftNotesResult,
    openIncidentsResult,
    hrIncompleteResult,
  ] = await Promise.all([
    adminClient
      .from('shifts')
      .select(`id, title, start_time, end_time, status, client_name, assigned_staff_id, worker_ack_status,
        clients!client_id ( first_name, last_name ),
        staff_profiles!assigned_staff_id ( first_name, last_name )`)
      .eq('company_id', companyId)
      .eq('shift_date', today)
      .neq('status', 'cancelled')
      .order('start_time'),

    adminClient
      .from('shifts')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('shift_date', today)
      .is('assigned_staff_id', null)
      .neq('status', 'cancelled'),

    adminClient
      .from('shifts')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('shift_date', today)
      .lte('shift_date', in14)
      .eq('worker_ack_status', 'declined'),

    adminClient
      .from('shifts')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('shift_date', today)
      .eq('worker_ack_status', 'running_late'),

    adminClient
      .from('visit_notes')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'draft'),

    adminClient
      .from('incidents')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .in('status', ['open', 'investigating']),

    adminClient
      .from('staff_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('onboarding_completed', false)
      .not('status', 'eq', 'terminated'),
  ])

  type ShiftRow = {
    id: string; title: string; start_time: string; end_time: string
    client_name: string | null; worker_ack_status: string | null
    clients:         { first_name: string; last_name: string }[]
    staff_profiles:  { first_name: string | null; last_name: string | null }[]
  }

  const shifts: DigestShift[] = ((todayShiftsResult.data ?? []) as unknown as ShiftRow[]).map((s) => {
    const client  = s.clients?.[0]
    const staff   = s.staff_profiles?.[0]
    return {
      title:      s.title,
      time:       `${s.start_time.slice(0, 5)} – ${s.end_time.slice(0, 5)}`,
      clientName: client ? `${client.first_name} ${client.last_name}` : s.client_name,
      staffName:  staff  ? [staff.first_name, staff.last_name].filter(Boolean).join(' ') || null : null,
      status:     '',
      ackStatus:  s.worker_ack_status,
    }
  })

  const companyName = await getCompanyName(companyId)
  const dateLabel   = new Date(today + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  // Compliance counts — non-blocking; digest still sends if this fails
  let complianceExpired       = 0
  let complianceExpiringSoon  = 0
  let complianceMissing       = 0
  let complianceAffectedStaff = 0
  try {
    const reminders = await getAllReminders(companyId)
    complianceExpired      = reminders.filter((r) => r.itemStatus === 'expired').length
    complianceExpiringSoon = reminders.filter((r) => r.itemStatus === 'expiring_soon').length
    complianceMissing      = reminders.filter((r) => r.itemStatus === 'missing').length
    complianceAffectedStaff = new Set(reminders.map((r) => r.staffProfileId)).size
  } catch (err) {
    console.error('[daily-digest] compliance fetch failed (non-blocking):', err)
  }

  const digestData = {
    companyName,
    date:             dateLabel,
    totalShifts:      todayShiftsResult.data?.length ?? 0,
    unassignedShifts: unassignedResult.count    ?? 0,
    declinedShifts:   declinedResult.count      ?? 0,
    runningLate:      runningLateResult.count   ?? 0,
    draftNotes:       draftNotesResult.count    ?? 0,
    openIncidents:    openIncidentsResult.count ?? 0,
    hrIncomplete:     hrIncompleteResult.count  ?? 0,
    shifts,
    adminLink:        `${APP_URL}/admin`,
    complianceExpired,
    complianceExpiringSoon,
    complianceMissing,
    complianceAffectedStaff,
  }

  if (dryRun) {
    const { subject, text } = dailyDigestTemplate(digestData)
    return NextResponse.json({ dry_run: true, subject, preview_data: digestData, text_preview: text })
  }

  // ── Send to all coordinators ───────────────────────────────────────────────
  const recipients = await getCoordinatorEmails(companyId)
  if (recipients.length === 0) {
    return NextResponse.json({ message: 'No coordinator recipients found', sent: 0 })
  }

  const { subject, html, text } = dailyDigestTemplate(digestData)
  const result = await sendEmail({ to: recipients, subject, html, text })

  for (const email of recipients) {
    await writeLog({
      companyId,
      eventType:      'daily.digest',
      recipientEmail: email,
      subject,
      status:         result.success ? 'sent' : 'failed',
      errorMessage:   result.error,
    })
  }

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ sent: recipients.length, recipients, subject })
}
