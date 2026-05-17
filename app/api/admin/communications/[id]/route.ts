import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/auth/permissions'
import { forbidden } from '@/lib/auth/responses'

// ── GET — message detail + thread + delivery stats ────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'notifications:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const { id } = await params

  const [msgRes, recipientsRes, repliesRes] = await Promise.all([
    adminClient
      .from('operational_messages')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle(),
    adminClient
      .from('message_recipients')
      .select('*')
      .eq('message_id', id)
      .order('created_at', { ascending: true })
      .limit(200),
    adminClient
      .from('operational_messages')
      .select('*')
      .eq('thread_id', id)
      .eq('company_id', companyId)
      .order('created_at', { ascending: true })
      .limit(50),
  ])

  if (!msgRes.data) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  // Delivery stats
  const recipients = recipientsRes.data ?? []
  const stats = {
    total:        recipients.length,
    sent:         recipients.filter(r => ['sent', 'delivered', 'read', 'acknowledged'].includes(r.status)).length,
    read:         recipients.filter(r => ['read', 'acknowledged'].includes(r.status)).length,
    acknowledged: recipients.filter(r => r.status === 'acknowledged').length,
    failed:       recipients.filter(r => r.status === 'failed').length,
  }

  return NextResponse.json({
    message:    msgRes.data,
    recipients,
    replies:    repliesRes.data ?? [],
    stats,
  })
}

// ── DELETE — soft-cancel a draft ──────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'notifications:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const { id } = await params

  const { data: msg } = await adminClient
    .from('operational_messages')
    .select('status')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!msg) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (msg.status !== 'draft') return NextResponse.json({ error: 'Only drafts can be deleted' }, { status: 409 })

  await adminClient
    .from('operational_messages')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId)

  return NextResponse.json({ ok: true })
}
