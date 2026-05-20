import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import ShiftsGrid, { type Shift } from './ShiftsGrid'
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
  const fallback = { data: [], meta: { total: 0, page: 1, pageSize: 20, totalPages: 1, hasNext: false, hasPrev: false } }
  try {
    const res = await adminFetch(`${baseUrl}/api/admin/shifts?${params.toString()}`, { cache: 'no-store' })
    if (!res.ok) return fallback
    return await res.json() as { data: Shift[]; meta: PaginationMeta }
  } catch {
    return fallback
  }
}

async function getReadyStaff(): Promise<ReadyStaff[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  try {
    const res = await adminFetch(`${baseUrl}/api/admin/staff`, { cache: 'no-store' })
    if (!res.ok) return []
    const json = await res.json() as { data: StaffListItem[]; meta: PaginationMeta }
    return json.data.filter((s) => s.status === 'active' && s.readiness.ready)
  } catch {
    return []
  }
}

async function getActiveClients(): Promise<ActiveClient[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  try {
    const res = await adminFetch(`${baseUrl}/api/admin/clients`, { cache: 'no-store' })
    if (!res.ok) return []
    const json = await res.json() as { data: (ActiveClient & { status: string })[]; meta: PaginationMeta }
    return json.data.filter((c) => c.status === 'active')
  } catch {
    return []
  }
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

  // Derive company_id from session
  let companyId = 'dev-company'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .maybeSingle()
    if (profile?.company_id) companyId = profile.company_id
  }

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
    completed:   'bg-gray-100  text-on-surface-variant',
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
          <h1 className="text-xl font-semibold text-primary">Shifts</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            {meta.total} shift{meta.total !== 1 ? 's' : ''}
          </p>
        </div>
        <CreateShiftForm companyId={companyId} readyStaff={readyStaff} activeClients={activeClients} />
      </div>

      {/* Triage Row Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total */}
        <div className="bg-surface-container-lowest p-card-padding rounded-xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border-l-4 border-primary flex items-center justify-between">
          <div>
            <p className="font-label-md text-label-md text-on-surface-variant mb-1">Total Shifts</p>
            <h3 className="font-display-lg text-display-lg text-primary tabular-nums">{meta.total}</h3>
            <p className="text-[12px] text-on-surface-variant flex items-center gap-1 mt-1 font-medium">
              <span className="material-symbols-outlined text-[14px]">calendar_month</span> 
              All active records
            </p>
          </div>
          <div className="w-12 h-12 bg-primary-fixed rounded-full flex items-center justify-center text-on-primary-fixed-variant">
            <span className="material-symbols-outlined">dataset</span>
          </div>
        </div>

        {/* Today */}
        <div className="bg-surface-container-lowest p-card-padding rounded-xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border-l-4 border-secondary flex items-center justify-between">
          <div>
            <p className="font-label-md text-label-md text-on-surface-variant mb-1">Today's Schedule</p>
            <h3 className="font-display-lg text-display-lg text-secondary tabular-nums">{todayCount}</h3>
            <p className="text-[12px] text-on-surface-variant flex items-center gap-1 mt-1 font-medium">
              <span className="material-symbols-outlined text-[14px]">today</span> 
              Scheduled for today
            </p>
          </div>
          <div className="w-12 h-12 bg-secondary-fixed rounded-full flex items-center justify-center text-on-secondary-fixed-variant">
            <span className="material-symbols-outlined">calendar_today</span>
          </div>
        </div>

        {/* In Progress */}
        <div className="bg-surface-container-lowest p-card-padding rounded-xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border-l-4 border-green-600 flex items-center justify-between">
          <div>
            <p className="font-label-md text-label-md text-on-surface-variant mb-1">In Progress</p>
            <h3 className="font-display-lg text-display-lg text-green-600 tabular-nums">{inProgressCount}</h3>
            <p className="text-[12px] text-green-700 flex items-center gap-1 mt-1 font-medium">
              <span className="material-symbols-outlined text-[14px]">update</span> 
              Currently active
            </p>
          </div>
          <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center text-green-700">
            <span className="material-symbols-outlined">hourglass_top</span>
          </div>
        </div>

        {/* Missing Coverage */}
        <div className="bg-surface-container-lowest p-card-padding rounded-xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border-l-4 border-error flex items-center justify-between">
          <div>
            <p className="font-label-md text-label-md text-on-surface-variant mb-1">Unassigned Shifts</p>
            <h3 className="font-display-lg text-display-lg text-error tabular-nums">{openCount}</h3>
            <p className="text-[12px] text-error flex items-center gap-1 mt-1 font-medium">
              <span className="material-symbols-outlined text-[14px]">priority_high</span> 
              {openCount > 0 ? 'High Priority Attention' : 'All shifts covered'}
            </p>
          </div>
          <div className="w-12 h-12 bg-error-container rounded-full flex items-center justify-center text-on-error-container">
            <span className="material-symbols-outlined">pending_actions</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-surface-container-lowest p-card-padding rounded-xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border border-outline-variant">
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
      </div>

      {shifts.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-10 text-center">
          {hasFilters ? (
            <>
              <p className="text-sm font-medium text-primary">No shifts match your filters</p>
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
              <p className="text-sm font-medium text-primary">No shifts yet</p>
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
                      isDateToday ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-on-surface-variant'
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
                      const statusCls = MOBILE_STATUS[shift.status] ?? 'bg-gray-100 text-on-surface-variant'

                      return (
                        <div
                          key={shift.id}
                          className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden"
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
                            <p className="text-sm font-semibold text-primary truncate">{shift.title}</p>
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
            <ShiftsGrid shifts={shifts} />
          </div>

          <Pagination meta={meta} searchParams={raw} />
        </div>
      )}
    </div>
  )
}
