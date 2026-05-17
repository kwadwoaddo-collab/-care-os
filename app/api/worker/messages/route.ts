import { NextRequest, NextResponse } from 'next/server'
import { adminClient }         from '@/lib/supabase/admin'
import { validateWorkerToken } from '@/lib/worker/auth'

// GET /api/worker/messages?token=xxx
// Returns operational messages targeted at the authenticated worker.
// Includes both in_app_notifications (existing) and message_recipients rows
// from operational_messages for a unified worker inbox.

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')

  const result = await validateWorkerToken(token)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const { id: staffProfileId, company_id: companyId } = result.worker

  // Fetch operational messages addressed to this worker
  const { data: recipientRows } = await adminClient
    .from('message_recipients')
    .select('message_id, status, sent_at, read_at, acknowledged_at')
    .eq('staff_profile_id', staffProfileId)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(50)

  const messageIds = (recipientRows ?? []).map(r => r.message_id as string)

  let operationalMessages: unknown[] = []
  if (messageIds.length > 0) {
    const { data } = await adminClient
      .from('operational_messages')
      .select('id, subject, body, message_type, priority, sent_at, entity_url, created_at')
      .in('id', messageIds)
      .eq('status', 'sent')
      .order('created_at', { ascending: false })

    operationalMessages = (data ?? []).map(m => {
      const recip = recipientRows?.find(r => r.message_id === m.id)
      return {
        ...m,
        delivery_status: recip?.status ?? 'sent',
        read_at:         recip?.read_at ?? null,
        acknowledged_at: recip?.acknowledged_at ?? null,
        source:          'operational',
      }
    })
  }

  // Also fetch regular in_app_notifications
  const { data: inAppRows } = await adminClient
    .from('in_app_notifications')
    .select('id, title, message, action_url, event_type, read_at, created_at')
    .eq('staff_profile_id', staffProfileId)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(20)

  const inAppMessages = (inAppRows ?? []).map(n => ({
    id:              n.id,
    subject:         n.title,
    body:            n.message ?? '',
    message_type:    n.event_type,
    priority:        'normal',
    sent_at:         n.created_at,
    entity_url:      n.action_url,
    created_at:      n.created_at,
    read_at:         n.read_at,
    acknowledged_at: null,
    delivery_status: n.read_at ? 'read' : 'sent',
    source:          'in_app',
  }))

  // Merge and sort by created_at desc
  const all = [...operationalMessages as object[], ...inAppMessages]
    .sort((a, b) => new Date((b as Record<string, string>).created_at).getTime() - new Date((a as Record<string, string>).created_at).getTime())
    .slice(0, 60)

  const unreadCount = all.filter(m => !(m as Record<string, unknown>).read_at).length

  return NextResponse.json({ messages: all, unread_count: unreadCount })
}

// PATCH /api/worker/messages?token=xxx — mark a message as read
export async function PATCH(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')

  const result = await validateWorkerToken(token)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const { id: staffProfileId, company_id: companyId } = result.worker
  const body = await req.json().catch(() => ({})) as { message_id?: string; source?: string }
  const now = new Date().toISOString()

  if (body.source === 'operational' && body.message_id) {
    await adminClient
      .from('message_recipients')
      .update({ status: 'read', read_at: now })
      .eq('message_id', body.message_id)
      .eq('staff_profile_id', staffProfileId)
      .eq('company_id', companyId)
      .is('read_at', null)
  } else {
    // Mark all in_app_notifications as read
    let q = adminClient
      .from('in_app_notifications')
      .update({ read_at: now })
      .eq('staff_profile_id', staffProfileId)
      .eq('company_id', companyId)
      .is('read_at', null)

    if (body.message_id) q = q.eq('id', body.message_id)
    await q
  }

  return NextResponse.json({ ok: true })
}
