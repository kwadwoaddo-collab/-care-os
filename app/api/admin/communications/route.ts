import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/auth/permissions'
import { forbidden } from '@/lib/auth/responses'

export interface OperationalMessage {
  id:              string
  company_id:      string
  sender_id:       string | null
  sender_name:     string
  subject:         string
  body:            string
  message_type:    string
  priority:        string
  channel:         string
  audience_type:   string
  audience_filter: Record<string, unknown>
  thread_id:       string | null
  parent_id:       string | null
  entity_type:     string | null
  entity_id:       string | null
  entity_url:      string | null
  auto_generated:  boolean
  trigger_type:    string | null
  status:          string
  sent_at:         string | null
  recipient_count: number
  created_at:      string
  updated_at:      string
}

// ── GET — list messages ───────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'notifications:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const sp          = req.nextUrl.searchParams
  const type        = sp.get('type') ?? ''
  const priority    = sp.get('priority') ?? ''
  const status      = sp.get('status') ?? ''
  const threadId    = sp.get('thread_id') ?? ''
  const limit       = Math.min(parseInt(sp.get('limit') ?? '50'), 200)

  let q = adminClient
    .from('operational_messages')
    .select('*')
    .eq('company_id', companyId)
    .is('thread_id', null)   // top-level messages only by default
    .order('created_at', { ascending: false })
    .limit(limit)

  if (type)     q = q.eq('message_type', type)
  if (priority) q = q.eq('priority', priority)
  if (status)   q = q.eq('status', status)
  if (threadId) {
    // Fetch thread replies instead
    q = adminClient
      .from('operational_messages')
      .select('*')
      .eq('company_id', companyId)
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(100)
  }

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Attach reply count per message
  const messages = data ?? []
  const withCounts = await Promise.all(messages.map(async (m) => {
    const { count } = await adminClient
      .from('operational_messages')
      .select('*', { count: 'exact', head: true })
      .eq('thread_id', m.id)
    return { ...m, reply_count: count ?? 0 }
  }))

  return NextResponse.json({ messages: withCounts, total: withCounts.length })
}

// ── POST — create a message (draft or send immediately) ───────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'notifications:read')) return forbidden('Insufficient permissions')
  const { companyId, userId } = auth.ctx

  const body = await req.json()
  const {
    subject, body: msgBody, message_type = 'announcement', priority = 'normal',
    channel = 'in_app', audience_type = 'individual', audience_filter = {},
    entity_type, entity_id, entity_url, template_id, thread_id, parent_id,
    sender_name,
  } = body

  if (!subject || !msgBody) {
    return NextResponse.json({ error: 'subject and body are required' }, { status: 400 })
  }

  const { data: profile } = await adminClient
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', userId)
    .maybeSingle()
  const resolvedSenderName = sender_name
    ?? (profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() : 'Admin')

  const { data, error } = await adminClient
    .from('operational_messages')
    .insert({
      company_id:      companyId,
      sender_id:       userId,
      sender_name:     resolvedSenderName,
      subject:         subject.slice(0, 250),
      body:            msgBody.slice(0, 5000),
      message_type,
      priority,
      channel,
      audience_type,
      audience_filter,
      entity_type:     entity_type ?? null,
      entity_id:       entity_id   ?? null,
      entity_url:      entity_url  ?? null,
      template_id:     template_id ?? null,
      thread_id:       thread_id   ?? null,
      parent_id:       parent_id   ?? null,
      auto_generated:  false,
      status:          'draft',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Audit (fire-and-forget)
  void (async () => {
    try {
      await adminClient.from('audit_logs').insert({
        company_id:  companyId,
        actor_id:    userId,
        action:      'message.created',
        entity_type: 'operational_message',
        entity_id:   data.id,
        metadata:    { message_type, subject, audience_type },
      })
    } catch { /* non-blocking */ }
  })()

  return NextResponse.json({ message: data }, { status: 201 })
}
