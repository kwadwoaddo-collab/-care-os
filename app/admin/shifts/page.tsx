import Link from 'next/link'
import ShiftsTable, { type Shift } from './ShiftsTable'
import CreateShiftForm, { type ReadyStaff, type ActiveClient } from './CreateShiftForm'
import MobilePageHeader from '@/components/admin/MobilePageHeader'
import ListFilters from '@/components/admin/ListFilters'
import Pagination  from '@/components/admin/Pagination'
import type { PaginationMeta } from '@/lib/pagination'
import { sp } from '@/lib/pagination'
import { adminFetch } from '@/lib/admin/serverFetch'

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
  const res = await adminFetch(`${baseUrl}/api/admin/shifts?${params.toString()}`, { cache: 'no-store' })
  if (!res.ok) return { data: [], meta: { total: 0, page: 1, pageSize: 20, totalPages: 1, hasNext: false, hasPrev: false } }
  return res.json() as Promise<{ data: Shift[]; meta: PaginationMeta }>
}

async function getReadyStaff(): Promise<ReadyStaff[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await adminFetch(`${baseUrl}/api/admin/staff`, { cache: 'no-store' })
  if (!res.ok) return []
  const json = await res.json() as { data: StaffListItem[]; meta: PaginationMeta }
  return json.data.filter((s) => s.status === 'active' && s.readiness.ready)
}

