import Link from 'next/link'
import ShiftsTable, { type Shift } from './ShiftsTable'
import CreateShiftForm, { type ReadyStaff, type ActiveClient } from './CreateShiftForm'
import ListFilters from '@/components/admin/ListFilters'
import Pagination  from '@/components/admin/Pagination'
import type { PaginationMeta } from '@/lib/pagination'
import { sp } from '@/lib/pagination'

// ── Types ─────────────────────────────────────────────────────────────────────

type SearchParams = Record<string, string | string[] | undefined>

interface StaffListItem {
  id:         string
  first_name: string | null
  last_name:  string | null
  email:      string | null
  status:     string
  readiness:  { ready: boolean; score: number }
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getShifts(
  params: URLSearchParams
): Promise<{ data: Shift[]; meta: PaginationMeta }> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/admin/shifts?${params.toString()}`, { cache: 'no-store' })
  if (!res.ok) return { data: [], meta: { total: 0, page: 1, pageSize: 20, totalPages: 1, hasNext: false, hasPrev: false } }
  return res.json() as Promise<{ data: Shift[]; meta: PaginationMeta }>
}

async function getReadyStaff(): Promise<ReadyStaff[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/admin/staff`, { cache: 'no-store' })
  if (!res.ok) return []
  const json = await res.json() as { data: StaffListItem[]; meta: PaginationMeta }
  return json.data.filter((s) => s.status === 'active' && s.readiness.ready)
}

async function getActiveClients(): Promise<ActiveClient[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/admin/clients`, { cache: 'no-store' })
  if (!res.ok) return []
  const json = await res.json() as { data: (ActiveClient & { status: string })[]; meta: PaginationMeta }
  return json.data.filter((c) => c.status === 'active')
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const raw = await searchParams

  const params = new URLSearchParams()
  if (sp(raw, 'search'))     params.set('search',     sp(raw, 'search'))
  if (sp(raw, 'status'))     params.set('status',     sp(raw, 'status'))
  if (sp(raw, 'shift_type')) params.set('shift_type', sp(raw, 'shift_type'))
  if (sp(raw, 'assigned'))   params.set('assigned',   sp(raw, 'assigned'))
  if (sp(raw, 'date_from'))  params.set('date_from',  sp(raw, 'date_from'))
  if (sp(raw, 'date_to'))    params.set('date_to',    sp(raw, 'date_to'))
  if (sp(raw, 'page'))       params.set('page',       sp(raw, 'page'))
  if (sp(raw, 'pageSize'))   params.set('pageSize',   sp(raw, 'pageSize'))

  const [{ data: shifts, meta }, readyStaff, activeClients] = await Promise.all([
    getShifts(params),
    getReadyStaff(),
    getActiveClients(),
  ])

  const hasFilters = !!(
    sp(raw, 'search') || sp(raw, 'status') || sp(raw, 'shift_type') ||
    sp(raw, 'assigned') || sp(raw, 'date_from') || sp(raw, 'date_to')
  )

  const today         = todayStr()
  const todayCount    = shifts.filter((s) => s.shift_date === today).length
  const upcomingCount = shifts.filter((s) => s.shift_date >  today).length
  const scheduledCount = shifts.filter((s) => s.status === 'scheduled' || s.status === 'confirmed').length
  const openCount     = shifts.filter((s) => !s.assigned_staff_id).length

  // Hard-code company_id for now (same pattern used in rest of app)
  // TODO: derive from session when auth is restored
  const companyId = 'dev-company'

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Shifts</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {meta.total} shift{meta.total !== 1 ? 's' : ''}
          </p>
        </div>
        <CreateShiftForm companyId={companyId} readyStaff={readyStaff} activeClients={activeClients} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Total</p>
          <p className="text-2xl font-semibold tabular-nums text-gray-900">{meta.total}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Today</p>
          <p className={`text-2xl font-semibold tabular-nums ${todayCount > 0 ? 'text-blue-600' : 'text-gray-900'}`}>
            {todayCount}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Upcoming</p>
          <p className="text-2xl font-semibold tabular-nums text-gray-900">{upcomingCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Scheduled / Confirmed</p>
          <p className="text-2xl font-semibold tabular-nums text-gray-900">{scheduledCount}</p>
        </div>
      </div>

      {/* Open shifts callout */}
      <Link
        href="/admin/shifts/open"
        className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg px-5 py-4 hover:bg-orange-100 transition-colors group"
      >
        <div>
          <p className="text-sm font-semibold text-orange-800">
            {openCount === 0
              ? 'All shifts are assigned'
              : `${openCount} unassigned shift${openCount !== 1 ? 's' : ''} need${openCount === 1 ? 's' : ''} staff`}
          </p>
          <p className="text-xs text-orange-600 mt-0.5">View open shifts queue →</p>
        </div>
        <span className={`text-3xl font-bold tabular-nums ${openCount > 0 ? 'text-orange-600' : 'text-orange-300'}`}>
          {openCount}
        </span>
      </Link>

      {/* Filters */}
      <ListFilters fields={[
        { type: 'text',   name: 'search',     placeholder: 'Search title, location, client…', label: 'Search' },
        { type: 'select', name: 'status',     label: 'Status', options: [
            { value: 'scheduled', label: 'Scheduled' },
            { value: 'confirmed', label: 'Confirmed' },
            { value: 'completed', label: 'Completed' },
            { value: 'cancelled', label: 'Cancelled' },
            { value: 'no_show',   label: 'No show' },
        ]},
        { type: 'select', name: 'shift_type', label: 'Shift type', options: [
            { value: 'day',       label: 'Day' },
            { value: 'night',     label: 'Night' },
            { value: 'sleep_in',  label: 'Sleep-in' },
            { value: 'live_in',   label: 'Live-in' },
            { value: 'emergency', label: 'Emergency' },
        ]},
        { type: 'select', name: 'assigned',   label: 'Assignment', options: [
            { value: 'assigned',   label: 'Assigned' },
            { value: 'unassigned', label: 'Unassigned' },
        ]},
        { type: 'date',   name: 'date_from',  label: 'From date' },
        { type: 'date',   name: 'date_to',    label: 'To date' },
      ]} />

      {/* Table */}
      {shifts.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-400">
          {hasFilters
            ? 'No results found. Try changing your filters.'
            : 'No shifts yet. Create one to get started.'}
        </div>
      ) : (
        <div className="space-y-3">
          <ShiftsTable shifts={shifts} />
          <Pagination meta={meta} searchParams={raw} />
        </div>
      )}
    </div>
  )
}
