import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

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
    .eq('company_id', companyId)
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
