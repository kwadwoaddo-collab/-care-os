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

const STATUS_PILL: Record<string, string> = {
  active:      'bg-green-100  text-green-700',
  paused:      'bg-tertiary-fixed text-on-tertiary-fixed-variant',
  ended:       'bg-surface-container-highest text-on-surface-variant',
  prospective: 'bg-blue-100   text-blue-700',
}

const RISK_PILL: Record<string, string> = {
  low:      'bg-surface-container-highest text-on-surface-variant',
  standard: 'bg-blue-100   text-blue-700',
  high:     'bg-orange-100 text-orange-700',
  critical: 'bg-red-100    text-red-700',
}

function initials(first: string, last: string): string {
  return [first.charAt(0), last.charAt(0)].join('').toUpperCase()
}

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

  const total    = meta.total
  const active   = clients.filter((c) => c.status === 'active').length
  const highRisk = clients.filter((c) => c.risk_level === 'high' || c.risk_level === 'critical').length

  return (
    <div className="space-y-6">

      {/* Mobile header */}
      <MobilePageHeader
        title="Client Registry"
        subtitle="Service users, risk profiles, and care plans."
        action={<CreateClientForm />}
      />

      {/* Desktop header */}
      <div className="hidden lg:flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-primary tracking-tight">Client Registry</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Service users, risk profiles, and care plans.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CreateClientForm />
        </div>
      </div>

      {/* Triage Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-container-lowest p-card-padding rounded-xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border border-transparent">
          <div className="flex justify-between items-start mb-4">
            <span className="text-on-surface-variant font-label-md text-label-md">Total Clients</span>
            <span className="material-symbols-outlined text-primary bg-primary-fixed p-2 rounded-lg">contact_page</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display-lg text-display-lg">{total}</span>
            <span className="text-[12px] font-semibold text-on-surface-variant">
              {total} registered
            </span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-card-padding rounded-xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border border-transparent">
          <div className="flex justify-between items-start mb-4">
            <span className="text-on-surface-variant font-label-md text-label-md">Active Clients</span>
            <span className="material-symbols-outlined text-secondary bg-secondary-fixed p-2 rounded-lg">diversity_3</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display-lg text-display-lg">{active}</span>
            <span className="text-[12px] font-semibold text-on-surface-variant">
              receiving care
            </span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-card-padding rounded-xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border border-transparent">
          <div className="flex justify-between items-start mb-4">
            <span className="text-on-surface-variant font-label-md text-label-md">High / Critical Risk</span>
            <span className="material-symbols-outlined text-on-tertiary-fixed-variant bg-tertiary-fixed p-2 rounded-lg">warning</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display-lg text-display-lg">{highRisk}</span>
            {highRisk > 0 && (
              <span className="text-[12px] font-semibold text-error flex items-center">
                <span className="material-symbols-outlined text-[14px]">priority_high</span>
                needs attention
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-surface-container-lowest p-4 md:p-6 rounded-xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border border-outline-variant">
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
      </div>

      {clients.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-10 text-center">
          {hasFilters ? (
            <>
              <p className="text-sm font-medium text-primary">No clients match your filters</p>
              <p className="text-xs text-on-surface-variant mt-1">Try adjusting or clearing your search filters.</p>
              <Link href="/admin/clients" className="mt-4 inline-flex items-center text-xs text-secondary hover:underline">← Clear filters</Link>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-primary">No clients yet</p>
              <p className="text-xs text-on-surface-variant mt-1 max-w-xs mx-auto">
                Add your first client using the <span className="font-medium text-on-surface">+ New Client</span> button above.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">

          {/* ── Mobile card list (lg:hidden) ───────────────────────── */}
          <div className="lg:hidden space-y-2">
            {clients.map((client) => {
              const ini = initials(client.first_name, client.last_name)
              const isHighRisk = client.risk_level === 'high' || client.risk_level === 'critical'
              const avatar = isHighRisk ? 'bg-orange-100 text-orange-700' : avatarColour(client.id)
              return (
                <Link
                  key={client.id}
                  href={`/admin/clients/${client.id}`}
                  className="flex items-center gap-3.5 bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] px-4 py-3.5 hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] active:scale-[0.99] transition-all duration-150"
                >
                  <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-semibold ${avatar}`}>
                    {ini}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-primary truncate">
                      {client.first_name} {client.last_name}
                      {client.preferred_name && (
                        <span className="ml-1.5 text-xs font-normal text-on-surface-variant">({client.preferred_name})</span>
                      )}
                    </p>
                    <p className="text-xs text-on-surface-variant mt-0.5 truncate">
                      {[client.postcode, client.funding_type?.replace(/_/g, ' ')].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_PILL[client.status] ?? 'bg-surface-container-highest text-on-surface-variant'}`}>
                      {client.status.replace(/_/g, ' ')}
                    </span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${RISK_PILL[client.risk_level] ?? 'bg-surface-container-highest text-on-surface-variant'}`}>
                      {client.risk_level}
                    </span>
                  </div>
                  <svg className="w-4 h-4 text-outline-variant flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              )
            })}
          </div>

          {/* ── Desktop Power Cards Grid ───────────────────────────── */}
          <div className="hidden lg:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {clients.map((client) => {
              const ini = initials(client.first_name, client.last_name)
              const isHighRisk = client.risk_level === 'high' || client.risk_level === 'critical'
              const avatar = isHighRisk ? 'bg-orange-100 text-orange-700' : avatarColour(client.id)
              const riskDot = isHighRisk ? 'bg-red-500' : client.risk_level === 'standard' ? 'bg-blue-500' : 'bg-green-500'

              return (
                <div
                  key={client.id}
                  className="bg-surface-container-lowest rounded-xl p-card-padding shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border border-transparent hover:border-secondary/20 transition-all group relative overflow-hidden flex flex-col"
                >
                  {/* Header */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="relative">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold ${avatar}`}>
                        {ini}
                      </div>
                      <div className={`absolute bottom-0 right-0 w-4 h-4 border-2 border-white rounded-full ${riskDot}`} title={`Risk: ${client.risk_level}`} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-headline-md text-headline-md text-primary truncate">
                        {client.first_name} {client.last_name}
                      </h3>
                      <p className="text-on-surface-variant font-body-md text-body-md truncate">
                        {client.preferred_name ? `"${client.preferred_name}"` : client.postcode ?? '—'}
                      </p>
                    </div>
                  </div>

                  {/* Info rows */}
                  <div className="space-y-3 flex-1">
                    <div className="flex justify-between items-center text-[12px]">
                      <span className="text-on-surface-variant font-label-md">Status</span>
                      <span className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px] ${STATUS_PILL[client.status] ?? 'bg-surface-container-highest text-on-surface-variant'}`}>
                        {client.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[12px]">
                      <span className="text-on-surface-variant font-label-md">Risk</span>
                      <span className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px] ${RISK_PILL[client.risk_level] ?? 'bg-surface-container-highest text-on-surface-variant'}`}>
                        {client.risk_level}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[12px]">
                      <span className="text-on-surface-variant font-label-md">Funding</span>
                      <span className="text-on-surface font-semibold">
                        {client.funding_type?.replace(/_/g, ' ') ?? '—'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[12px]">
                      <span className="text-on-surface-variant font-label-md">Care start</span>
                      <span className="text-on-surface font-semibold">{formatDate(client.care_start_date)}</span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-6 pt-4 border-t border-surface-container-high flex justify-between items-center">
                    <Link
                      href={`/admin/clients/${client.id}`}
                      className="text-secondary font-bold text-[12px] hover:underline"
                    >
                      View Profile
                    </Link>
                    <Link
                      href={`/admin/clients/${client.id}`}
                      className="material-symbols-outlined text-outline hover:text-primary transition-colors"
                      aria-label={`More options for ${client.first_name} ${client.last_name}`}
                    >
                      more_vert
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>

          <Pagination meta={meta} searchParams={raw} />
        </div>
      )}
    </div>
  )
}
