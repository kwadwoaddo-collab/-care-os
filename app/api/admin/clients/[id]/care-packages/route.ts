import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const { id } = await params

  const { data, error } = await adminClient
    .from('care_packages')
    .select(`
      id, title, status, weekly_hours, start_date, end_date, funding_type,
      care_package_visits (
        id, day_of_week, start_time, end_time, shift_type,
        requires_driver, requires_double_up
      )
    `)
    .eq('client_id', id)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin/clients/[id]/care-packages] GET error:', error.message)
    return NextResponse.json(
      { error: 'Failed to fetch care packages', supabase_message: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json(data ?? [])
}
