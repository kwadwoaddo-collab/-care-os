import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { adminClient }   from '@/lib/supabase/admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id } = await params

  // Verify document belongs to this company
  const { data: doc } = await adminClient
    .from('documents')
    .select('id')
    .eq('id', id)
    .eq('company_id', auth.ctx.companyId)
    .single()

  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  const { data: history } = await adminClient
    .from('document_audit_log')
    .select('id, event, actor_type, actor_label, previous_value, new_value, metadata, created_at')
    .eq('document_id', id)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ history: history ?? [] })
}
