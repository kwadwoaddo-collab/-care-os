import { NextRequest, NextResponse }  from 'next/server'
import { adminClient }   from '@/lib/supabase/admin'
import { requireAdmin }  from '@/lib/auth/requireAdmin'
import { type DayKey }   from '@/lib/staff/types'
import { type SchedulingMetrics } from '@/lib/shifts/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_NAMES: DayKey[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
]

function todayDayKey(): DayKey {
  return DAY_NAMES[new Date().getUTCDay()]!
}

function shiftDurationMinutes(startTime: string, endTime: string): number {
  const [sh = 0, sm = 0] = startTime.split(':').map(Number)
  const [eh = 0, em = 0] = endTime.split(':').map(Number)
  const startMin = sh * 60 + sm
  const endMin   = eh * 60 + em
  return endMin > startMin ? endMin - startMin : 1440 - startMin + endMin
}

// ── GET /api/admin/shifts/metrics ────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const today    = new Date().toISOString().slice(0, 10)
  const in14days = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const dayKey   = todayDayKey()
  
  // KPI dates
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)

  const [
    openShiftsRes,
    unassignedRes,
    declinedRes,
    runningLateRes,
    overdueAckRes,
    bookedTodayRes,
    activeStaffRes,
    availabilityRes,
    kpiShiftsRes,
  ] = await Promise.all([
    // Open (unassigned) shifts in next 14 days
    adminClient
      .from('shifts')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('shift_date', today)
      .lte('shift_date', in14days)
      .eq('status', 'open'),

    // Unassigned today
    adminClient
      .from('shifts')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('shift_date', today)
      .eq('status', 'open'),

    // Declined in next 14 days
    adminClient
      .from('shifts')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('shift_date', today)
      .lte('shift_date', in14days)
      .eq('status', 'declined'),

    // Running late in next 14 days
    adminClient
      .from('shifts')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('shift_date', today)
      .lte('shift_date', in14days)
      .eq('worker_ack_status', 'running_late'),

    // Overdue acknowledgements: assigned, no response, shift is today or past
    adminClient
      .from('shifts')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .lte('shift_date', today)
      .not('assigned_staff_id', 'is', null)
      .is('worker_ack_status', null)
      .in('status', ['offered', 'accepted']),

    // Distinct workers booked today
    adminClient
      .from('shifts')
      .select('assigned_staff_id')
      .eq('company_id', companyId)
      .eq('shift_date', today)
      .not('assigned_staff_id', 'is', null)
      .neq('status', 'cancelled'),

    // Active staff in company
    adminClient
      .from('staff_profiles')
      .select('id')
      .eq('company_id', companyId)
      .eq('status', 'active'),

    // Availability records for active staff
    adminClient
      .from('staff_availability')
      .select('staff_profile_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday'),
      
    // KPI Shifts for this month
    adminClient
      .from('shifts')
      .select('status, worker_ack_status')
      .eq('company_id', companyId)
      .gte('shift_date', firstDay)
      .lte('shift_date', lastDay)
      .neq('status', 'cancelled'),
  ])

  // Distinct booked workers today
  const bookedIds = new Set<string>()
  for (const row of bookedTodayRes.data ?? []) {
    const r = row as Record<string, unknown>
    if (r.assigned_staff_id) bookedIds.add(r.assigned_staff_id as string)
  }

  // Workers available today: check staff_availability for today's day column
  const activeStaffIds = new Set((activeStaffRes.data ?? []).map((s) => (s as Record<string, unknown>).id as string))
  let availableToday = 0
  for (const row of availabilityRes.data ?? []) {
    const r   = row as Record<string, unknown>
    const sid = r.staff_profile_id as string
    if (!activeStaffIds.has(sid)) continue
    const dayData = r[dayKey] as { available?: boolean } | null
    if (dayData?.available === true) availableToday++
  }

  // conflict_count = declined + running_late (active scheduling conflicts)
  const conflictCount =
    (declinedRes.count ?? 0) + (runningLateRes.count ?? 0)

  // KPI calc
  let total = 0
  let completed = 0
  let late = 0
  let missed = 0

  for (const s of kpiShiftsRes.data ?? []) {
    total++
    if (s.status === 'completed') completed++
    if (s.worker_ack_status === 'running_late') late++
    if (s.status === 'missed') missed++
  }

  const metrics: SchedulingMetrics = {
    open_shifts:              openShiftsRes.count     ?? 0,
    unassigned_shifts:        unassignedRes.count     ?? 0,
    conflict_count:           conflictCount,
    overdue_acknowledgements: overdueAckRes.count     ?? 0,
    workers_available_today:  availableToday,
    workers_booked_today:     bookedIds.size,
    
    total_shifts: total,
    completion_rate: total > 0 ? (completed / total) * 100 : 0,
    late_rate: total > 0 ? (late / total) * 100 : 0,
    missed_rate: total > 0 ? (missed / total) * 100 : 0,
  }

  return NextResponse.json(metrics)
}
