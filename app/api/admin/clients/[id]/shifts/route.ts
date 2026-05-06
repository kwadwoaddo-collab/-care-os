import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'

const DEV_BYPASS_AUTH = process.env.NODE_ENV === 'development'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!DEV_BYPASS_AUTH) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const { data, error } = await adminClient
    .from('shifts')
    .select(`
      id, title, shift_date, start_time, end_time, status, assigned_staff_id,
      staff_profiles!assigned_staff_id (
        first_name, last_name, email
      )
    `)
    .eq('client_id', id)
    .order('shift_date', { ascending: false })
    .limit(20)

  if (error) {
    console.error('[admin/clients/[id]/shifts] GET error:', error.message)
    return NextResponse.json(
      { error: 'Failed to fetch shifts', supabase_message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json(data ?? [])
}
