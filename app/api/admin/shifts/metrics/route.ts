import { NextResponse }  from 'next/server'
import { adminClient }   from '@/lib/supabase/admin'
import { requireAdmin }  from '@/lib/auth/requireAdmin'
import { type DayKey }   from '@/lib/staff/types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SchedulingMetrics {
  open_shifts:               number
  unassigned_shifts:         number
  conflict_count:            number
  overdue_acknowledgements:  number
  workers_available_today:   number
  workers_booked_today:      number
}

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

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const today    = new Date().toISOString().slice(0, 10)
  const in14days = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const dayKey   = todayDayKey()

  const [
    openShiftsRes,
    unassignedRes,
    declinedRes,
    runningLateRes,
    overdueAckRes,
    bookedTodayRes,
    activeStaffRes,
    availabilityRes,
  ] = await Promise.all([
    // Open (unassigned) shifts in next 14 days
    adminClient
      .from('shifts')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('shift_date', today)
      .lte('shift_date', in14days)
      .is('assigned_staff_id', null)
      .neq('status', 'cancelled'),

    // Unassigned today
    adminClient
      .from('shifts')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('shift_date', today)
      .is('assigned_staff_id', null)
      .neq('status', 'cancelled'),

    // Declined in next 14 days
    adminClient
      .from('shifts')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('shift_date', today)
      .lte('shift_date', in14days)
      .eq('worker_ack_status', 'declined'),

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
      .in('status', ['scheduled', 'confirmed']),

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

  const metrics: SchedulingMetrics = {
    open_shifts:              openShiftsRes.count     ?? 0,
    unassigned_shifts:        unassignedRes.count     ?? 0,
    conflict_count:           conflictCount,
    overdue_acknowledgements: overdueAckRes.count     ?? 0,
    workers_available_today:  availableToday,
    workers_booked_today:     bookedIds.size,
  }

  return NextResponse.json(metrics)
}
