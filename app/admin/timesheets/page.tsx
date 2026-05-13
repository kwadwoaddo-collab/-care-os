import TimesheetsTable, { type Timesheet } from './TimesheetsTable'
import { adminFetch } from '@/lib/admin/serverFetch'

// Routes and DB always work regardless of feature flag.
// The nav link is hidden when ENABLE_TIMESHEETS=false, but this URL is
// accessible directly for manual admin testing.

async function getTimesheets(): Promise<Timesheet[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await adminFetch(`${baseUrl}/api/admin/timesheets`, { cache: 'no-store' })
  if (!res.ok) return []
  return res.json() as Promise<Timesheet[]>
}

function workedHours(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export default async function TimesheetsPage() {
  const timesheets = await getTimesheets()

  const totalWorked = timesheets.reduce(
    (sum, t) => sum + (t.worked_minutes ?? 0), 0
  )
  const completedCount = timesheets.filter(
    (t) => t.status === 'completed' || t.status === 'adjusted'
  ).length
  const missedCount = timesheets.filter((t) => t.status === 'missed').length
  const pendingCount = timesheets.filter((t) => t.status === 'pending').length

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-primary">Timesheets</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            {timesheets.length} record{timesheets.length !== 1 ? 's' : ''}
            {' '}·{' '}
            <span className="text-amber-600 font-medium">Infrastructure preview — not yet operational</span>
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] px-4 py-4">
          <p className="text-xs font-medium text-on-surface-variant mb-1">Total records</p>
          <p className="text-2xl font-semibold tabular-nums text-primary">{timesheets.length}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] px-4 py-4">
          <p className="text-xs font-medium text-on-surface-variant mb-1">Completed</p>
          <p className={`text-2xl font-semibold tabular-nums ${completedCount > 0 ? 'text-green-600' : 'text-primary'}`}>
            {completedCount}
          </p>
        </div>
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] px-4 py-4">
          <p className="text-xs font-medium text-on-surface-variant mb-1">Missed</p>
          <p className={`text-2xl font-semibold tabular-nums ${missedCount > 0 ? 'text-red-600' : 'text-primary'}`}>
            {missedCount}
          </p>
        </div>
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] px-4 py-4">
          <p className="text-xs font-medium text-on-surface-variant mb-1">Total worked</p>
          <p className="text-2xl font-semibold tabular-nums text-primary">
            {workedHours(totalWorked)}
          </p>
        </div>
      </div>

      {/* Table */}
      {timesheets.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-8 text-center text-sm text-gray-400">
          No timesheets recorded yet.
        </div>
      ) : (
        <TimesheetsTable timesheets={timesheets} />
      )}
    </div>
  )
}
