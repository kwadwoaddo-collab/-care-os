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
    .from('shifts')
    .select(`
      id, title, shift_date, start_time, end_time, status, assigned_staff_id, care_package_id,
      staff_profiles!assigned_staff_id (
        first_name, last_name, email
      ),
      care_packages!care_package_id (
        id, title
      )
    `)
    .eq('client_id', id)
    .eq('company_id', companyId)
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
