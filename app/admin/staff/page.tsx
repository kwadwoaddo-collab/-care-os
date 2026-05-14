import Link from 'next/link'
import AddExistingStaffForm from './AddExistingStaffForm'
import StaffGrid, { type StaffProfileWithCompliance } from './StaffGrid'
import StaffMobileList from './StaffMobileList'
import MobilePageHeader from '@/components/admin/MobilePageHeader'
import ListFilters from '@/components/admin/ListFilters'
import Pagination  from '@/components/admin/Pagination'
import type { PaginationMeta } from '@/lib/pagination'
import { sp } from '@/lib/pagination'
import type { AlertsResponse } from '@/app/api/admin/compliance/alerts/route'
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
    <div className="space-y-6">
      {/* Mobile page header (lg:hidden) */}
      <MobilePageHeader
        title="Staff & Recruitment"
        subtitle="Workforce management, onboarding pipeline, and compliance health."
        action={<AddExistingStaffForm />}
      />

      {/* Desktop header (hidden on mobile) */}
      <div className="hidden lg:flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-primary tracking-tight">Staff & Recruitment Hub</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Workforce management, onboarding pipeline, and compliance health.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/staff/archived"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-100 border border-gray-200 hover:bg-gray-200 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">archive</span>
            Archived Staff
          </Link>
          <AddExistingStaffForm />
        </div>
      </div>

      {/* Triage Metrics Row */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Total Staff */}
          <div className="bg-surface-container-lowest p-card-padding rounded-xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border border-transparent">
            <div className="flex justify-between items-start mb-4">
              <span className="text-on-surface-variant font-label-md text-label-md">Total Staff</span>
              <span className="material-symbols-outlined text-primary bg-primary-fixed p-2 rounded-lg">groups</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display-lg text-display-lg">{summary.totalStaff}</span>
              <span className="text-[12px] font-semibold text-on-surface-variant">
                {meta.total} profile{meta.total !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Active Staff */}
          <div className="bg-surface-container-lowest p-card-padding rounded-xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border border-transparent">
            <div className="flex justify-between items-start mb-4">
              <span className="text-on-surface-variant font-label-md text-label-md">Active Clinicians</span>
              <span className="material-symbols-outlined text-secondary bg-secondary-fixed p-2 rounded-lg">clinical_notes</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display-lg text-display-lg">{summary.activeStaff}</span>
              <span className="text-[12px] font-semibold text-on-surface-variant">
                {summary.totalStaff > 0 ? `Capacity: ${Math.round((summary.activeStaff / summary.totalStaff) * 100)}%` : '—'}
              </span>
            </div>
          </div>

          {/* Pending Onboarding / Non-Compliant */}
          <div className="bg-surface-container-lowest p-card-padding rounded-xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border border-transparent">
            <div className="flex justify-between items-start mb-4">
              <span className="text-on-surface-variant font-label-md text-label-md">Pending Onboarding</span>
              <span className="material-symbols-outlined text-on-tertiary-fixed-variant bg-tertiary-fixed p-2 rounded-lg">pending_actions</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display-lg text-display-lg">{summary.nonCompliantCount}</span>
              {summary.expiredCount > 0 && (
                <span className="text-[12px] font-semibold text-error flex items-center">
                  <span className="material-symbols-outlined text-[14px]">warning</span>
                  {summary.expiredCount} expired
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-surface-container-lowest p-4 md:p-6 rounded-xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border border-outline-variant">
        <ListFilters fields={[
          { type: 'text',   name: 'search',     placeholder: 'Search by name, role, or email…', label: 'Search' },
          { type: 'select', name: 'status',     label: 'Status', options: [
              { value: 'pre_employment', label: 'Pre-employment' },
              { value: 'active',         label: 'Active' },
              { value: 'suspended',      label: 'Suspended' },
              { value: 'inactive',       label: 'Inactive' },
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
      </div>

      {staff.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-8 text-center text-sm text-on-surface-variant">
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
          {/* Desktop grid — hidden on mobile */}
          <div className="hidden lg:block">
            <StaffGrid staff={staff} />
          </div>
          <Pagination meta={meta} searchParams={raw} />
        </div>
      )}
    </div>
  )
}
