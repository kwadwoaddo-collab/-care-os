import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'

// ── Types ────────────────────────────────────────────────────────────────────

export interface OperationsShift {
  id:                 string
  title:              string
  shift_date:         string
  start_time:         string
  end_time:           string
  status:             string
  shift_type:         string | null
  location:           string | null
  client_name:        string | null
  notes:              string | null
  assigned_staff_id:  string | null
  worker_ack_status:  string | null
  worker_ack_at:      string | null
  worker_ack_reason:  string | null
  staff_profiles: {
    id:         string
    first_name: string | null
    last_name:  string | null
    email:      string | null
  } | null
  clients: {
    id:         string
    first_name: string
    last_name:  string
  } | null
}

export interface OperationsSummary {
  total_today:     number
  unassigned_today: number
  declined:        number
  running_late:    number
  unacknowledged:  number
}

export interface OperationsResponse {
  summary: OperationsSummary
  shifts:  OperationsShift[]
}

// ── GET /api/admin/shifts/operations ────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const sp     = request.nextUrl.searchParams
  const filter = sp.get('filter') ?? 'today'  // today | upcoming | unacknowledged | declined | running_late | unassigned

  const today    = new Date().toISOString().slice(0, 10)
  const in14days = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // ── Summary counts (always computed for today/next 14 days) ───────────────
  const [
    todayCountResult,
    unassignedTodayResult,
    declinedResult,
    runningLateResult,
    unacknowledgedResult,
  ] = await Promise.all([
    adminClient
      .from('shifts')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('shift_date', today)
      .neq('status', 'cancelled'),

    adminClient
      .from('shifts')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('shift_date', today)
      .is('assigned_staff_id', null)
      .neq('status', 'cancelled'),

    adminClient
      .from('shifts')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('shift_date', today)
      .lte('shift_date', in14days)
      .eq('worker_ack_status', 'declined'),

    adminClient
      .from('shifts')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('shift_date', today)
      .lte('shift_date', in14days)
      .eq('worker_ack_status', 'running_late'),

    adminClient
      .from('shifts')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('shift_date', today)
      .lte('shift_date', in14days)
      .not('assigned_staff_id', 'is', null)
      .is('worker_ack_status', null)
      .in('status', ['scheduled', 'confirmed']),
  ])

  const summary: OperationsSummary = {
    total_today:      todayCountResult.count      ?? 0,
    unassigned_today: unassignedTodayResult.count ?? 0,
    declined:         declinedResult.count        ?? 0,
    running_late:     runningLateResult.count     ?? 0,
    unacknowledged:   unacknowledgedResult.count  ?? 0,
  }

  // ── Shift list with filter ────────────────────────────────────────────────
  let query = adminClient
    .from('shifts')
    .select(`
      id, title, shift_date, start_time, end_time, status, shift_type,
      location, client_name, notes, assigned_staff_id,
      worker_ack_status, worker_ack_at, worker_ack_reason,
      staff_profiles!assigned_staff_id ( id, first_name, last_name, email ),
      clients!client_id              ( id, first_name, last_name )
    `)
    .eq('company_id', companyId)
    .order('shift_date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(200)

  switch (filter) {
    case 'today':
      query = query.eq('shift_date', today).neq('status', 'cancelled')
      break
    case 'upcoming':
      query = query
        .gt('shift_date', today)
        .lte('shift_date', in14days)
        .neq('status', 'cancelled')
      break
    case 'declined':
      query = query
        .gte('shift_date', today)
        .eq('worker_ack_status', 'declined')
      break
    case 'running_late':
      query = query
        .gte('shift_date', today)
        .eq('worker_ack_status', 'running_late')
      break
    case 'unacknowledged':
      query = query
        .gte('shift_date', today)
        .lte('shift_date', in14days)
        .not('assigned_staff_id', 'is', null)
        .is('worker_ack_status', null)
        .in('status', ['scheduled', 'confirmed'])
      break
    case 'unassigned':
      query = query
        .gte('shift_date', today)
        .lte('shift_date', in14days)
        .is('assigned_staff_id', null)
        .neq('status', 'cancelled')
      break
    default:
      query = query.eq('shift_date', today).neq('status', 'cancelled')
  }

  const { data, error } = await query

  if (error) {
    console.error('[shifts/operations] list error:', error.message)
    return NextResponse.json({ error: 'Failed to fetch shifts' }, { status: 500 })
  }

  return NextResponse.json({
    summary,
    shifts: (data ?? []) as unknown as OperationsShift[],
  } satisfies OperationsResponse)
}
