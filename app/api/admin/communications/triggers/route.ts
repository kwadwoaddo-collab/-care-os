import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/auth/permissions'
import { forbidden } from '@/lib/auth/responses'
import { isSuppressed, recordSuppression, complianceSuppressKey, onboardingSuppressKey, shiftCoverageSuppressKey } from '@/lib/communications/suppress'
import { deliverMessage } from '@/lib/communications/deliver'

// POST /api/admin/communications/triggers
// Smart messaging trigger: scans for conditions and auto-creates messages.
// Safe to call from cron or admin UI. Uses suppression to prevent duplicates.

export interface TriggerResult {
  compliance_expiry:   number
  onboarding_stall:    number
  uncovered_shifts:    number
  safeguarding_alerts: number
  skipped:             number
  errors:              string[]
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'notifications:read')) return forbidden('Insufficient permissions')
  const { companyId, userId } = auth.ctx

  const body = await req.json().catch(() => ({}))
  const dry = (body as { dry_run?: boolean }).dry_run === true

  const result: TriggerResult = {
    compliance_expiry:   0,
    onboarding_stall:    0,
    uncovered_shifts:    0,
    safeguarding_alerts: 0,
    skipped:             0,
    errors:              [],
  }

  const in30days  = new Date(Date.now() + 30 * 86400_000).toISOString()
  const cutoff30  = new Date(Date.now() - 30 * 86400_000).toISOString()

  // ── 1. Compliance expiries ─────────────────────────────────────────────────
  try {
    const { data: expiring } = await adminClient
      .from('staff_compliance')
      .select('staff_profile_id, check_type, expires_at, staff_profiles!staff_profile_id(first_name, last_name, email)')
      .eq('company_id', companyId)
      .eq('status', 'complete')
      .not('expires_at', 'is', null)
      .lt('expires_at', in30days)
      .gt('expires_at', new Date().toISOString())
      .limit(50)

    for (const row of expiring ?? []) {
      const staffId   = row.staff_profile_id as string
      const checkType = row.check_type as string
      const key       = complianceSuppressKey(staffId, checkType)

      if (await isSuppressed(companyId, key)) { result.skipped++; continue }
      if (dry) { result.compliance_expiry++; continue }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sp = (row as any).staff_profiles
      const staff = Array.isArray(sp) ? sp[0] : sp
      const name = staff ? `${staff.first_name ?? ''} ${staff.last_name ?? ''}`.trim() : 'Staff member'
      const expDate = new Date(row.expires_at as string).toLocaleDateString('en-GB')

      const { data: msg } = await adminClient.from('operational_messages').insert({
        company_id:    companyId,
        sender_id:     userId,
        sender_name:   'Care OS',
        subject:       `Action required: ${checkType.toUpperCase()} expiring on ${expDate}`,
        body:          `Hi ${name},\n\nYour ${checkType} is due to expire on ${expDate}. Please take action to renew it.\n\nLog into your portal to upload your updated document.`,
        message_type:  'compliance_reminder',
        priority:      'urgent',
        channel:       'multi',
        audience_type: 'individual',
        auto_generated: true,
        trigger_type:  'compliance_expiry',
        status:        'sending',
      }).select().single()

      if (msg) {
        await deliverMessage(
          { messageId: msg.id, companyId, senderId: userId, subject: msg.subject, body: msg.body, messageType: 'compliance_reminder', priority: 'urgent', channel: 'multi' },
          [{ staffProfileId: staffId, name, email: staff?.email }],
        )
        await recordSuppression(companyId, key, msg.id, 24)
        result.compliance_expiry++
      }
    }
  } catch (e) { result.errors.push(`compliance_expiry: ${String(e)}`) }

  // ── 2. Onboarding stalls (pre_employment > 30 days) ───────────────────────
  try {
    const { data: stalled } = await adminClient
      .from('staff_profiles')
      .select('id, first_name, last_name, email')
      .eq('company_id', companyId)
      .eq('status', 'pre_employment')
      .lt('created_at', cutoff30)
      .limit(20)

    for (const staff of stalled ?? []) {
      const key = onboardingSuppressKey(staff.id as string)
      if (await isSuppressed(companyId, key)) { result.skipped++; continue }
      if (dry) { result.onboarding_stall++; continue }

      const name = `${staff.first_name ?? ''} ${staff.last_name ?? ''}`.trim()
      const { data: msg } = await adminClient.from('operational_messages').insert({
        company_id:    companyId,
        sender_id:     userId,
        sender_name:   'Care OS',
        subject:       'Complete your onboarding — outstanding tasks',
        body:          `Hi ${name},\n\nYour onboarding has been outstanding for more than 30 days. Please log into your worker portal to complete the required steps.`,
        message_type:  'onboarding_reminder',
        priority:      'urgent',
        channel:       'multi',
        audience_type: 'individual',
        auto_generated: true,
        trigger_type:  'onboarding_stall',
        status:        'sending',
      }).select().single()

      if (msg) {
        await deliverMessage(
          { messageId: msg.id, companyId, senderId: userId, subject: msg.subject, body: msg.body, messageType: 'onboarding_reminder', priority: 'urgent', channel: 'multi' },
          [{ staffProfileId: staff.id as string, name, email: staff.email as string | undefined }],
        )
        await recordSuppression(companyId, key, msg.id, 72)
        result.onboarding_stall++
      }
    }
  } catch (e) { result.errors.push(`onboarding_stall: ${String(e)}`) }

  // ── 3. Uncovered shifts ───────────────────────────────────────────────────
  try {
    const tomorrow = new Date(Date.now() + 48 * 3600_000).toISOString().slice(0, 10)
    const { data: uncovered } = await adminClient
      .from('shifts')
      .select('id, title, shift_date, start_time')
      .eq('company_id', companyId)
      .eq('status', 'scheduled')
      .is('assigned_staff_id', null)
      .lte('shift_date', tomorrow)
      .limit(20)

    for (const shift of uncovered ?? []) {
      const key = shiftCoverageSuppressKey(shift.id as string)
      if (await isSuppressed(companyId, key)) { result.skipped++; continue }
      if (dry) { result.uncovered_shifts++; continue }

      const { data: admins } = await adminClient
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('company_id', companyId)
        .in('role', ['company_admin', 'coordinator', 'registered_manager'])
        .limit(5)

      const { data: msg } = await adminClient.from('operational_messages').insert({
        company_id:    companyId,
        sender_id:     userId,
        sender_name:   'Care OS',
        subject:       `Uncovered shift: ${shift.title ?? 'Unnamed'} on ${shift.shift_date}`,
        body:          `A shift scheduled for ${shift.shift_date} at ${shift.start_time} has no assigned staff. Please assign a worker as soon as possible.`,
        message_type:  'staffing_alert',
        priority:      'urgent',
        channel:       'in_app',
        audience_type: 'by_role',
        auto_generated: true,
        trigger_type:  'uncovered_shift',
        entity_type:   'shift',
        entity_id:     shift.id as string,
        status:        'sending',
      }).select().single()

      if (msg) {
        const adminRecipients = (admins ?? []).map(a => ({
          profileId: a.id as string,
          name: `${a.first_name ?? ''} ${a.last_name ?? ''}`.trim(),
          email: a.email as string | undefined,
        }))
        await deliverMessage(
          { messageId: msg.id, companyId, senderId: userId, subject: msg.subject, body: msg.body, messageType: 'staffing_alert', priority: 'urgent', channel: 'in_app', entityType: 'shift', entityId: shift.id as string },
          adminRecipients,
        )
        await recordSuppression(companyId, key, msg.id, 6)
        result.uncovered_shifts++
      }
    }
  } catch (e) { result.errors.push(`uncovered_shifts: ${String(e)}`) }

  // ── 4. Safeguarding alerts ────────────────────────────────────────────────
  try {
    const { data: incidents } = await adminClient
      .from('incidents')
      .select('id, incident_type, severity, occurred_at')
      .eq('company_id', companyId)
      .in('severity', ['critical', 'high'])
      .in('status', ['open', 'investigating'])
      .is('escalation_triggered_at', null)
      .limit(10)

    for (const inc of incidents ?? []) {
      const key = `safeguarding:${inc.id}`
      if (await isSuppressed(companyId, key)) { result.skipped++; continue }
      if (dry) { result.safeguarding_alerts++; continue }

      const { data: managers } = await adminClient
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('company_id', companyId)
        .in('role', ['registered_manager', 'company_admin'])
        .limit(5)

      const { data: msg } = await adminClient.from('operational_messages').insert({
        company_id:    companyId,
        sender_id:     userId,
        sender_name:   'Care OS',
        subject:       `URGENT: ${inc.severity?.toUpperCase()} severity ${inc.incident_type} requires attention`,
        body:          `A ${inc.severity} severity incident (${inc.incident_type}) is open and requires your immediate attention.\n\nPlease review and escalate as appropriate.`,
        message_type:  'safeguarding_escalation',
        priority:      'critical',
        channel:       'multi',
        audience_type: 'by_role',
        auto_generated: true,
        trigger_type:  'safeguarding_alert',
        entity_type:   'incident',
        entity_id:     inc.id as string,
        status:        'sending',
      }).select().single()

      if (msg) {
        const mgRecipients = (managers ?? []).map(m => ({
          profileId: m.id as string,
          name: `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim(),
          email: m.email as string | undefined,
        }))
        await deliverMessage(
          { messageId: msg.id, companyId, senderId: userId, subject: msg.subject, body: msg.body, messageType: 'safeguarding_escalation', priority: 'critical', channel: 'multi', entityType: 'incident', entityId: inc.id as string },
          mgRecipients,
        )
        await recordSuppression(companyId, key, msg.id, 4)
        result.safeguarding_alerts++
      }
    }
  } catch (e) { result.errors.push(`safeguarding_alerts: ${String(e)}`) }

  return NextResponse.json({ ok: true, dry_run: dry, ...result })
}
