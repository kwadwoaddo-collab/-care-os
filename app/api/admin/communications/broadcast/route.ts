import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/auth/permissions'
import { forbidden } from '@/lib/auth/responses'
import { deliverMessage, type RecipientSpec, type DeliveryChannel } from '@/lib/communications/deliver'
import { isSuppressed, recordSuppression } from '@/lib/communications/suppress'

// POST /api/admin/communications/broadcast
// Resolves the audience, creates the message row, and delivers to all recipients.

interface BroadcastBody {
  subject:         string
  body:            string
  message_type:    string
  priority:        'normal' | 'urgent' | 'critical'
  channel:         DeliveryChannel
  audience_type:   'all_staff' | 'by_role' | 'by_compliance_state' | 'by_shift_group' | 'by_onboarding_stage' | 'individual'
  audience_filter: {
    roles?:            string[]
    compliance_states?: string[]
    onboarding_stages?: string[]
    staff_ids?:        string[]
  }
  entity_type?:    string
  entity_id?:      string
  entity_url?:     string
  template_id?:    string
  suppress_hours?: number
  suppress_key?:   string
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'notifications:read')) return forbidden('Insufficient permissions')
  const { companyId, userId } = auth.ctx

  const body = await req.json() as BroadcastBody

  if (!body.subject || !body.body) {
    return NextResponse.json({ error: 'subject and body are required' }, { status: 400 })
  }

  // Suppression check
  if (body.suppress_key) {
    const suppressed = await isSuppressed(companyId, body.suppress_key)
    if (suppressed) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'suppressed', recipients: 0 })
    }
  }

  // Resolve sender name
  const { data: profile } = await adminClient
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', userId)
    .maybeSingle()
  const senderName = profile
    ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || 'Admin'
    : 'Admin'

  // Create message row (status=sending)
  const { data: message, error: msgErr } = await adminClient
    .from('operational_messages')
    .insert({
      company_id:      companyId,
      sender_id:       userId,
      sender_name:     senderName,
      subject:         body.subject.slice(0, 250),
      body:            body.body.slice(0, 5000),
      message_type:    body.message_type,
      priority:        body.priority,
      channel:         body.channel,
      audience_type:   body.audience_type,
      audience_filter: body.audience_filter ?? {},
      entity_type:     body.entity_type ?? null,
      entity_id:       body.entity_id   ?? null,
      entity_url:      body.entity_url  ?? null,
      template_id:     body.template_id ?? null,
      auto_generated:  false,
      status:          'sending',
    })
    .select()
    .single()

  if (msgErr || !message) {
    return NextResponse.json({ error: msgErr?.message ?? 'Failed to create message' }, { status: 500 })
  }

  // Resolve recipients
  const recipients: RecipientSpec[] = await resolveAudience(
    companyId,
    body.audience_type,
    body.audience_filter,
  )

  if (recipients.length === 0) {
    await adminClient.from('operational_messages').update({ status: 'sent', recipient_count: 0 }).eq('id', message.id)
    return NextResponse.json({ ok: true, message_id: message.id, recipients: 0 })
  }

  // Deliver
  const result = await deliverMessage(
    {
      messageId:   message.id,
      companyId,
      senderId:    userId,
      subject:     body.subject,
      body:        body.body,
      messageType: body.message_type,
      priority:    body.priority,
      channel:     body.channel,
      entityType:  body.entity_type,
      entityId:    body.entity_id,
      actionUrl:   body.entity_url,
    },
    recipients,
  )

  // Record suppression
  if (body.suppress_key && body.suppress_hours) {
    await recordSuppression(companyId, body.suppress_key, message.id, body.suppress_hours)
  }

  // Audit (fire-and-forget)
  void (async () => {
    try {
      await adminClient.from('audit_logs').insert({
        company_id:  companyId,
        actor_id:    userId,
        action:      'message.broadcast',
        entity_type: 'operational_message',
        entity_id:   message.id,
        metadata:    {
          message_type:  body.message_type,
          audience_type: body.audience_type,
          recipients:    recipients.length,
          sent:          result.sent,
          failed:        result.failed,
        },
      })
    } catch { /* non-blocking */ }
  })()

  return NextResponse.json({
    ok:         true,
    message_id: message.id,
    recipients: recipients.length,
    sent:       result.sent,
    failed:     result.failed,
    errors:     result.errors,
  })
}

// ── Audience resolution ───────────────────────────────────────────────────────

async function resolveAudience(
  companyId: string,
  audienceType: string,
  filter: BroadcastBody['audience_filter'],
): Promise<RecipientSpec[]> {
  const recipients: RecipientSpec[] = []

  if (audienceType === 'individual' && filter.staff_ids?.length) {
    const { data } = await adminClient
      .from('staff_profiles')
      .select('id, first_name, last_name, email')
      .eq('company_id', companyId)
      .in('id', filter.staff_ids)
    for (const s of data ?? []) {
      recipients.push({
        staffProfileId: s.id as string,
        name: `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim(),
        email: s.email as string | undefined,
      })
    }
    return recipients
  }

  if (audienceType === 'all_staff') {
    const { data } = await adminClient
      .from('staff_profiles')
      .select('id, first_name, last_name, email')
      .eq('company_id', companyId)
      .in('status', ['active', 'pre_employment'])
    for (const s of data ?? []) {
      recipients.push({
        staffProfileId: s.id as string,
        name: `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim(),
        email: s.email as string | undefined,
      })
    }
    return recipients
  }

  if (audienceType === 'by_role' && filter.roles?.length) {
    const { data } = await adminClient
      .from('profiles')
      .select('id, first_name, last_name, email')
      .eq('company_id', companyId)
      .in('role', filter.roles)
    for (const p of data ?? []) {
      recipients.push({
        profileId: p.id as string,
        name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim(),
        email: p.email as string | undefined,
      })
    }
    return recipients
  }

  if (audienceType === 'by_compliance_state' && filter.compliance_states?.length) {
    // Get staff profiles whose compliance has items in the given states
    const { data: compRows } = await adminClient
      .from('staff_compliance')
      .select('staff_profile_id')
      .eq('company_id', companyId)
      .in('status', filter.compliance_states)
    const staffIds = [...new Set((compRows ?? []).map(r => r.staff_profile_id as string))]
    if (staffIds.length > 0) {
      const { data } = await adminClient
        .from('staff_profiles')
        .select('id, first_name, last_name, email')
        .eq('company_id', companyId)
        .in('id', staffIds)
        .in('status', ['active', 'pre_employment'])
      for (const s of data ?? []) {
        recipients.push({
          staffProfileId: s.id as string,
          name: `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim(),
          email: s.email as string | undefined,
        })
      }
    }
    return recipients
  }

  if (audienceType === 'by_onboarding_stage' && filter.onboarding_stages?.length) {
    const { data } = await adminClient
      .from('staff_profiles')
      .select('id, first_name, last_name, email')
      .eq('company_id', companyId)
      .in('status', filter.onboarding_stages)
    for (const s of data ?? []) {
      recipients.push({
        staffProfileId: s.id as string,
        name: `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim(),
        email: s.email as string | undefined,
      })
    }
    return recipients
  }

  return recipients
}
