import CreateCarePackageForm, { type ClientOption }  from './CreateCarePackageForm'
import CarePackageStatusControl                      from './CarePackageStatusControl'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CarePackageVisit {
  id:          string
  day_of_week: number
  start_time:  string
  end_time:    string
}

export interface CarePackage {
  id:           string
  client_id:    string
  title:        string
  status:       string
  funding_type: string | null
  weekly_hours: number | null
  start_date:   string
  end_date:     string | null
  created_at:   string
  clients: {
    id:         string
    first_name: string
    last_name:  string
  } | null
  care_package_visits: CarePackageVisit[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CLS: Record<string, string> = {
  active: 'bg-green-50  text-green-700  ring-green-600/20',
  draft:  'bg-gray-50   text-gray-500   ring-gray-400/20',
  paused: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  ended:  'bg-gray-50   text-gray-400   ring-gray-300/20',
}

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function Badge({ value, map }: { value: string; map: Record<string, string> }) {
  const cls = map[value] ?? 'bg-gray-50 text-gray-600 ring-gray-500/20'
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {value}
    </span>
  )
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function visitSummary(visits: CarePackageVisit[]): string {
  if (visits.length === 0) return 'No visits'
  const sorted = [...visits].sort((a, b) => a.day_of_week - b.day_of_week)
  return sorted
    .map((v) => `${DAYS_SHORT[v.day_of_week]} ${v.start_time.slice(0, 5)}`)
    .join(', ')
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getCarePackages(): Promise<CarePackage[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/admin/care-packages`, { cache: 'no-store' })
  if (!res.ok) return []
  return res.json() as Promise<CarePackage[]>
}

async function getActiveClients(): Promise<ClientOption[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/admin/clients`, { cache: 'no-store' })
  if (!res.ok) return []
  const all = await res.json() as (ClientOption & { status: string })[]
  return all.filter((c) => c.status === 'active' || c.status === 'prospective')
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CarePackagesPage() {
  const [packages, clients] = await Promise.all([getCarePackages(), getActiveClients()])

  const active  = packages.filter((p) => p.status === 'active').length
  const paused  = packages.filter((p) => p.status === 'paused').length
  const ended   = packages.filter((p) => p.status === 'ended').length
  const weeklyHours = packages
    .filter((p) => p.status === 'active')
    .reduce((sum, p) => sum + (p.weekly_hours ?? 0), 0)

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Care Packages</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {packages.length} package{packages.length !== 1 ? 's' : ''}
          </p>
        </div>
        <CreateCarePackageForm clients={clients} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Active</p>
          <p className="text-2xl font-semibold tabular-nums text-green-700">{active}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Paused</p>
          <p className="text-2xl font-semibold tabular-nums text-yellow-700">{paused}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Ended</p>
          <p className="text-2xl font-semibold tabular-nums text-gray-500">{ended}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Weekly hrs (active)</p>
          <p className="text-2xl font-semibold tabular-nums text-gray-900">{weeklyHours}</p>
        </div>
      </div>

      {/* Table */}
      {packages.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-400">
          No care packages yet. Create one to get started.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Package title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Visits</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weekly hrs</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {packages.map((pkg) => (
                  <tr key={pkg.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {pkg.clients ? (
                        <a
                          href={`/admin/clients/${pkg.clients.id}`}
                          className="text-sm font-medium text-indigo-700 hover:underline"
                        >
                          {pkg.clients.first_name} {pkg.clients.last_name}
                        </a>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-900 whitespace-nowrap font-medium">{pkg.title}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <CarePackageStatusControl
                        packageId={pkg.id}
                        currentStatus={pkg.status}
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">
                      {visitSummary(pkg.care_package_visits)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap tabular-nums">
                      {pkg.weekly_hours ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(pkg.start_date)}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(pkg.end_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
