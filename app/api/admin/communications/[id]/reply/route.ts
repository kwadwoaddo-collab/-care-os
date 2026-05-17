import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/auth/permissions'
import { forbidden } from '@/lib/auth/responses'

// POST /api/admin/communications/[id]/reply
// Adds a reply to a message thread, notifies original recipients.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'notifications:read')) return forbidden('Insufficient permissions')
  const { companyId, userId } = auth.ctx

  const { id: threadId } = await params

  // Confirm the thread root exists
  const { data: root } = await adminClient
    .from('operational_messages')
    .select('id, subject, company_id')
    .eq('id', threadId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!root) return NextResponse.json({ error: 'Thread not found' }, { status: 404 })

  const body = await req.json()
  const { message: replyBody, sender_name } = body

  if (!replyBody) return NextResponse.json({ error: 'message is required' }, { status: 400 })

  const { data: profile } = await adminClient
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', userId)
    .maybeSingle()
  const resolvedSenderName = sender_name
    ?? (profile ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() : 'Admin')

  const { data: reply, error } = await adminClient
    .from('operational_messages')
    .insert({
      company_id:    companyId,
      sender_id:     userId,
      sender_name:   resolvedSenderName,
      subject:       `Re: ${root.subject}`,
      body:          replyBody.slice(0, 5000),
      message_type:  'thread_reply',
      priority:      'normal',
      channel:       'in_app',
      audience_type: 'individual',
      thread_id:     threadId,
      parent_id:     threadId,
      auto_generated: false,
      status:        'sent',
      sent_at:       new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ reply }, { status: 201 })
}
