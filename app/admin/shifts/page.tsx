import ShiftsTable, { type Shift } from './ShiftsTable'
import CreateShiftForm, { type ReadyStaff, type ActiveClient } from './CreateShiftForm'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StaffListItem {
  id:         string
  first_name: string | null
  last_name:  string | null
  email:      string | null
  status:     string
  readiness:  { ready: boolean; score: number }
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getShifts(): Promise<Shift[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/admin/shifts`, { cache: 'no-store' })
  if (!res.ok) return []
  return res.json() as Promise<Shift[]>
}

async function getReadyStaff(): Promise<ReadyStaff[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/admin/staff`, { cache: 'no-store' })
  if (!res.ok) return []
  const all = await res.json() as StaffListItem[]
  return all.filter((s) => s.status === 'active' && s.readiness.ready)
}

async function getActiveClients(): Promise<ActiveClient[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/admin/clients`, { cache: 'no-store' })
  if (!res.ok) return []
  const all = await res.json() as (ActiveClient & { status: string })[]
  return all.filter((c) => c.status === 'active')
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ShiftsPage() {
  const [shifts, readyStaff, activeClients] = await Promise.all([getShifts(), getReadyStaff(), getActiveClients()])

  const today     = todayStr()
  const todayCount    = shifts.filter((s) => s.shift_date === today).length
  const upcomingCount = shifts.filter((s) => s.shift_date >  today).length
  const scheduledCount = shifts.filter((s) => s.status === 'scheduled' || s.status === 'confirmed').length

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
            {shifts.length} shift{shifts.length !== 1 ? 's' : ''}
          </p>
        </div>
        <CreateShiftForm companyId={companyId} readyStaff={readyStaff} activeClients={activeClients} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Total</p>
          <p className="text-2xl font-semibold tabular-nums text-gray-900">{shifts.length}</p>
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

      {/* Table */}
      {shifts.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-400">
          No shifts yet. Create one to get started.
        </div>
      ) : (
        <ShiftsTable shifts={shifts} />
      )}
    </div>
  )
}
