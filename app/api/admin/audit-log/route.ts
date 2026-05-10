import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/auth/permissions'
import { forbidden } from '@/lib/auth/responses'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'audit_log:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const { searchParams } = new URL(request.url)
  const action    = searchParams.get('action')    ?? ''
  const entityId  = searchParams.get('entity_id') ?? ''

  let query = adminClient
    .from('audit_logs')
    .select('id, created_at, action, actor_id, entity_type, entity_id, metadata')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (action)   query = query.ilike('action',    `%${action}%`)
  if (entityId) query = query.eq('entity_id', entityId)

  const { data, error } = await query

  if (error) {
    console.error('[audit-log] fetch error:', error.message)
    return NextResponse.json({ error: 'Failed to fetch audit log' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