async function getActiveClients(): Promise<ActiveClient[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await adminFetch(`${baseUrl}/api/admin/clients`, { cache: 'no-store' })
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
  const inProgressCount = shifts.filter((s) => s.status === 'in_progress').length
  const openCount     = shifts.filter((s) => s.status === 'open' || s.status === 'declined').length

  // Hard-code company_id for now (same pattern used in rest of app)
  // TODO: derive from session when auth is restored
  const companyId = 'dev-company'

  // Mobile: group shifts by date
  const shiftsByDate = shifts.reduce<Record<string, Shift[]>>((acc, s) => {
    ;(acc[s.shift_date] ??= []).push(s)
    return acc
  }, {})
  const sortedDates = Object.keys(shiftsByDate).sort()

  const MOBILE_STATUS: Record<string, string> = {
    open:        'bg-orange-50 text-orange-700',
    offered:     'bg-blue-50   text-blue-700',
    accepted:    'bg-indigo-50 text-indigo-700',
    in_progress: 'bg-green-50  text-green-700',
    completed:   'bg-gray-100  text-gray-500',
    declined:    'bg-red-50    text-red-700',
    cancelled:   'bg-gray-100  text-gray-400',
    missed:      'bg-red-50    text-red-700',
  }

  return (
    <div className="space-y-5">

      {/* Mobile page header */}
      <MobilePageHeader
        title="Shifts"
        subtitle={`${meta.total} shift${meta.total !== 1 ? 's' : ''}`}
      />

      {/* Desktop header */}
      <div className="hidden lg:flex items-center justify-between">
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
          <p className="text-xs font-medium text-gray-500 mb-1">In Progress</p>
          <p className={`text-2xl font-semibold tabular-nums ${inProgressCount > 0 ? 'text-green-600' : 'text-gray-900'}`}>
            {inProgressCount}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Missing Coverage</p>
          <p className={`text-2xl font-semibold tabular-nums ${openCount > 0 ? 'text-orange-600' : 'text-gray-900'}`}>
            {openCount}
          </p>
        </div>
      </div>

      {/* Open shifts callout */}
      <Link
        href="/admin/shifts/operations"
        className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg px-5 py-4 hover:bg-orange-100 transition-colors group"
      >
        <div>
          <p className="text-sm font-semibold text-orange-800">
            {openCount === 0
              ? 'All shifts are assigned'
              : `${openCount} shift${openCount !== 1 ? 's' : ''} missing coverage`}
          </p>
          <p className="text-xs text-orange-600 mt-0.5">View operations dashboard →</p>
        </div>
        <span className={`text-3xl font-bold tabular-nums ${openCount > 0 ? 'text-orange-600' : 'text-orange-300'}`}>
          {openCount}
        </span>
      </Link>

      {/* Filters */}
      <ListFilters fields={[
        { type: 'text',   name: 'search',     placeholder: 'Search title, location, client…', label: 'Search' },
        { type: 'select', name: 'status',     label: 'Status', options: [
            { value: 'open',        label: 'Open' },
            { value: 'offered',     label: 'Offered' },
            { value: 'accepted',    label: 'Accepted' },
            { value: 'in_progress', label: 'In Progress' },
            { value: 'completed',   label: 'Completed' },
            { value: 'declined',    label: 'Declined' },
            { value: 'cancelled',   label: 'Cancelled' },
            { value: 'missed',      label: 'Missed' },
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

      {shifts.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-10 text-center">
          {hasFilters ? (
            <>
              <p className="text-sm font-medium text-gray-900">No shifts match your filters</p>
              <p className="text-xs text-gray-400 mt-1">Try adjusting or clearing your search filters.</p>
              <a href="/admin/shifts" className="mt-4 inline-flex items-center text-xs text-indigo-600 hover:underline">← Clear filters</a>
            </>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-900">No shifts yet</p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                Create a shift manually above, or generate shifts automatically from a{' '}
                <a href="/admin/care-packages" className="text-indigo-600 hover:underline">care package</a>.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">

          {/* ── Mobile agenda list (lg:hidden) ─────────────────────────── */}
          <div className="lg:hidden space-y-5">
            {sortedDates.map((date) => {
              const dateShifts = shiftsByDate[date]!
              const isDateToday = date === today
              const formatted  = new Date(date + 'T00:00:00').toLocaleDateString('en-GB', {
                weekday: 'short', day: 'numeric', month: 'short',
              })
              return (
                <div key={date}>
                  {/* Date group header */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-bold uppercase tracking-wider ${
                      isDateToday ? 'text-indigo-600' : 'text-gray-400'
                    }`}>
                      {isDateToday ? 'Today' : formatted}
                    </span>
                    <span className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                      isDateToday ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {dateShifts.length} shift{dateShifts.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Shift cards */}
                  <div className="space-y-2">
                    {dateShifts.map((shift) => {
                      const worker = shift.staff_profiles
                        ? [shift.staff_profiles.first_name, shift.staff_profiles.last_name].filter(Boolean).join(' ')
                        : null
                      const clientName = shift.clients
                        ? `${shift.clients.first_name} ${shift.clients.last_name}`
                        : (shift.client_name ?? null)
                      const statusCls = MOBILE_STATUS[shift.status] ?? 'bg-gray-100 text-gray-500'

                      return (
                        <div
                          key={shift.id}
                          className="bg-white rounded-xl border border-gray-100 shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden"
                        >
                          {/* Time bar */}
                          <div className={`flex items-center justify-between px-4 py-2.5 border-b border-gray-50 ${
                            isDateToday ? 'bg-blue-50/50' : 'bg-gray-50/60'
                          }`}>
                            <span className="text-xs font-semibold tabular-nums text-gray-700">
                              {shift.start_time.slice(0,5)} – {shift.end_time.slice(0,5)}
                            </span>
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusCls}`}>
                              {shift.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                          {/* Body */}
                          <div className="px-4 py-3">
                            <p className="text-sm font-semibold text-gray-900 truncate">{shift.title}</p>
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                              <span className="truncate">
                                {clientName ? `👤 ${clientName}` : 'No client'}
                              </span>
                              <span className="truncate">
                                {worker ? `👷 ${worker}` : '⚠️ Unassigned'}
                              </span>
                            </div>
                            {shift.location && (
                              <p className="text-[11px] text-gray-400 mt-1 truncate">
                                📍 {shift.location}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Desktop table (hidden on mobile) ────────────────────────── */}
          <div className="hidden lg:block">
            <ShiftsTable shifts={shifts} />
          </div>

          <Pagination meta={meta} searchParams={raw} />
        </div>
      )}
    </div>
  )
}
