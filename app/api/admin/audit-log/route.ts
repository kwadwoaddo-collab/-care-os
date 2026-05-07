import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'

// TODO: RESTORE AUTH — remove DEV_BYPASS_AUTH before deploying or merging to main.
const DEV_BYPASS_AUTH = process.env.NODE_ENV === 'development'

export async function GET(request: NextRequest) {
  if (!DEV_BYPASS_AUTH) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const action    = searchParams.get('action')    ?? ''
  const entityId  = searchParams.get('entity_id') ?? ''

  let query = adminClient
    .from('audit_logs')
    .select('id, created_at, action, actor_id, entity_type, entity_id, metadata')
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
