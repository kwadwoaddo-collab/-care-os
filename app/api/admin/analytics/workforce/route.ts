import { NextResponse } from 'next/server'
import { adminClient }  from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can }          from '@/lib/auth/permissions'
import { forbidden }    from '@/lib/auth/responses'

export interface WorkforceAnalytics {
  headcount: {
    active:          number
    pre_employment:  number
    suspended:       number
    terminated_30d:  number
    total:           number
  }
  attendance: {
    shifts_completed_30d:  number
    shifts_missed_30d:     number
    miss_rate_pct:         number
    avg_lateness_minutes:  number
    late_arrivals_30d:     number
  }
  overtime: {
    staff_over_40h_count: number
    avg_weekly_hours:     number | null
  }
  deployability: {
    deployable:     number
    at_risk:        number
    blocked:        number
    pct_deployable: number
  }
  onboarding: {
    in_progress:         number
    backlog_over_30d:    number
    avg_days_to_active:  number | null
    completed_30d:       number
  }
  top_missed_staff: { id: string; name: string; missed_count: number }[]
  timestamp: string
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'staff:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const now    = new Date()
  const ago30  = new Date(now.getTime() - 30 * 86400_000).toISOString()
  const cutoff = new Date(now.getTime() - 30 * 86400_000).toISOString()

  const [staffRes, shiftsRes, tsRes, terminatedRes, activatedRes] = await Promise.all([
    adminClient.from('staff_profiles').select('id, status, first_name, last_name, created_at').eq('company_id', companyId),
    adminClient.from('shifts').select('id, assigned_staff_id, status, shift_date').eq('company_id', companyId).gte('shift_date', ago30.slice(0, 10)),
    adminClient.from('timesheets').select('id, staff_profile_id, status, lateness_minutes, worked_minutes, clock_in').eq('company_id', companyId).gte('clock_in', ago30),
    adminClient.from('staff_profiles').select('id').eq('company_id', companyId).eq('status', 'terminated').gte('updated_at', ago30),
    adminClient.from('staff_profiles').select('id, created_at, updated_at').eq('company_id', companyId).eq('status', 'active').gte('updated_at', ago30),
  ])

  const staff    = staffRes.data ?? []
  const shifts   = shiftsRes.data ?? []
  const timesheets = tsRes.data ?? []

  // Headcount
  const active        = staff.filter(s => s.status === 'active').length
  const preEmployment = staff.filter(s => s.status === 'pre_employment').length
  const suspended     = staff.filter(s => s.status === 'suspended').length

  // Attendance
  const completedTs  = timesheets.filter(t => t.status === 'completed' || t.clock_in)
  const missedShifts = shifts.filter(s => s.status === 'missed')
  const completedShifts = shifts.filter(s => s.status === 'completed')
  const totalShifts  = completedShifts.length + missedShifts.length
  const missRate     = totalShifts > 0 ? Math.round((missedShifts.length / totalShifts) * 100) : 0

  const lateTs = timesheets.filter(t => (t.lateness_minutes ?? 0) >= 10)
  const avgLateness = lateTs.length > 0
    ? Math.round(lateTs.reduce((s, t) => s + (t.lateness_minutes ?? 0), 0) / lateTs.length)
    : 0

  // Overtime (workers with worked_minutes / 4 > 40h in 30d — weekly proxy)
  const workerHours = new Map<string, number>()
  for (const ts of timesheets) {
    const hrs = (ts.worked_minutes ?? 0) / 60
    workerHours.set(ts.staff_profile_id as string, (workerHours.get(ts.staff_profile_id as string) ?? 0) + hrs)
  }
  const overtimeStaff = [...workerHours.values()].filter(h => h / 4 > 40).length
  const avgWeeklyHours = workerHours.size > 0
    ? Math.round([...workerHours.values()].reduce((a, b) => a + b, 0) / workerHours.size / 4)
    : null

  // Deployability (simplified: active with any docs vs active overall)
  const deployable = active
  const blocked    = staff.filter(s => s.status === 'suspended').length
  const atRisk     = (staffRes.data ?? []).filter(s => s.status === 'pre_employment').length
  const pctDeployable = (active + preEmployment + suspended) > 0
    ? Math.round((deployable / (active + preEmployment + suspended)) * 100)
    : 100

  // Onboarding
  const backlogOver30 = (staffRes.data ?? []).filter(s =>
    s.status === 'pre_employment' && new Date(s.created_at as string) < new Date(cutoff)
  ).length

  const activatedNow = activatedRes.data ?? []
  let avgDaysToActive: number | null = null
  if (activatedNow.length > 0) {
    const totalDays = activatedNow.reduce((sum, s) => {
      return sum + (new Date(s.updated_at as string).getTime() - new Date(s.created_at as string).getTime()) / 86400_000
    }, 0)
    avgDaysToActive = Math.round(totalDays / activatedNow.length)
  }

  // Top missed staff
  const missedByStaff = new Map<string, number>()
  for (const shift of missedShifts) {
    if (shift.assigned_staff_id) {
      missedByStaff.set(shift.assigned_staff_id as string, (missedByStaff.get(shift.assigned_staff_id as string) ?? 0) + 1)
    }
  }
  const topMissed = [...missedByStaff.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => {
      const sp = staff.find(s => s.id === id)
      const name = sp ? `${sp.first_name ?? ''} ${sp.last_name ?? ''}`.trim() : 'Unknown'
      return { id, name, missed_count: count }
    })

  void completedTs // suppress unused warning

  return NextResponse.json({
    headcount: {
      active,
      pre_employment:  preEmployment,
      suspended,
      terminated_30d:  terminatedRes.data?.length ?? 0,
      total:           staff.length,
    },
    attendance: {
      shifts_completed_30d: completedShifts.length,
      shifts_missed_30d:    missedShifts.length,
      miss_rate_pct:        missRate,
      avg_lateness_minutes: avgLateness,
      late_arrivals_30d:    lateTs.length,
    },
    overtime: {
      staff_over_40h_count: overtimeStaff,
      avg_weekly_hours:     avgWeeklyHours,
    },
    deployability: { deployable, at_risk: atRisk, blocked, pct_deployable: pctDeployable },
    onboarding: {
      in_progress:        preEmployment,
      backlog_over_30d:   backlogOver30,
      avg_days_to_active: avgDaysToActive,
      completed_30d:      activatedNow.length,
    },
    top_missed_staff: topMissed,
    timestamp:        now.toISOString(),
  } satisfies WorkforceAnalytics)
}
