import Link from 'next/link'
import type { OnboardingResponse, OnboardingRow } from '@/app/api/admin/onboarding/route'

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getOnboarding(): Promise<OnboardingResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res     = await fetch(`${baseUrl}/api/admin/onboarding`, { cache: 'no-store' })
  if (!res.ok) throw new Error('Failed to fetch onboarding data')
  return res.json() as Promise<OnboardingResponse>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function displayName(row: OnboardingRow): string {
  return [row.first_name, row.last_name].filter(Boolean).join(' ') || row.email || '—'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryCard({
  label, value, sub, accent = 'none',
}: {
  label: string
  value: number | string
  sub?: string
  accent?: 'red' | 'amber' | 'green' | 'blue' | 'none'
}) {
  const valCls =
    accent === 'red'   ? 'text-red-600'    :
    accent === 'amber' ? 'text-yellow-600' :
    accent === 'green' ? 'text-green-600'  :
    accent === 'blue'  ? 'text-blue-600'   :
    'text-gray-900'

  return (
    <div className="bg-white rounded-lg border border-gray-200 px-4 py-4">
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${valCls}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function ProgressBar({ value }: { value: number }) {
  const colour =
    value >= 100 ? 'bg-green-500' :
    value >= 60  ? 'bg-yellow-400' :
    'bg-red-500'

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${colour}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 tabular-nums w-8 text-right">{value}%</span>
    </div>
  )
}

function ReadinessBadge({ ready, label }: { ready: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
      ready
        ? 'bg-green-50 text-green-700 ring-green-600/20'
        : 'bg-red-50 text-red-700 ring-red-600/20'
    }`}>
      {ready ? '✓' : '✕'} {label}
    </span>
  )
}

function GapBadge({ missing, label }: { missing: boolean; label: string }) {
  if (!missing) return null
  return (
    <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset bg-amber-50 text-amber-700 ring-amber-600/20">
      {label}
    </span>
  )
}

const STATUS_CLS: Record<string, string> = {
  pre_employment: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  active:         'bg-green-50  text-green-700  ring-green-600/20',
  suspended:      'bg-orange-50 text-orange-700 ring-orange-600/20',
  terminated:     'bg-red-50    text-red-700    ring-red-600/20',
  inactive:       'bg-gray-50   text-gray-600   ring-gray-500/20',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function OnboardingPage() {
  let data: OnboardingResponse
  try {
    data = await getOnboarding()
  } catch {
    return (
      <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-700">
        Failed to load onboarding data. Please try again.
      </div>
    )
  }

  const { data: rows, summary } = data

  // Sort: urgent (active + incomplete) first, then by progress ascending
  const sorted = [...rows].sort((a, b) => {
    if (a.is_urgent !== b.is_urgent) return a.is_urgent ? -1 : 1
    return a.progress - b.progress
  })

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Onboarding</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Operational onboarding queue — {summary.total} staff profile{summary.total !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <SummaryCard label="Total"             value={summary.total}              />
        <SummaryCard label="Complete"          value={summary.complete}           accent="green" />
        <SummaryCard label="Incomplete"        value={summary.incomplete}         accent={summary.incomplete > 0 ? 'amber' : 'none'} />
        <SummaryCard label="Payroll Ready"     value={summary.payroll_ready}      accent="blue" />
        <SummaryCard label="Missing HMRC"      value={summary.missing_hmrc}       accent={summary.missing_hmrc > 0 ? 'red' : 'none'} />
        <SummaryCard label="Missing Bank"      value={summary.missing_banking}    accent={summary.missing_banking > 0 ? 'red' : 'none'} />
        <SummaryCard label="Missing Docs"      value={summary.missing_documents}  accent={summary.missing_documents > 0 ? 'red' : 'none'} />
        <SummaryCard label="Missing Compliance" value={summary.missing_compliance} accent={summary.missing_compliance > 0 ? 'amber' : 'none'} />
      </div>

      {/* Urgent banner */}
      {sorted.some((r) => r.is_urgent) && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 flex items-start gap-3">
          <span className="text-red-500 text-base mt-0.5">⚠</span>
          <div>
            <p className="text-sm font-semibold text-red-800">
              {sorted.filter((r) => r.is_urgent).length} active staff member{sorted.filter((r) => r.is_urgent).length !== 1 ? 's' : ''} have incomplete onboarding
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              These workers are marked active but their onboarding is not finished. Review highlighted rows below.
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      {rows.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-sm font-medium text-gray-500">No staff profiles yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Convert a hired applicant to a staff profile to begin onboarding tracking.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-gray-700">All Staff — Onboarding Status</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    'Name', 'Role', 'Status', 'Progress', 'Sections',
                    'Payroll', 'Gaps', 'Start date', 'Actions',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map((row) => (
                  <tr
                    key={row.id}
                    className={`transition-colors hover:bg-gray-50 ${row.is_urgent ? 'bg-red-50/40' : ''}`}
                  >
                    {/* Name */}
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {row.is_urgent && (
                          <span className="text-red-500 text-xs" title="Active but onboarding incomplete">⚠</span>
                        )}
                        <Link
                          href={`/admin/staff/${row.id}`}
                          className="text-indigo-700 hover:underline"
                        >
                          {displayName(row)}
                        </Link>
                      </div>
                      {row.email && (
                        <p className="text-xs text-gray-400 mt-0.5">{row.email}</p>
                      )}
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {row.job_role ?? '—'}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_CLS[row.status] ?? 'bg-gray-50 text-gray-600 ring-gray-500/20'}`}>
                        {row.status.replace(/_/g, ' ')}
                      </span>
                    </td>

                    {/* Progress */}
                    <td className="px-4 py-3 min-w-[140px]">
                      <ProgressBar value={row.progress} />
                    </td>

                    {/* Sections */}
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap tabular-nums">
                      {row.sections_complete} / {row.sections_total}
                    </td>

                    {/* Payroll */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <ReadinessBadge ready={row.payroll_ready} label={row.payroll_ready ? 'Payroll Ready' : 'Not Ready'} />
                    </td>

                    {/* Gaps */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <GapBadge missing={row.missing_hmrc}      label="HMRC" />
                        <GapBadge missing={row.missing_banking}   label="Bank" />
                        <GapBadge missing={row.missing_documents} label="Docs" />
                        <GapBadge missing={row.missing_compliance} label="RTW/DBS" />
                        {!row.missing_hmrc && !row.missing_banking && !row.missing_documents && !row.missing_compliance && (
                          <span className="text-xs text-green-600">✓ All clear</span>
                        )}
                      </div>
                    </td>

                    {/* Start date */}
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {formatDate(row.start_date)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link
                        href={`/admin/staff/${row.id}`}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        {row.onboarding_completed ? 'View profile →' : 'Complete onboarding →'}
                      </Link>
                    </td>
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
