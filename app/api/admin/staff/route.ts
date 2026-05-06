import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'

// TODO: RESTORE AUTH — remove DEV_BYPASS_AUTH before deploying or merging to main.
const DEV_BYPASS_AUTH = process.env.NODE_ENV === 'development'

export async function GET() {
  if (!DEV_BYPASS_AUTH) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await adminClient
    .from('staff_profiles')
    .select('id, first_name, last_name, email, job_role, status, start_date, created_at, applicant_id, company_id')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin/staff] list error:', error.message)
    return NextResponse.json(
      { error: 'Failed to fetch staff', supabase_message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json(data ?? [])
}
