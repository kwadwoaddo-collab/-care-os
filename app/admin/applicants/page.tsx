import Link from 'next/link'
import InviteApplicantForm from './InviteApplicantForm'
import ResendInviteButton from './ResendInviteButton'
import MobilePageHeader from '@/components/admin/MobilePageHeader'
import ListFilters from '@/components/admin/ListFilters'
import Pagination  from '@/components/admin/Pagination'
import type { PaginationMeta } from '@/lib/pagination'
import { sp } from '@/lib/pagination'
import { adminFetch } from '@/lib/admin/serverFetch'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/auth/permissions'
import AccessDenied from '@/components/admin/AccessDenied'

// ── Types ─────────────────────────────────────────────────────────────────────

type SearchParams = Record<string, string | string[] | undefined>

interface ApplicantRow {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  job_role: string | null
  status: string
  created_at: string
  form_status: string | null
  submitted_at: string | null
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getApplicants(
  params: URLSearchParams
): Promise<{ data: ApplicantRow[]; meta: PaginationMeta }> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await adminFetch(`${baseUrl}/api/admin/applicants?${params.toString()}`, {
    cache: 'no-store',
  })
  if (!res.ok) return { data: [], meta: { total: 0, page: 1, pageSize: 20, totalPages: 1, hasNext: false, hasPrev: false } }
  return res.json() as Promise<{ data: ApplicantRow[]; meta: PaginationMeta }>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_PILL: Record<string, string> = {
  applied:              'bg-blue-100 text-blue-700',
  shortlisted:          'bg-tertiary-fixed text-on-tertiary-fixed-variant',
  rejected:             'bg-red-100 text-red-700',
  interview_scheduled:  'bg-purple-100 text-purple-700',
  hired:                'bg-green-100 text-green-700',
  withdrawn:            'bg-surface-container-highest text-on-surface-variant',
}

const FORM_PILL: Record<string, string> = {
  draft:     'bg-surface-container-highest text-on-surface-variant',
  submitted: 'bg-green-100 text-green-700',
}

function initials(first: string | null, last: string | null): string {
  return [(first ?? '').charAt(0), (last ?? '').charAt(0)]
    .filter(Boolean)
    .join('')
    .toUpperCase() || '?'
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
  const idx = id.charCodeAt(0) % colours.length
  return colours[idx]
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ApplicantsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const auth = await requireAdmin()
  if (!auth.ok || !can(auth.ctx.role, 'applicants:read')) return <AccessDenied />

  const raw = await searchParams

  const params = new URLSearchParams()
  if (sp(raw, 'search'))      params.set('search',      sp(raw, 'search'))
  if (sp(raw, 'status'))      params.set('status',      sp(raw, 'status'))
  if (sp(raw, 'form_status')) params.set('form_status', sp(raw, 'form_status'))
  if (sp(raw, 'page'))        params.set('page',        sp(raw, 'page'))
  if (sp(raw, 'pageSize'))    params.set('pageSize',    sp(raw, 'pageSize'))

  const { data: applicants, meta } = await getApplicants(params)
  const hasFilters = !!(sp(raw, 'search') || sp(raw, 'status') || sp(raw, 'form_status'))

  // Compute triage metrics
  const newApps   = applicants.filter((a) => a.status === 'applied').length
  const inProgress = applicants.filter((a) => ['shortlisted', 'interview_scheduled'].includes(a.status)).length
  const hired     = applicants.filter((a) => a.status === 'hired').length

  return (
    <div className="space-y-6">
      {/* Mobile page header */}
      <MobilePageHeader
        title="Talent Pipeline"
        subtitle="Applicant tracking, screening, and hiring decisions."
        action={<InviteApplicantForm />}
      />

      {/* Desktop header */}
      <div className="hidden lg:flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-primary tracking-tight">Talent Pipeline</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Applicant tracking, screening, and hiring decisions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <InviteApplicantForm />
        </div>
      </div>

      {/* Triage Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-container-lowest p-card-padding rounded-xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border border-transparent">
          <div className="flex justify-between items-start mb-4">
            <span className="text-on-surface-variant font-label-md text-label-md">New Applications</span>
            <span className="material-symbols-outlined text-primary bg-primary-fixed p-2 rounded-lg">person_add</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display-lg text-display-lg">{newApps}</span>
            <span className="text-[12px] font-semibold text-on-surface-variant">
              of {meta.total} total
            </span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-card-padding rounded-xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border border-transparent">
          <div className="flex justify-between items-start mb-4">
            <span className="text-on-surface-variant font-label-md text-label-md">In Progress</span>
            <span className="material-symbols-outlined text-secondary bg-secondary-fixed p-2 rounded-lg">pending_actions</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display-lg text-display-lg">{inProgress}</span>
            <span className="text-[12px] font-semibold text-on-surface-variant">
              shortlisted & interviewing
            </span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-card-padding rounded-xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border border-transparent">
          <div className="flex justify-between items-start mb-4">
            <span className="text-on-surface-variant font-label-md text-label-md">Hired</span>
            <span className="material-symbols-outlined text-on-tertiary-fixed-variant bg-tertiary-fixed p-2 rounded-lg">check_circle</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display-lg text-display-lg">{hired}</span>
            <span className="text-[12px] font-semibold text-on-surface-variant">
              converted to staff
            </span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-surface-container-lowest p-4 md:p-6 rounded-xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border border-outline-variant">
        <ListFilters fields={[
          { type: 'text',   name: 'search',      placeholder: 'Search by name, email, or role…', label: 'Search' },
          { type: 'select', name: 'status',      label: 'Status', options: [
              { value: 'applied',              label: 'Applied' },
              { value: 'shortlisted',          label: 'Shortlisted' },
              { value: 'interview_scheduled',  label: 'Interview scheduled' },
              { value: 'hired',                label: 'Hired' },
              { value: 'rejected',             label: 'Rejected' },
              { value: 'withdrawn',            label: 'Withdrawn' },
          ]},
          { type: 'select', name: 'form_status', label: 'Form status', options: [
              { value: 'draft',     label: 'Draft' },
              { value: 'submitted', label: 'Submitted' },
          ]},
        ]} />
      </div>

      {applicants.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-8 text-center text-sm text-on-surface-variant">
          {hasFilters ? 'No results found. Try changing your filters.' : 'No applicants yet.'}
        </div>
      ) : (
        <div className="space-y-3">

          {/* ── Mobile card list (lg:hidden) ───────────────────────── */}
          <div className="lg:hidden space-y-2">
            {applicants.map((a) => {
              const name = [a.first_name, a.last_name].filter(Boolean).join(' ') || 'No name'
              const avatar = avatarColour(a.id)
              return (
                <Link
                  key={a.id}
                  href={`/admin/applicants/${a.id}`}
                  className="flex items-center gap-3.5 bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] px-4 py-3.5 hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] active:scale-[0.99] transition-all duration-150"
                >
                  <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-semibold ${avatar}`}>
                    {initials(a.first_name, a.last_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-primary truncate">{name}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5 truncate">{a.job_role ?? a.email}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_PILL[a.status] ?? 'bg-surface-container-highest text-on-surface-variant'}`}>
                      {a.status.replace(/_/g, ' ')}
                    </span>
                    {a.form_status && (
                      <span className={`text-[10px] font-medium ${a.form_status === 'submitted' ? 'text-green-600' : 'text-on-surface-variant'}`}>
                        form {a.form_status}
                      </span>
                    )}
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
            {applicants.map((a) => {
              const name   = [a.first_name, a.last_name].filter(Boolean).join(' ') || 'No name'
              const avatar = avatarColour(a.id)

              return (
                <div
                  key={a.id}
                  className="bg-surface-container-lowest rounded-xl p-card-padding shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border border-transparent hover:border-secondary/20 transition-all group relative overflow-hidden flex flex-col"
                >
                  {/* Header: Avatar + Name */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold ${avatar}`}>
                      {initials(a.first_name, a.last_name)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-headline-md text-headline-md text-primary truncate">{name}</h3>
                      <p className="text-on-surface-variant font-body-md text-body-md truncate">
                        {a.job_role?.replace(/_/g, ' ') ?? 'No role specified'}
                      </p>
                    </div>
                  </div>

                  {/* Info rows */}
                  <div className="space-y-3 flex-1">
                    <div className="flex justify-between items-center text-[12px]">
                      <span className="text-on-surface-variant font-label-md">Status</span>
                      <span className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px] ${STATUS_PILL[a.status] ?? 'bg-surface-container-highest text-on-surface-variant'}`}>
                        {a.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[12px]">
                      <span className="text-on-surface-variant font-label-md">Form</span>
                      {a.form_status ? (
                        <span className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px] ${FORM_PILL[a.form_status] ?? 'bg-surface-container-highest text-on-surface-variant'}`}>
                          {a.form_status}
                        </span>
                      ) : (
                        <span className="text-on-surface-variant text-[10px]">—</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center text-[12px]">
                      <span className="text-on-surface-variant font-label-md">Applied</span>
                      <span className="text-on-surface font-semibold">{formatDate(a.created_at)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[12px]">
                      <span className="text-on-surface-variant font-label-md">Email</span>
                      <span className="text-on-surface font-semibold truncate max-w-[140px]" title={a.email}>{a.email}</span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-6 pt-4 border-t border-surface-container-high flex justify-between items-center">
                    {['hired', 'rejected', 'withdrawn'].includes(a.status) ? (
                      <Link
                        href={`/admin/applicants/${a.id}`}
                        className="text-secondary font-bold text-[12px] hover:underline"
                      >
                        View Details
                      </Link>
                    ) : a.form_status === 'submitted' ? (
                      <Link
                        href={`/admin/applicants/${a.id}`}
                        className="text-secondary font-bold text-[12px] hover:underline"
                      >
                        Review Application
                      </Link>
                    ) : (
                      <ResendInviteButton applicantId={a.id} />
                    )}
                    <Link
                      href={`/admin/applicants/${a.id}`}
                      className="material-symbols-outlined text-outline hover:text-primary transition-colors"
                      aria-label={`More options for ${name}`}
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
