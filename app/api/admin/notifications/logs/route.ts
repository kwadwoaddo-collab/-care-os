import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const sp         = request.nextUrl.searchParams
  const status     = sp.get('status')     ?? ''
  const eventType  = sp.get('event_type') ?? ''

  let query = adminClient
    .from('notification_logs')
    .select('id, company_id, event_type, recipient_email, subject, status, error_message, entity_type, entity_id, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (status)    query = query.eq('status',     status)
  if (eventType) query = query.eq('event_type', eventType)

  const { data, error } = await query

  if (error) {
    console.error('[notifications/logs] fetch error:', error.message)
    return NextResponse.json({ error: 'Failed to fetch notification logs' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
