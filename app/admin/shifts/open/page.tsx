import Link           from 'next/link'
import OpenShiftsTable, { type OpenShiftRow, type Urgency } from './OpenShiftsTable'
import { type Shift } from '../ShiftsTable'
import { adminFetch } from '@/lib/admin/serverFetch'
import { type SchedulingMetrics } from '@/app/api/admin/shifts/metrics/route'

// ── Urgency ────────────────────────────────────────────────────────────────────

function getUrgency(shiftDate: string, startTime: string): Urgency {
  const [year, month, day] = shiftDate.split('-').map(Number)
  const [h, m]             = startTime.split(':').map(Number)
  const shiftMs  = Date.UTC(year!, month! - 1, day!, h!, m!)
  const hoursUntil = (shiftMs - Date.now()) / (1000 * 60 * 60)
  if (hoursUntil < 0)  return 'critical'
  if (hoursUntil < 6)  return 'critical'
  if (hoursUntil < 24) return 'high'
  if (hoursUntil < 72) return 'medium'
  return 'normal'
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getSchedulingMetrics(baseUrl: string): Promise<SchedulingMetrics | null> {
  try {
    const res = await adminFetch(`${baseUrl}/api/admin/shifts/metrics`, { cache: 'no-store' })
    if (!res.ok) return null
    return res.json() as Promise<SchedulingMetrics>
  } catch {
    return null
  }
}

async function getOpenShifts(baseUrl: string): Promise<OpenShiftRow[]> {
  const res = await adminFetch(`${baseUrl}/api/admin/shifts?pageSize=100`, { cache: 'no-store' })
  if (!res.ok) return []
  const json = await res.json() as { data: Shift[] }
  const all = json.data

  return all
    .filter((s) => !s.assigned_staff_id)
    .map((s) => ({
      id:                 s.id,
      title:              s.title,
      shift_date:         s.shift_date,
      start_time:         s.start_time,
      end_time:           s.end_time,
      shift_type:         s.shift_type,
      location:           s.location,
      client_name:        s.clients
        ? `${s.clients.first_name} ${s.clients.last_name}`
        : s.client_name,
      client_id:          s.clients?.id ?? s.client_id,
      care_package_title: s.care_packages?.title ?? null,
      urgency:            getUrgency(s.shift_date, s.start_time),
    }))
    .sort((a, b) => {
      const urgencyOrder = { critical: 0, high: 1, medium: 2, normal: 3 }
      const uDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
      if (uDiff !== 0) return uDiff
      return a.shift_date.localeCompare(b.shift_date) || a.start_time.localeCompare(b.start_time)
    })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr()    { return new Date().toISOString().slice(0, 10) }
function tomorrowStr() {
  const d = new Date(); d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}
function weekStr() {
  const d = new Date(); d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 10)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function OpenShiftsPage() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const [shifts, metrics] = await Promise.all([
    getOpenShifts(baseUrl),
    getSchedulingMetrics(baseUrl),
  ])

  const today    = todayStr()
  const tomorrow = tomorrowStr()
  const nextWeek = weekStr()

  const openToday    = shifts.filter((s) => s.shift_date === today).length
  const openThisWeek = shifts.filter((s) => s.shift_date >= today && s.shift_date <= nextWeek).length
  const overnight    = shifts.filter((s) => s.end_time <= s.start_time).length
  const urgent       = shifts.filter((s) => s.shift_date <= tomorrow && s.urgency !== 'normal').length

  const availableToday = metrics?.workers_available_today ?? null
  const bookedToday    = metrics?.workers_booked_today    ?? null
  const conflictCount  = metrics?.conflict_count          ?? null

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <Link href="/admin/shifts" className="hover:text-gray-600 transition-colors">
              Shifts
            </Link>
            <span>/</span>
            <span className="text-gray-700">Open Queue</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Open Shifts</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {shifts.length} unassigned shift{shifts.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Open Today</p>
          <p className={`text-2xl font-semibold tabular-nums ${openToday > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {openToday}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Open This Week</p>
          <p className="text-2xl font-semibold tabular-nums text-gray-900">{openThisWeek}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Overnight</p>
          <p className={`text-2xl font-semibold tabular-nums ${overnight > 0 ? 'text-indigo-600' : 'text-gray-900'}`}>
            {overnight}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Urgent (&lt;24h)</p>
          <p className={`text-2xl font-semibold tabular-nums ${urgent > 0 ? 'text-orange-600' : 'text-gray-900'}`}>
            {urgent}
          </p>
        </div>
      </div>

      {/* Scheduling intelligence */}
      {metrics && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span className="text-indigo-700">
            <strong className="font-semibold">{availableToday ?? '—'}</strong>
            <span className="text-indigo-500 ml-1">workers available today</span>
          </span>
          <span className="text-indigo-700">
            <strong className="font-semibold">{bookedToday ?? '—'}</strong>
            <span className="text-indigo-500 ml-1">already booked</span>
          </span>
          {conflictCount !== null && conflictCount > 0 && (
            <span className="text-red-700">
              <strong className="font-semibold">{conflictCount}</strong>
              <span className="text-red-500 ml-1">active conflicts</span>
              <Link href="/admin/shifts/operations" className="ml-2 underline text-xs">
                View →
              </Link>
            </span>
          )}
          <span className="ml-auto text-xs text-indigo-400">
            Click Assign on any shift for ranked worker suggestions
          </span>
        </div>
      )}

      {/* Table */}
      <OpenShiftsTable shifts={shifts} />

    </div>
  )
}
