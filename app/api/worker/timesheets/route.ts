import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { validateWorkerToken } from '@/lib/worker/auth'

// ── GET /api/worker/timesheets?token=xxx ──────────────────────────────────────
// Returns the worker's timesheets for the current week, plus a weekly total.

function startOfWeek(): string {
  const d = new Date()
  const day = d.getDay()                    // 0 = Sunday
  const monday = new Date(d)
  monday.setDate(d.getDate() - ((day + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString().slice(0, 10)
}

export async function GET(request: NextRequest) {
  const token  = request.nextUrl.searchParams.get('token')
  const result = await validateWorkerToken(token)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const { id: staffProfileId } = result.worker

  const weekStart = startOfWeek()

  // Fetch timesheets joined with shift date for filtering
  const { data: timesheets, error } = await adminClient
    .from('timesheets')
    .select(`
      id, clock_in, clock_out, worked_minutes, break_minutes, status,
      shifts!shift_id ( shift_date, title )
    `)
    .eq('staff_profile_id', staffProfileId)
    .gte('clock_in', `${weekStart}T00:00:00.000Z`)
    .order('clock_in', { ascending: true })

  if (error) {
    console.error('[worker/timesheets] fetch error:', error.message)
    return NextResponse.json({ error: 'Failed to fetch timesheets' }, { status: 500 })
  }

  const rows = timesheets ?? []

  // Total worked minutes this week (only completed timesheets)
  const totalMinutes = rows
    .filter((t) => t.status === 'completed' && t.worked_minutes)
    .reduce((sum, t) => sum + (t.worked_minutes as number), 0)

  return NextResponse.json({
    timesheets: rows,
    week_start: weekStart,
    total_minutes: totalMinutes,
    total_hours: parseFloat((totalMinutes / 60).toFixed(1)),
  })
}
