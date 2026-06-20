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
    .select('id, title, shift_date, start_time, end_time, status, location, client_name, shift_type')
    .eq('assigned_staff_id', id)
    .eq('company_id', companyId)
    .order('shift_date', { ascending: false })
    .order('start_time', { ascending: false })
    .limit(10)

  if (error) {
    console.error('[admin/staff/[id]/shifts] GET error:', error.message)
    return NextResponse.json(
      { error: 'Failed to fetch shifts', supabase_message: error.message },
      { status: 500 }
    )
  }

  const shifts = data ?? []

  // ── Attach timesheet status for each shift (if one exists) ────────────────
  const timesheetStatusByShift: Record<string, string> = {}
  if (shifts.length > 0) {
    const shiftIds = shifts.map((s) => s.id)
    const { data: ts } = await adminClient
      .from('timesheets')
      .select('shift_id, status')
      .in('shift_id', shiftIds)
    for (const row of ts ?? []) {
      const r = row as { shift_id: string; status: string }
      timesheetStatusByShift[r.shift_id] = r.status
    }
  }

  const result = shifts.map((s) => ({
    ...s,
    timesheet_status: timesheetStatusByShift[s.id] ?? null,
  }))

  return NextResponse.json(result)
}
