import Link from 'next/link'
import InviteApplicantForm from './InviteApplicantForm'
import ResendInviteButton from './ResendInviteButton'
import ListFilters from '@/components/admin/ListFilters'
import Pagination  from '@/components/admin/Pagination'
import type { PaginationMeta } from '@/lib/pagination'
import { sp } from '@/lib/pagination'

import { adminFetch } from '@/lib/admin/serverFetch'
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    applied:              'bg-blue-50 text-blue-700 ring-blue-600/20',
    shortlisted:          'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
    rejected:             'bg-red-50 text-red-700 ring-red-600/20',
    interview_scheduled:  'bg-purple-50 text-purple-700 ring-purple-600/20',
    hired:                'bg-green-50 text-green-700 ring-green-600/20',
    withdrawn:            'bg-gray-50 text-gray-600 ring-gray-500/20',
  }
  const cls = map[status] ?? 'bg-gray-50 text-gray-600 ring-gray-500/20'
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function FormStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-gray-400 text-xs">—</span>
  const map: Record<string, string> = {
    draft:     'bg-gray-50 text-gray-500 ring-gray-500/20',
    submitted: 'bg-green-50 text-green-700 ring-green-600/20',
  }
  const cls = map[status] ?? 'bg-gray-50 text-gray-500 ring-gray-500/20'
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {status}
    </span>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ApplicantsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const raw = await searchParams

  const params = new URLSearchParams()
  if (sp(raw, 'search'))      params.set('search',      sp(raw, 'search'))
  if (sp(raw, 'status'))      params.set('status',      sp(raw, 'status'))
  if (sp(raw, 'form_status')) params.set('form_status', sp(raw, 'form_status'))
  if (sp(raw, 'page'))        params.set('page',        sp(raw, 'page'))
  if (sp(raw, 'pageSize'))    params.set('pageSize',    sp(raw, 'pageSize'))

  const { data: applicants, meta } = await getApplicants(params)

  const hasFilters = !!(sp(raw, 'search') || sp(raw, 'status') || sp(raw, 'form_status'))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Applicants</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {meta.total} applicant{meta.total !== 1 ? 's' : ''}
          </p>
        </div>
        <InviteApplicantForm />
      </div>

      {/* Filters */}
      <ListFilters fields={[
        { type: 'text',   name: 'search',      placeholder: 'Search name, email, role…', label: 'Search' },
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

      {/* Table */}
      {applicants.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-sm text-gray-400">
          {hasFilters
            ? 'No results found. Try changing your filters.'
            : 'No applicants yet.'}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Form</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applied</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {applicants.map((a) => (
                  <tr
                    key={a.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                      <Link href={`/admin/applicants/${a.id}`} className="block w-full">
                        {a.first_name ?? ''} {a.last_name ?? ''}
                        {!a.first_name && !a.last_name && <span className="text-gray-400">—</span>}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      <Link href={`/admin/applicants/${a.id}`} className="block w-full">
                        {a.email}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      <Link href={`/admin/applicants/${a.id}`} className="block w-full">
                        {a.job_role ?? <span className="text-gray-400">—</span>}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link href={`/admin/applicants/${a.id}`} className="block w-full">
                        <StatusBadge status={a.status} />
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link href={`/admin/applicants/${a.id}`} className="block w-full">
                        <FormStatusBadge status={a.form_status} />
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                      <Link href={`/admin/applicants/${a.id}`} className="block w-full">
                        {formatDate(a.created_at)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {['hired', 'rejected', 'withdrawn'].includes(a.status) ? (
                        <span className="text-xs text-gray-400">Closed</span>
                      ) : a.form_status === 'submitted' ? (
                        <span className="text-xs text-gray-400">Submitted</span>
                      ) : (
                        <ResendInviteButton applicantId={a.id} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={meta} searchParams={raw} />
        </div>
      )}
    </div>
  )
}
