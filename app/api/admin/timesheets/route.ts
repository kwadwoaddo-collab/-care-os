import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'

// TODO: RESTORE AUTH — remove DEV_BYPASS_AUTH before deploying or merging to main.
const DEV_BYPASS_AUTH = process.env.NODE_ENV === 'development'

export async function GET() {
  if (!DEV_BYPASS_AUTH) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await adminClient
    .from('timesheets')
    .select(`
      id, company_id, shift_id, staff_profile_id,
      scheduled_start, scheduled_end,
      clock_in, clock_out,
      break_minutes, worked_minutes,
      status, lateness_minutes, notes,
      created_at, updated_at,
      staff_profiles!staff_profile_id (
        id, first_name, last_name, email
      ),
      shifts!shift_id (
        id, title, shift_date, start_time, end_time
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin/timesheets] GET error:', error.message)
    return NextResponse.json(
      { error: 'Failed to fetch timesheets', supabase_message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json(data ?? [])
}
