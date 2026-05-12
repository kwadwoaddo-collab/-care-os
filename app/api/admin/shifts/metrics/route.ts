import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  // Compute shift operational KPIs: completion rate, late rate, no-show rate
  // for the current month
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)

  const { data: shifts, error } = await adminClient
    .from('shifts')
    .select('status, worker_ack_status')
    .eq('company_id', companyId)
    .gte('shift_date', firstDay)
    .lte('shift_date', lastDay)
    .neq('status', 'cancelled')

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 })
  }

  let total = 0
  let completed = 0
  let late = 0
  let missed = 0

  for (const s of shifts ?? []) {
    total++
    if (s.status === 'completed') completed++
    if (s.worker_ack_status === 'running_late') late++
    if (s.status === 'missed') missed++
  }

  const kpis = {
    total_shifts: total,
    completion_rate: total > 0 ? (completed / total) * 100 : 0,
    late_rate: total > 0 ? (late / total) * 100 : 0,
    missed_rate: total > 0 ? (missed / total) * 100 : 0,
  }

  return NextResponse.json(kpis)
}
