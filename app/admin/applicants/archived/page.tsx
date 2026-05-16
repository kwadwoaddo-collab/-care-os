import Link from 'next/link'
import ArchivedApplicantActions from './ArchivedApplicantActions'
import { adminFetch } from '@/lib/admin/serverFetch'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/rbac/permissions'
import AccessDenied from '@/components/admin/AccessDenied'
import type { PaginationMeta } from '@/lib/pagination'
import { sp } from '@/lib/pagination'
import Pagination from '@/components/admin/Pagination'
import ListFilters from '@/components/admin/ListFilters'
import MobilePageHeader from '@/components/admin/MobilePageHeader'

// ── Types ─────────────────────────────────────────────────────────────────────

type SearchParams = Record<string, string | string[] | undefined>

interface ArchivedApplicantRow {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  job_role: string | null
  status: string
  created_at: string
  rejected_at: string | null
  rejection_reason: string | null
  form_status: string | null
  submitted_at: string | null
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getArchivedApplicants(
  params: URLSearchParams
): Promise<{ data: ArchivedApplicantRow[]; meta: PaginationMeta }> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  params.set('archived', 'true')
  const res = await adminFetch(`${baseUrl}/api/admin/applicants?${params.toString()}`, {
    cache: 'no-store',
  })
  if (!res.ok) return { data: [], meta: { total: 0, page: 1, pageSize: 20, totalPages: 1, hasNext: false, hasPrev: false } }
  return res.json() as Promise<{ data: ArchivedApplicantRow[]; meta: PaginationMeta }>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(first: string | null, last: string | null): string {
  return [(first ?? '').charAt(0), (last ?? '').charAt(0)]
    .filter(Boolean)
    .join('')
    .toUpperCase() || '?'
}

function avatarColour(id: string): string {
  const colours = [
    'bg-red-100 text-red-700',
    'bg-orange-100 text-orange-700',
    'bg-pink-100 text-pink-700',
    'bg-rose-100 text-rose-700',
  ]
  return colours[id.charCodeAt(0) % colours.length]
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ArchivedApplicantsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const auth = await requireAdmin()
  if (!auth.ok || !can(auth.ctx.role, 'applicants:read')) return <AccessDenied />

  const canDelete = can(auth.ctx.role, 'applicants:delete')

  const raw = await searchParams
  const params = new URLSearchParams()
  if (sp(raw, 'search'))      params.set('search',      sp(raw, 'search'))
  if (sp(raw, 'form_status')) params.set('form_status', sp(raw, 'form_status'))
  if (sp(raw, 'page'))        params.set('page',        sp(raw, 'page'))
  if (sp(raw, 'pageSize'))    params.set('pageSize',    sp(raw, 'pageSize'))

  const { data: applicants, meta } = await getArchivedApplicants(params)
  const hasFilters = !!(sp(raw, 'search') || sp(raw, 'form_status'))

  return (
    <div className="space-y-6">
      {/* Mobile header */}
      <MobilePageHeader
        title="Archived Applicants"
        subtitle="Rejected applicants archived from the active pipeline."
      />

      {/* Desktop header */}
      <div className="hidden lg:flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/applicants"
              className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-primary transition-colors"
            >
              ← Pipeline
            </Link>
            <span className="text-outline-variant">/</span>
            <h1 className="text-xl font-semibold text-primary tracking-tight">Archived Applicants</h1>
          </div>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Rejected applicants. Restore to move them back to the active pipeline.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-on-surface-variant bg-surface-container px-3 py-1.5 rounded-lg border border-outline-variant">
            {meta.total} archived
          </span>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-surface-container-lowest p-4 md:p-6 rounded-xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border border-outline-variant">
        <ListFilters fields={[
          { type: 'text',   name: 'search',      placeholder: 'Search by name, email, or role…', label: 'Search' },
          { type: 'select', name: 'form_status', label: 'Form status', options: [
            { value: 'draft',     label: 'Draft' },
            { value: 'submitted', label: 'Submitted' },
          ]},
        ]} />
      </div>

      {/* Empty state */}
      {applicants.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-8 text-center">
          <span className="material-symbols-outlined text-4xl text-outline-variant block mb-2">archive</span>
          <p className="text-sm text-on-surface-variant font-medium">
            {hasFilters ? 'No archived applicants match your filters.' : 'No archived applicants yet.'}
          </p>
          <p className="text-xs text-on-surface-variant mt-1">
            Rejected applicants will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">

          {/* ── Mobile cards ────────────────────────────────────────────── */}
          <div className="lg:hidden space-y-2">
            {applicants.map((a) => {
              const name = [a.first_name, a.last_name].filter(Boolean).join(' ') || 'No name'
              return (
                <div
                  key={a.id}
                  className="bg-surface-container-lowest rounded-xl border border-red-100 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] px-4 py-3.5 space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-semibold ${avatarColour(a.id)}`}>
                      {initials(a.first_name, a.last_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-primary truncate">{name}</p>
                      <p className="text-xs text-on-surface-variant mt-0.5 truncate">{a.job_role ?? a.email}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                        rejected
                      </span>
                    </div>
                  </div>
                  <div className="bg-red-50/50 rounded-lg p-3 text-xs space-y-1.5 border border-red-100/50">
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant font-medium">Applied</span>
                      <span className="text-on-surface">{formatDate(a.created_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant font-medium">Rejected</span>
                      <span className="text-red-700 font-medium">{formatDate(a.rejected_at)}</span>
                    </div>
                    {a.rejection_reason && (
                      <div className="pt-1 mt-1 border-t border-red-100/50">
                        <span className="text-on-surface-variant font-medium block mb-0.5">Reason</span>
                        <span className="text-red-700 line-clamp-2">{a.rejection_reason}</span>
                      </div>
                    )}
                  </div>
                  <ArchivedApplicantActions
                    applicantId={a.id}
                    applicantName={name}
                    canDelete={canDelete}
                  />
                </div>
              )
            })}
          </div>

          {/* ── Desktop table ────────────────────────────────────────────── */}
          <div className="hidden lg:block bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border border-outline-variant overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant">Applicant</th>
                  <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant">Role</th>
                  <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant">Applied</th>
                  <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant">Rejected</th>
                  <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant">Reason</th>
                  <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant">Form</th>
                  <th className="px-4 py-3 text-xs font-semibold text-on-surface-variant text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {applicants.map((a) => {
                  const name = [a.first_name, a.last_name].filter(Boolean).join(' ') || 'No name'
                  return (
                    <tr key={a.id} className="hover:bg-surface-container/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-semibold ${avatarColour(a.id)}`}>
                            {initials(a.first_name, a.last_name)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-primary truncate">{name}</p>
                            <p className="text-xs text-on-surface-variant truncate">{a.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant text-xs">
                        {a.job_role?.replace(/_/g, ' ') ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-on-surface-variant whitespace-nowrap">
                        {formatDate(a.created_at)}
                      </td>
                      <td className="px-4 py-3 text-xs text-red-600 whitespace-nowrap">
                        {formatDate(a.rejected_at)}
                      </td>
                      <td className="px-4 py-3 text-xs text-on-surface-variant max-w-[150px] truncate" title={a.rejection_reason ?? '—'}>
                        {a.rejection_reason ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        {a.form_status ? (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${a.form_status === 'submitted' ? 'bg-green-100 text-green-700' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                            {a.form_status}
                          </span>
                        ) : (
                          <span className="text-xs text-on-surface-variant">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ArchivedApplicantActions
                          applicantId={a.id}
                          applicantName={name}
                          canDelete={canDelete}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <Pagination meta={meta} searchParams={raw} />
        </div>
      )}
    </div>
  )
}
