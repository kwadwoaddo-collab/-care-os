import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/auth/permissions'
import { forbidden } from '@/lib/auth/responses'

// GET — delivery status per recipient for a message
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'notifications:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const { id: messageId } = await params

  const { data, error } = await adminClient
    .from('message_recipients')
    .select('*')
    .eq('message_id', messageId)
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = data ?? []
  const summary = {
    total:        rows.length,
    sent:         rows.filter(r => ['sent', 'delivered', 'read', 'acknowledged'].includes(r.status)).length,
    read:         rows.filter(r => ['read', 'acknowledged'].includes(r.status)).length,
    acknowledged: rows.filter(r => r.status === 'acknowledged').length,
    failed:       rows.filter(r => r.status === 'failed').length,
    pending:      rows.filter(r => r.status === 'pending').length,
  }

  return NextResponse.json({ recipients: rows, summary })
}

// PATCH — worker/admin acknowledges a message
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId, userId } = auth.ctx

  const { id: messageId } = await params
  const body = await req.json().catch(() => ({}))
  const { recipient_id } = body as { recipient_id?: string }

  let q = adminClient
    .from('message_recipients')
    .update({
      status:           'acknowledged',
      acknowledged_at:  new Date().toISOString(),
      read_at:          new Date().toISOString(),
    })
    .eq('message_id', messageId)
    .eq('company_id', companyId)

  if (recipient_id) {
    q = q.eq('id', recipient_id)
  } else {
    // Acknowledge by profile_id
    q = q.eq('profile_id', userId)
  }

  const { error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
