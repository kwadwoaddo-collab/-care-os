import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/auth/permissions'
import { forbidden } from '@/lib/auth/responses'

export interface LiveVisit {
  shift_id:        string
  title:           string
  shift_date:      string
  start_time:      string
  end_time:        string
  client_name:     string | null
  worker_name:     string
  worker_id:       string
  status:          string
  clock_in:        string | null
  clock_out:       string | null
  lateness_minutes:number
  worked_minutes:  number | null
  visit_note_id:   string | null
  note_status:     string | null
  is_missed:       boolean
  escalation_raised: boolean
}

export interface VisitsDashboard {
  live:            LiveVisit[]
  overdue:         LiveVisit[]
  missed:          LiveVisit[]
  completed_today: number
  medication_alerts: number
  unresolved_anomalies: number
  task_completion_rate: number
  avg_lateness_minutes: number
  timestamp:       string
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'shifts:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const today = new Date().toISOString().slice(0, 10)
  const nowISO = new Date().toISOString()

  // ── Today's shifts with staff + visit notes + timesheets ──────────────────
  const { data: shifts } = await adminClient
    .from('shifts')
    .select(`
      id, title, shift_date, start_time, end_time, status, client_name, client_id, assigned_staff_id,
      staff_profiles!assigned_staff_id ( id, first_name, last_name )
    `)
    .eq('company_id', companyId)
    .eq('shift_date', today)
    .not('status', 'in', '("cancelled")')
    .order('start_time', { ascending: true })

  if (!shifts) {
    return NextResponse.json(emptyDashboard())
  }

  // Fetch timesheets + visit notes for today's shifts in bulk
  const shiftIds = shifts.map(s => s.id as string)

  const [tsRes, notesRes, anomaliesRes, medRes] = await Promise.all([
    shiftIds.length > 0
      ? adminClient.from('timesheets').select('shift_id, clock_in, clock_out, lateness_minutes, worked_minutes, status').in('shift_id', shiftIds)
      : Promise.resolve({ data: [] }),
    shiftIds.length > 0
      ? adminClient.from('visit_notes').select('id, shift_id, status, is_missed, escalation_raised').in('shift_id', shiftIds)
      : Promise.resolve({ data: [] }),
    adminClient.from('visit_anomalies').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('resolved', false),
    adminClient.from('visit_medication_records').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('requires_escalation', true).eq('escalated', false),
  ])

  const tsMap    = new Map((tsRes.data   ?? []).map(t => [t.shift_id as string, t]))
  const notesMap = new Map((notesRes.data ?? []).map(n => [n.shift_id as string, n]))

  const buildVisit = (s: Record<string, unknown>): LiveVisit => {
    const sp = (s.staff_profiles as any)
    const workerName = sp ? `${sp.first_name ?? ''} ${sp.last_name ?? ''}`.trim() || 'Unknown' : 'Unassigned'
    const ts   = tsMap.get(s.id as string)
    const note = notesMap.get(s.id as string)
    return {
      shift_id:          s.id as string,
      title:             s.title as string,
      shift_date:        s.shift_date as string,
      start_time:        s.start_time as string,
      end_time:          s.end_time as string,
      client_name:       s.client_name as string | null,
      worker_name:       workerName,
      worker_id:         (s.assigned_staff_id ?? '') as string,
      status:            s.status as string,
      clock_in:          ts?.clock_in ?? null,
      clock_out:         ts?.clock_out ?? null,
      lateness_minutes:  ts?.lateness_minutes ?? 0,
      worked_minutes:    ts?.worked_minutes ?? null,
      visit_note_id:     note?.id ?? null,
      note_status:       note?.status ?? null,
      is_missed:         note?.is_missed ?? false,
      escalation_raised: note?.escalation_raised ?? false,
    }
  }

  const allVisits = shifts.map(s => buildVisit(s as Record<string, unknown>))

  // Live: clocked in, not clocked out
  const live = allVisits.filter(v => v.clock_in && !v.clock_out && !v.is_missed)

  // Overdue: start time has passed, no clock-in, not missed, not completed
  const overdue = allVisits.filter(v => {
    if (v.clock_in || v.is_missed || v.status === 'completed' || v.status === 'missed') return false
    const scheduledStart = new Date(`${v.shift_date}T${v.start_time}`)
    return scheduledStart < new Date(nowISO) && (new Date(nowISO).getTime() - scheduledStart.getTime()) > 15 * 60_000
  })

  // Missed
  const missed = allVisits.filter(v => v.is_missed || v.status === 'missed')

  // Completed today
  const completedToday = allVisits.filter(v => v.clock_out && v.status === 'completed').length

  // Task completion rate
  const { count: totalTasks } = await adminClient
    .from('visit_task_items')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .gte('created_at', today)

  const { count: completedTasks } = await adminClient
    .from('visit_task_items')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('status', 'completed')
    .gte('created_at', today)

  const taskRate = (totalTasks ?? 0) > 0
    ? Math.round(((completedTasks ?? 0) / (totalTasks ?? 1)) * 100)
    : 0

  // Avg lateness
  const lateVisits = allVisits.filter(v => v.lateness_minutes > 0)
  const avgLateness = lateVisits.length > 0
    ? Math.round(lateVisits.reduce((sum, v) => sum + v.lateness_minutes, 0) / lateVisits.length)
    : 0

  return NextResponse.json({
    live,
    overdue,
    missed,
    completed_today:      completedToday,
    medication_alerts:    medRes.count ?? 0,
    unresolved_anomalies: anomaliesRes.count ?? 0,
    task_completion_rate: taskRate,
    avg_lateness_minutes: avgLateness,
    timestamp:            nowISO,
  } satisfies VisitsDashboard)
}

function emptyDashboard(): VisitsDashboard {
  return {
    live: [], overdue: [], missed: [],
    completed_today: 0, medication_alerts: 0, unresolved_anomalies: 0,
    task_completion_rate: 0, avg_lateness_minutes: 0,
    timestamp: new Date().toISOString(),
  }
}
