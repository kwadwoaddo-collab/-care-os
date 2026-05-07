import Link from 'next/link'
import ListFilters from '@/components/admin/ListFilters'
import Pagination  from '@/components/admin/Pagination'
import type { PaginationMeta } from '@/lib/pagination'
import { sp } from '@/lib/pagination'

// ── Types ─────────────────────────────────────────────────────────────────────

type SearchParams = Record<string, string | string[] | undefined>

interface IncidentRow {
  id:                  string
  incident_type:       string
  severity:            string
  status:              string
  occurred_at:         string | null
  description:         string
  escalation_required: boolean
  created_at:          string
  clients:             { id: string; first_name: string; last_name: string } | null
  staff_profiles:      { id: string; first_name: string | null; last_name: string | null } | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEVERITY_CLS: Record<string, string> = {
  low:      'bg-gray-50    text-gray-600   ring-gray-400/20',
  medium:   'bg-yellow-50  text-yellow-700 ring-yellow-600/20',
  high:     'bg-orange-50  text-orange-700 ring-orange-600/20',
  critical: 'bg-red-50     text-red-700    ring-red-600/20',
}

const STATUS_CLS: Record<string, string> = {
  open:          'bg-red-50     text-red-700    ring-red-600/20',
  investigating: 'bg-blue-50    text-blue-700   ring-blue-600/20',
  resolved:      'bg-green-50   text-green-700  ring-green-600/20',
  closed:        'bg-gray-50    text-gray-500   ring-gray-400/20',
}

function Badge({ value, map }: { value: string; map: Record<string, string> }) {
  const cls = map[value] ?? 'bg-gray-50 text-gray-600 ring-gray-500/20'
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {value.replace(/_/g, ' ')}
    </span>
  )
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function staffName(s: { first_name: string | null; last_name: string | null } | null): string {
  if (!s) return '—'
  return [s.first_name, s.last_name].filter(Boolean).join(' ') || '—'
}

function clientName(c: { first_name: string; last_name: string } | null): string {
  if (!c) return '—'
  return `${c.first_name} ${c.last_name}`
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getIncidents(
  params: URLSearchParams,
): Promise<{ data: IncidentRow[]; meta: PaginationMeta }> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/admin/incidents?${params.toString()}`, { cache: 'no-store' })
  if (!res.ok) return { data: [], meta: { total: 0, page: 1, pageSize: 20, totalPages: 1, hasNext: false, hasPrev: false } }
  return res.json() as Promise<{ data: IncidentRow[]; meta: PaginationMeta }>
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const raw = await searchParams

  const params = new URLSearchParams()
  if (sp(raw, 'search'))        params.set('search',        sp(raw, 'search'))
  if (sp(raw, 'status'))        params.set('status',        sp(raw, 'status'))
  if (sp(raw, 'severity'))      params.set('severity',      sp(raw, 'severity'))
  if (sp(raw, 'incident_type')) params.set('incident_type', sp(raw, 'incident_type'))
  if (sp(raw, 'page'))          params.set('page',          sp(raw, 'page'))
  if (sp(raw, 'pageSize'))      params.set('pageSize',      sp(raw, 'pageSize'))

  const { data: incidents, meta } = await getIncidents(params)

  const hasFilters = !!(sp(raw, 'search') || sp(raw, 'status') || sp(raw, 'severity') || sp(raw, 'incident_type'))

  // Summary counts (from full dataset on page 1 unfiltered — approximation from current page)
  const openCount     = incidents.filter((i) => i.status === 'open').length
  const highCritical  = incidents.filter((i) => i.severity === 'high' || i.severity === 'critical').length
  const investigating = incidents.filter((i) => i.status === 'investigating').length

  // Resolved this month
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const resolvedThisMonth = incidents.filter(
    (i) =>
      (i.status === 'resolved' || i.status === 'closed') &&
      new Date(i.created_at) >= monthStart,
  ).length

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Incidents</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {meta.total} incident{meta.total !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Open</p>
          <p className={`text-2xl font-semibold tabular-nums ${openCount > 0 ? 'text-red-700' : 'text-gray-900'}`}>
            {openCount}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-4">
          <p className="text-xs font-medium text-gray-500 mb-1">High / Critical</p>
          <p className={`text-2xl font-semibold tabular-nums ${highCritical > 0 ? 'text-orange-700' : 'text-gray-900'}`}>
            {highCritical}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Investigating</p>
          <p className="text-2xl font-semibold tabular-nums text-blue-700">{investigating}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 px-4 py-4">
          <p className="text-xs font-medium text-gray-500 mb-1">Resolved this month</p>
          <p className="text-2xl font-semibold tabular-nums text-green-700">{resolvedThisMonth}</p>
        </div>
      </div>

      {/* Filters */}
      <ListFilters fields={[
        { type: 'text',   name: 'search',        placeholder: 'Search description…', label: 'Search' },
        { type: 'select', name: 'status',        label: 'Status', options: [
            { value: 'open',          label: 'Open' },
            { value: 'investigating', label: 'Investigating' },
            { value: 'resolved',      label: 'Resolved' },
            { value: 'closed',        label: 'Closed' },
        ]},
        { type: 'select', name: 'severity',      label: 'Severity', options: [
            { value: 'low',      label: 'Low' },
            { value: 'medium',   label: 'Medium' },
            { value: 'high',     label: 'High' },
            { value: 'critical', label: 'Critical' },
        ]},
        { type: 'select', name: 'incident_type', label: 'Type', options: [
            { value: 'fall',             label: 'Fall' },
            { value: 'medication_error', label: 'Medication error' },
            { value: 'safeguarding',     label: 'Safeguarding' },
            { value: 'injury',           label: 'Injury' },
            { value: 'behaviour',        label: 'Behaviour' },
            { value: 'missed_visit',     label: 'Missed visit' },
            { value: 'property_damage',  label: 'Property damage' },
            { value: 'complaint',        label: 'Complaint' },
            { value: 'other',            label: 'Other' },
        ]},
      ]} />

      {/* Table */}
      {incidents.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-400">
          {hasFilters
            ? 'No results found. Try changing your filters.'
            : 'No incidents recorded yet.'}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Severity</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Escalation</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {incidents.map((inc) => (
                    <tr key={inc.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {formatDate(inc.occurred_at ?? inc.created_at)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {inc.clients ? (
                          <Link
                            href={`/admin/clients/${inc.clients.id}`}
                            className="text-indigo-700 hover:underline text-sm font-medium"
                          >
                            {clientName(inc.clients)}
                          </Link>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {inc.staff_profiles ? (
                          <Link
                            href={`/admin/staff/${inc.staff_profiles.id}`}
                            className="text-indigo-700 hover:underline"
                          >
                            {staffName(inc.staff_profiles)}
                          </Link>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-gray-700">{inc.incident_type.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge value={inc.severity} map={SEVERITY_CLS} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge value={inc.status} map={STATUS_CLS} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {inc.escalation_required ? (
                          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset bg-red-50 text-red-700 ring-red-600/20">
                            Yes
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <Link
                          href={`/admin/incidents/${inc.id}`}
                          className="text-xs text-indigo-600 hover:underline"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination meta={meta} searchParams={raw} />
        </div>
      )}
    </div>
  )
}
