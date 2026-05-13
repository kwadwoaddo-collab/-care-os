import Link from 'next/link'
import CreateClientForm from './CreateClientForm'
import MobilePageHeader from '@/components/admin/MobilePageHeader'
import ListFilters from '@/components/admin/ListFilters'
import Pagination  from '@/components/admin/Pagination'
import type { PaginationMeta } from '@/lib/pagination'
import { sp } from '@/lib/pagination'
import { adminFetch } from '@/lib/admin/serverFetch'

// ── Types ─────────────────────────────────────────────────────────────────────

type SearchParams = Record<string, string | string[] | undefined>

export interface Client {
  id:           string
  first_name:   string
  last_name:    string
  preferred_name: string | null
  postcode:     string | null
  status:       string
  funding_type: string | null
  risk_level:   string
  care_start_date: string | null
  created_at:   string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CLS: Record<string, string> = {
  active:      'bg-green-50  text-green-700  ring-green-600/20',
  paused:      'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  ended:       'bg-gray-50   text-on-surface-variant   ring-gray-400/20',
  prospective: 'bg-blue-50   text-blue-700   ring-blue-600/20',
}

const RISK_CLS: Record<string, string> = {
  low:      'bg-gray-50   text-on-surface-variant   ring-gray-400/20',
  standard: 'bg-blue-50   text-blue-700   ring-blue-600/20',
  high:     'bg-orange-50 text-orange-700 ring-orange-600/20',
  critical: 'bg-red-50    text-red-700    ring-red-600/20',
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
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getClients(
  params: URLSearchParams
): Promise<{ data: Client[]; meta: PaginationMeta }> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await adminFetch(`${baseUrl}/api/admin/clients?${params.toString()}`, { cache: 'no-store' })
  if (!res.ok) return { data: [], meta: { total: 0, page: 1, pageSize: 20, totalPages: 1, hasNext: false, hasPrev: false } }
  return res.json() as Promise<{ data: Client[]; meta: PaginationMeta }>
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const raw = await searchParams

  const params = new URLSearchParams()
  if (sp(raw, 'search'))       params.set('search',       sp(raw, 'search'))
  if (sp(raw, 'status'))       params.set('status',       sp(raw, 'status'))
  if (sp(raw, 'risk_level'))   params.set('risk_level',   sp(raw, 'risk_level'))
  if (sp(raw, 'funding_type')) params.set('funding_type', sp(raw, 'funding_type'))
  if (sp(raw, 'page'))         params.set('page',         sp(raw, 'page'))
  if (sp(raw, 'pageSize'))     params.set('pageSize',     sp(raw, 'pageSize'))

  const { data: clients, meta } = await getClients(params)

  const hasFilters = !!(sp(raw, 'search') || sp(raw, 'status') || sp(raw, 'risk_level') || sp(raw, 'funding_type'))

  // Summary counts from current page total (meta.total includes filter)
  const total    = meta.total
  const active   = clients.filter((c) => c.status === 'active').length
  const paused   = clients.filter((c) => c.status === 'paused').length
  const highRisk = clients.filter((c) => c.risk_level === 'high' || c.risk_level === 'critical').length

  return (
    <div className="space-y-5">

      {/* Mobile header */}
      <MobilePageHeader
        title="Clients"
        subtitle={`${total} client${total !== 1 ? 's' : ''}`}
        action={<CreateClientForm />}
      />

      {/* Desktop header */}
      <div className="hidden lg:flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-primary">Clients</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">{total} client{total !== 1 ? 's' : ''}</p>
        </div>
        <CreateClientForm />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] px-4 py-4">
          <p className="text-xs font-medium text-on-surface-variant mb-1">Total</p>
          <p className="text-2xl font-semibold tabular-nums text-primary">{total}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] px-4 py-4">
          <p className="text-xs font-medium text-on-surface-variant mb-1">Active</p>
          <p className="text-2xl font-semibold tabular-nums text-green-700">{active}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] px-4 py-4">
          <p className="text-xs font-medium text-on-surface-variant mb-1">Paused</p>
          <p className="text-2xl font-semibold tabular-nums text-yellow-700">{paused}</p>
        </div>
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] px-4 py-4">
          <p className="text-xs font-medium text-on-surface-variant mb-1">High / critical risk</p>
          <p className={`text-2xl font-semibold tabular-nums ${highRisk > 0 ? 'text-red-700' : 'text-primary'}`}>{highRisk}</p>
        </div>
      </div>

      {/* Filters */}
      <ListFilters fields={[
        { type: 'text',   name: 'search',       placeholder: 'Search name, postcode, phone…', label: 'Search' },
        { type: 'select', name: 'status',       label: 'Status', options: [
            { value: 'active',      label: 'Active' },
            { value: 'prospective', label: 'Prospective' },
            { value: 'paused',      label: 'Paused' },
            { value: 'ended',       label: 'Ended' },
        ]},
        { type: 'select', name: 'risk_level',   label: 'Risk level', options: [
            { value: 'low',      label: 'Low' },
            { value: 'standard', label: 'Standard' },
            { value: 'high',     label: 'High' },
            { value: 'critical', label: 'Critical' },
        ]},
        { type: 'select', name: 'funding_type', label: 'Funding type', options: [
            { value: 'private',        label: 'Private' },
            { value: 'local_authority', label: 'Local authority' },
            { value: 'nhs',            label: 'NHS' },
            { value: 'direct_payment', label: 'Direct payment' },
            { value: 'other',          label: 'Other' },
        ]},
      ]} />

      {clients.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-10 text-center">
          {hasFilters ? (
            <>
              <p className="text-sm font-medium text-primary">No clients match your filters</p>
              <p className="text-xs text-gray-400 mt-1">Try adjusting or clearing your search filters.</p>
              <a href="/admin/clients" className="mt-4 inline-flex items-center text-xs text-indigo-600 hover:underline">← Clear filters</a>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-primary">No clients yet</p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                Add your first client using the <span className="font-medium text-gray-600">+ New Client</span> button above.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">

          {/* ── Mobile card list (lg:hidden) ───────────────────────── */}
          <div className="lg:hidden space-y-2">
            {clients.map((client) => {
              const initials = [client.first_name.charAt(0), client.last_name.charAt(0)].join('').toUpperCase()
              const isHighRisk = client.risk_level === 'high' || client.risk_level === 'critical'
              return (
                <Link
                  key={client.id}
                  href={`/admin/clients/${client.id}`}
                  className={`flex items-center gap-3.5 bg-white rounded-xl border px-4 py-3.5 shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] active:scale-[0.99] transition-all duration-150 ${
                    isHighRisk ? 'border-orange-200 ring-1 ring-orange-100' : 'border-gray-100'
                  }`}
                >
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-semibold ${
                    isHighRisk ? 'bg-orange-50 text-orange-700' : 'bg-indigo-50 text-indigo-700'
                  }`}>
                    {initials}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-primary truncate">
                      {client.first_name} {client.last_name}
                      {client.preferred_name && (
                        <span className="ml-1.5 text-xs font-normal text-gray-400">({client.preferred_name})</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {[client.postcode, client.funding_type?.replace(/_/g, ' ')].filter(Boolean).join(' · ')}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <Badge value={client.status}     map={STATUS_CLS} />
                    <Badge value={client.risk_level} map={RISK_CLS} />
                  </div>

                  <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              )
            })}
          </div>

          {/* ── Desktop table (hidden on mobile) ───────────────────────── */}
          <div className="hidden lg:block">
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Postcode</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Funding</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Risk</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Care start</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {clients.map((client) => (
                      <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-medium text-primary">{client.first_name} {client.last_name}</span>
                          {client.preferred_name && (
                            <span className="ml-1.5 text-xs text-gray-400">({client.preferred_name})</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{client.postcode ?? '—'}</td>
                        <td className="px-4 py-3 whitespace-nowrap"><Badge value={client.status} map={STATUS_CLS} /></td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {client.funding_type ? client.funding_type.replace(/_/g, ' ') : '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap"><Badge value={client.risk_level} map={RISK_CLS} /></td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(client.care_start_date)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <a href={`/admin/clients/${client.id}`} className="text-xs text-indigo-600 hover:underline">View →</a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <Pagination meta={meta} searchParams={raw} />
        </div>
      )}
    </div>
  )
}
