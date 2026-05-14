import Link from 'next/link'
import CreateCarePackageForm, { type ClientOption }  from './CreateCarePackageForm'
import CarePackageStatusControl                      from './CarePackageStatusControl'
import MobilePageHeader from '@/components/admin/MobilePageHeader'
import { adminFetch } from '@/lib/admin/serverFetch'

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

const STATUS_PILL: Record<string, string> = {
  active: 'bg-green-100  text-green-700',
  draft:  'bg-surface-container-highest text-on-surface-variant',
  paused: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
  ended:  'bg-surface-container-highest text-on-surface-variant',
}

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function avatarColour(id: string): string {
  const colours = [
    'bg-primary-fixed text-on-primary-fixed',
    'bg-secondary-fixed text-on-secondary-fixed',
    'bg-tertiary-fixed text-on-tertiary-fixed',
    'bg-indigo-100 text-indigo-700',
    'bg-violet-100 text-violet-700',
    'bg-sky-100 text-sky-700',
  ]
  return colours[id.charCodeAt(0) % colours.length]
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
  const res = await adminFetch(`${baseUrl}/api/admin/care-packages`, { cache: 'no-store' })
  if (!res.ok) return []
  return res.json() as Promise<CarePackage[]>
}

async function getActiveClients(): Promise<ClientOption[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await adminFetch(`${baseUrl}/api/admin/clients?pageSize=100`, { cache: 'no-store' })
  if (!res.ok) return []
  const json = await res.json() as { data: (ClientOption & { status: string })[] }
  return json.data.filter((c) => c.status === 'active' || c.status === 'prospective')
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CarePackagesPage() {
  const [packages, clients] = await Promise.all([getCarePackages(), getActiveClients()])

  const active  = packages.filter((p) => p.status === 'active').length
  const paused  = packages.filter((p) => p.status === 'paused').length
  const weeklyHours = packages
    .filter((p) => p.status === 'active')
    .reduce((sum, p) => sum + (p.weekly_hours ?? 0), 0)

  return (
    <div className="space-y-6">

      {/* Mobile header */}
      <MobilePageHeader
        title="Care Packages"
        subtitle="Service delivery plans, visit schedules, and capacity tracking."
      />

      {/* Desktop header */}
      <div className="hidden lg:flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-primary tracking-tight">Care Packages</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Service delivery plans, visit schedules, and capacity tracking.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CreateCarePackageForm clients={clients} />
        </div>
      </div>

      {/* Triage Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-container-lowest p-card-padding rounded-xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border border-transparent">
          <div className="flex justify-between items-start mb-4">
            <span className="text-on-surface-variant font-label-md text-label-md">Active Packages</span>
            <span className="material-symbols-outlined text-primary bg-primary-fixed p-2 rounded-lg">local_hospital</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display-lg text-display-lg">{active}</span>
            <span className="text-[12px] font-semibold text-on-surface-variant">
              of {packages.length} total
            </span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-card-padding rounded-xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border border-transparent">
          <div className="flex justify-between items-start mb-4">
            <span className="text-on-surface-variant font-label-md text-label-md">Weekly Hours</span>
            <span className="material-symbols-outlined text-secondary bg-secondary-fixed p-2 rounded-lg">schedule</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display-lg text-display-lg">{weeklyHours}</span>
            <span className="text-[12px] font-semibold text-on-surface-variant">
              active capacity
            </span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-card-padding rounded-xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border border-transparent">
          <div className="flex justify-between items-start mb-4">
            <span className="text-on-surface-variant font-label-md text-label-md">Paused</span>
            <span className="material-symbols-outlined text-on-tertiary-fixed-variant bg-tertiary-fixed p-2 rounded-lg">pause_circle</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display-lg text-display-lg">{paused}</span>
            <span className="text-[12px] font-semibold text-on-surface-variant">
              on hold
            </span>
          </div>
        </div>
      </div>

      {packages.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-8 text-center text-sm text-on-surface-variant">
          No care packages yet. Create one to get started.
        </div>
      ) : (
        <div className="space-y-3">

          {/* ── Mobile card list (lg:hidden) ──────────────────────── */}
          <div className="lg:hidden space-y-2">
            {packages.map((pkg) => {
              const statusCls = STATUS_PILL[pkg.status] ?? STATUS_PILL.draft
              return (
                <div
                  key={pkg.id}
                  className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden"
                >
                  <div className={`flex items-center justify-between px-4 py-2.5 border-b border-outline-variant ${
                    pkg.status === 'active' ? 'bg-green-50/60' : 'bg-surface-container-low'
                  }`}>
                    <div className="min-w-0">
                      {pkg.clients && (
                        <Link
                          href={`/admin/clients/${pkg.clients.id}`}
                          className="text-xs font-semibold text-secondary truncate block"
                        >
                          {pkg.clients.first_name} {pkg.clients.last_name}
                        </Link>
                      )}
                    </div>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusCls}`}>
                      {pkg.status}
                    </span>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-sm font-semibold text-primary truncate">{pkg.title}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-on-surface-variant flex-wrap">
                      <span>{visitSummary(pkg.care_package_visits)}</span>
                      {pkg.weekly_hours && (
                        <span className="font-medium text-on-surface">{pkg.weekly_hours}h/wk</span>
                      )}
                      <span className="ml-auto">From {formatDate(pkg.start_date)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Desktop Power Cards Grid ──────────────────────── */}
          <div className="hidden lg:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {packages.map((pkg) => {
              const statusCls = STATUS_PILL[pkg.status] ?? STATUS_PILL.draft
              const avatar = avatarColour(pkg.id)
              const statusDot = pkg.status === 'active' ? 'bg-green-500' : pkg.status === 'paused' ? 'bg-yellow-500' : 'bg-gray-400'

              return (
                <div
                  key={pkg.id}
                  className="bg-surface-container-lowest rounded-xl p-card-padding shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border border-transparent hover:border-secondary/20 transition-all group relative overflow-hidden flex flex-col"
                >
                  {/* Header */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="relative">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center ${avatar}`}>
                        <span className="material-symbols-outlined text-2xl">medical_services</span>
                      </div>
                      <div className={`absolute bottom-0 right-0 w-4 h-4 border-2 border-white rounded-full ${statusDot}`} title={pkg.status} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-headline-md text-headline-md text-primary truncate">{pkg.title}</h3>
                      {pkg.clients && (
                        <Link
                          href={`/admin/clients/${pkg.clients.id}`}
                          className="text-on-surface-variant font-body-md text-body-md truncate block hover:text-secondary"
                        >
                          {pkg.clients.first_name} {pkg.clients.last_name}
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* Info rows */}
                  <div className="space-y-3 flex-1">
                    <div className="flex justify-between items-center text-[12px]">
                      <span className="text-on-surface-variant font-label-md">Status</span>
                      <CarePackageStatusControl packageId={pkg.id} currentStatus={pkg.status} />
                    </div>
                    <div className="flex justify-between items-center text-[12px]">
                      <span className="text-on-surface-variant font-label-md">Hours/wk</span>
                      <span className="text-on-surface font-semibold tabular-nums">{pkg.weekly_hours ?? '—'}</span>
                    </div>
                    <div className="flex justify-between items-center text-[12px]">
                      <span className="text-on-surface-variant font-label-md">Visits</span>
                      <span className="text-on-surface font-semibold truncate max-w-[140px]" title={visitSummary(pkg.care_package_visits)}>
                        {pkg.care_package_visits.length} / week
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[12px]">
                      <span className="text-on-surface-variant font-label-md">Start</span>
                      <span className="text-on-surface font-semibold">{formatDate(pkg.start_date)}</span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-6 pt-4 border-t border-surface-container-high flex justify-between items-center">
                    {pkg.clients ? (
                      <Link
                        href={`/admin/clients/${pkg.clients.id}`}
                        className="text-secondary font-bold text-[12px] hover:underline"
                      >
                        View Client
                      </Link>
                    ) : (
                      <span className="text-on-surface-variant text-[12px]">No client linked</span>
                    )}
                    <span className="material-symbols-outlined text-outline hover:text-primary transition-colors cursor-pointer">
                      more_vert
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

        </div>
      )}
    </div>
  )
}
