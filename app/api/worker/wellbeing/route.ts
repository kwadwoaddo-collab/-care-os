import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { validateWorkerToken } from '@/lib/worker/auth'

function startOfWeek(): string {
  const d = new Date()
  const monday = new Date(d)
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString().slice(0, 10)
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export async function GET(request: NextRequest) {
  const token  = request.nextUrl.searchParams.get('token')
  const result = await validateWorkerToken(token)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const { id: staffProfileId } = result.worker

  const weekStart      = startOfWeek()
  const fourteenDaysAgo = daysAgo(14)

  const { data: timesheets } = await adminClient
    .from('timesheets')
    .select('clock_in, worked_minutes, break_minutes, status, shifts!shift_id(shift_date)')
    .eq('staff_profile_id', staffProfileId)
    .gte('clock_in', `${fourteenDaysAgo}T00:00:00.000Z`)
    .order('clock_in', { ascending: false })

  const rows = timesheets ?? []

  // Hours this week
  type ShiftRef = { shift_date: string }

  const thisWeekMins = rows
    .filter(t => t.status === 'completed' && t.worked_minutes)
    .filter(t => ((t.shifts as unknown as ShiftRef | null)?.shift_date ?? '') >= weekStart)
    .reduce((sum, t) => sum + (t.worked_minutes as number), 0)
  const hoursThisWeek = thisWeekMins / 60

  // Hours last week
  const lastWeekStart = daysAgo(7 + ((new Date().getDay() + 6) % 7))
  const lastWeekMins = rows
    .filter(t => t.status === 'completed' && t.worked_minutes)
    .filter(t => {
      const d = (t.shifts as unknown as ShiftRef | null)?.shift_date ?? ''
      return d >= lastWeekStart && d < weekStart
    })
    .reduce((sum, t) => sum + (t.worked_minutes as number), 0)
  const hoursLastWeek = lastWeekMins / 60

  // Consecutive working days (counting back from today)
  const shiftDates = new Set(
    rows.map(t => (t.shifts as unknown as ShiftRef | null)?.shift_date).filter(Boolean)
  )
  let consecutiveDays = 0
  for (let i = 0; i < 14; i++) {
    if (shiftDates.has(daysAgo(i))) consecutiveDays++
    else break
  }

  // Insufficient break: any completed timesheet with worked > 6h and break < 20min
  const insufficientBreak = rows.some(
    t => t.status === 'completed' && (t.worked_minutes as number) > 360 && ((t.break_minutes as number) ?? 0) < 20
  )

  const flags = {
    excessive_overtime:    hoursThisWeek > 48,
    excessive_consecutive: consecutiveDays > 5,
    insufficient_break:    insufficientBreak,
    overloaded:            hoursThisWeek > 40 && consecutiveDays > 4,
  }

  const warnings: string[] = []
  if (flags.excessive_overtime)
    warnings.push(`You have worked ${hoursThisWeek.toFixed(0)} hours this week — above the 48-hour legal limit. Please speak to your manager.`)
  if (flags.excessive_consecutive)
    warnings.push(`You have worked ${consecutiveDays} consecutive days without a rest day. Consider raising this with your coordinator.`)
  if (flags.insufficient_break)
    warnings.push('Recent shifts show insufficient break time. You are entitled to adequate rest during long shifts.')
  if (flags.overloaded && !flags.excessive_overtime && !flags.excessive_consecutive)
    warnings.push('You appear to be carrying a heavy workload. Please let your coordinator know if you need support.')

  return NextResponse.json({
    hours_this_week:  parseFloat(hoursThisWeek.toFixed(1)),
    hours_last_week:  parseFloat(hoursLastWeek.toFixed(1)),
    consecutive_days: consecutiveDays,
    flags,
    warnings,
    any_concern:      Object.values(flags).some(Boolean),
  })
}
