import AddExistingStaffForm from './AddExistingStaffForm'
import StaffTable, { type StaffProfileWithCompliance } from './StaffTable'
import StaffMobileList from './StaffMobileList'
import MobilePageHeader from '@/components/admin/MobilePageHeader'
import ListFilters from '@/components/admin/ListFilters'
import Pagination  from '@/components/admin/Pagination'
import type { PaginationMeta } from '@/lib/pagination'
import { sp } from '@/lib/pagination'
import type { AlertsResponse, AlertItem } from '@/app/api/admin/compliance/alerts/route'
import { adminFetch } from '@/lib/admin/serverFetch'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/auth/permissions'
import AccessDenied from '@/components/admin/AccessDenied'

type SearchParams = Record<string, string | string[] | undefined>

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getStaff(
  params: URLSearchParams
): Promise<{ data: StaffProfileWithCompliance[]; meta: PaginationMeta }> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await adminFetch(`${baseUrl}/api/admin/staff?${params.toString()}`, { cache: 'no-store' })
  if (!res.ok) return { data: [], meta: { total: 0, page: 1, pageSize: 20, totalPages: 1, hasNext: false, hasPrev: false } }
  return res.json() as Promise<{ data: StaffProfileWithCompliance[]; meta: PaginationMeta }>
}

async function getAlerts(): Promise<AlertsResponse | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await adminFetch(`${baseUrl}/api/admin/compliance/alerts`, { cache: 'no-store' })
  if (!res.ok) return null
  return res.json() as Promise<AlertsResponse>
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryCard({ label, value, accent = 'none' }: {
  label: string; value: string | number; accent?: 'red' | 'amber' | 'green' | 'none'
}) {
  const valCls = accent === 'red' ? 'text-red-600' : accent === 'amber' ? 'text-yellow-600' : accent === 'green' ? 'text-green-600' : 'text-gray-900'
  return (
    <div className="bg-white rounded-lg border border-gray-200 px-4 py-4">
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${valCls}`}>{value}</p>
    </div>
  )
}

const SEVERITY_CLS: Record<string, string> = {
  expired: 'bg-red-50    text-red-700    ring-red-600/20',
  warning: 'bg-orange-50 text-orange-700 ring-orange-600/20',
  notice:  'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
}

function SeverityBadge({ severity }: { severity: AlertItem['severity'] }) {
  const cls = SEVERITY_CLS[severity] ?? 'bg-gray-50 text-gray-600 ring-gray-500/20'
  const label = severity === 'expired' ? 'Expired' : severity === 'warning' ? 'Within 7 days' : 'Within 30 days'
  return <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${cls}`}>{label}</span>
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function ComplianceAlertsSection({ alerts }: { alerts: AlertsResponse }) {
  const rows: AlertItem[] = [...alerts.expired, ...alerts.expiringSoon]
  if (rows.length === 0) return null
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-gray-700">
          Compliance Alerts
          <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">{rows.length}</span>
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Staff', 'Issue', 'Document', 'Expiry date', 'Severity'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, i) => (
              <tr key={`${row.staffId}-${row.documentType}-${i}`} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-indigo-700 whitespace-nowrap">
                  <a href={`/admin/staff/${row.staffId}`} className="hover:underline">{row.staffName}</a>
                </td>
                <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{row.issue}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{row.documentType.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(row.expiryDate)}</td>
                <td className="px-4 py-3 whitespace-nowrap"><SeverityBadge severity={row.severity} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const auth = await requireAdmin()
  if (!auth.ok || !can(auth.ctx.role, 'staff:read')) return <AccessDenied />

  const raw = await searchParams

  const params = new URLSearchParams()
  if (sp(raw, 'search'))     params.set('search',     sp(raw, 'search'))
  if (sp(raw, 'status'))     params.set('status',     sp(raw, 'status'))
  if (sp(raw, 'compliance')) params.set('compliance', sp(raw, 'compliance'))
  if (sp(raw, 'readiness'))  params.set('readiness',  sp(raw, 'readiness'))
  if (sp(raw, 'page'))       params.set('page',       sp(raw, 'page'))

  const [{ data: staff, meta }, alerts] = await Promise.all([getStaff(params), getAlerts()])
  const summary = alerts?.summary

  return (
    <div className="space-y-5">
      {/* Mobile page header (lg:hidden) */}
      <MobilePageHeader
        title="Staff"
        subtitle={`${meta.total} profile${meta.total !== 1 ? 's' : ''}`}
        action={<AddExistingStaffForm />}
      />

      {/* Desktop header (hidden on mobile) */}
      <div className="hidden lg:flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Staff</h1>
          <p className="text-sm text-gray-500 mt-0.5">{meta.total} profile{meta.total !== 1 ? 's' : ''}</p>
        </div>
        <AddExistingStaffForm />
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <SummaryCard label="Total staff"        value={summary.totalStaff} />
          <SummaryCard label="Active staff"       value={summary.activeStaff}       accent="green" />
          <SummaryCard label="Non-compliant"      value={summary.nonCompliantCount}  accent={summary.nonCompliantCount > 0 ? 'red' : 'none'} />
          <SummaryCard label="Expiring ≤ 30 days" value={summary.expiringWithin30}   accent={summary.expiringWithin30 > 0 ? 'amber' : 'none'} />
          <SummaryCard label="Expired documents"  value={summary.expiredCount}       accent={summary.expiredCount > 0 ? 'red' : 'none'} />
          <SummaryCard label="Avg compliance"     value={`${summary.averageCompliance}%`} accent={summary.averageCompliance >= 100 ? 'green' : summary.averageCompliance >= 70 ? 'amber' : 'red'} />
        </div>
      )}

      {alerts && <ComplianceAlertsSection alerts={alerts} />}

      {/* Filters */}
      <ListFilters fields={[
        { type: 'text',   name: 'search',     placeholder: 'Search name, email, role…', label: 'Search' },
        { type: 'select', name: 'status',     label: 'Status', options: [
            { value: 'pre_employment', label: 'Pre-employment' },
            { value: 'active',         label: 'Active' },
            { value: 'suspended',      label: 'Suspended' },
            { value: 'inactive',       label: 'Inactive' },
            { value: 'terminated',     label: 'Terminated' },
        ]},
        { type: 'select', name: 'compliance', label: 'Compliance', options: [
            { value: 'compliant',     label: 'Compliant' },
            { value: 'non_compliant', label: 'Non-compliant' },
            { value: 'expiring',      label: 'Expiring / expired' },
        ]},
        { type: 'select', name: 'readiness',  label: 'Readiness', options: [
            { value: 'ready',     label: 'Ready' },
            { value: 'not_ready', label: 'Not ready' },
        ]},
      ]} />

      {staff.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-400">
          {Object.keys(raw).length > 0
            ? 'No results found. Try changing your filters.'
            : 'No staff profiles yet. Convert a hired applicant to create one.'}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Mobile card list — hidden on lg+ */}
          <div className="lg:hidden">
            <StaffMobileList staff={staff} />
          </div>
          {/* Desktop table — hidden on mobile */}
          <div className="hidden lg:block">
            <StaffTable staff={staff} />
          </div>
          <Pagination meta={meta} searchParams={raw} />
        </div>
      )}
    </div>
  )
}
