'use client'

import { useState } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StaffProfileWithCompliance {
  id:           string
  first_name:   string | null
  last_name:    string | null
  email:        string | null
  job_role:     string | null
  status:       string
  start_date:   string | null
  created_at:   string
  applicant_id: string | null
  onboarding_completed?: boolean | null
  compliance: {
    percentage:   number
    tier:         'green' | 'amber' | 'red'
    compliant:    boolean
    expiringSoon: boolean
    hasExpired:   boolean
  }
  readiness: {
    ready: boolean
    score: number
    blockers: string[]
    warnings: string[]
  }
}

type FilterType =
  | 'all'
  | 'compliant'
  | 'non_compliant'
  | 'expiring_soon'
  | 'expired'
  | 'suspended'
  | 'active'
  | 'ready'
  | 'not_ready'
  | 'hr_incomplete'

const gbDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric',
})

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return gbDateFormatter.format(new Date(iso))
}

const STAFF_STATUS_CLS: Record<string, string> = {
  pre_employment: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  active:         'bg-green-50  text-green-700  ring-green-600/20',
  suspended:      'bg-orange-50 text-orange-700 ring-orange-600/20',
  terminated:     'bg-red-50    text-red-700    ring-red-600/20',
  inactive:       'bg-gray-50   text-gray-600   ring-gray-500/20',
}

const COMPLIANCE_TIER_CLS: Record<string, string> = {
  green: 'bg-green-50  text-green-700  ring-green-600/20',
  amber: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  red:   'bg-red-50    text-red-700    ring-red-600/20',
}

const RISK_CLS: Record<string, string> = {
  high:   'bg-red-50    text-red-700    ring-red-600/20',
  medium: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  low:    'bg-green-50  text-green-700  ring-green-600/20',
}

function riskLevel(
  c: StaffProfileWithCompliance['compliance']
): 'high' | 'medium' | 'low' {
  if (c.hasExpired || !c.compliant) return 'high'
  if (c.expiringSoon)               return 'medium'
  return 'low'
}

function StatusBadge({ status, map }: { status: string; map: Record<string, string> }) {
  const cls = map[status] ?? 'bg-gray-50 text-gray-600 ring-gray-500/20'
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StaffTable({ staff }: { staff: StaffProfileWithCompliance[] }) {
  const [filter, setFilter] = useState<FilterType>('all')

  const filtered = staff.filter((s) => {
    if (filter === 'compliant')     return s.compliance.compliant
    if (filter === 'non_compliant') return !s.compliance.compliant
    if (filter === 'expiring_soon') return s.compliance.expiringSoon
    if (filter === 'expired')       return s.compliance.hasExpired
    if (filter === 'suspended')     return s.status === 'suspended'
    if (filter === 'active')        return s.status === 'active'
    if (filter === 'ready')         return s.readiness.ready
    if (filter === 'not_ready')     return !s.readiness.ready
    if (filter === 'hr_incomplete') return !s.onboarding_completed
    return true
  })

  const counts = {
    all:           staff.length,
    compliant:     staff.filter((s) => s.compliance.compliant).length,
    non_compliant: staff.filter((s) => !s.compliance.compliant).length,
    expiring_soon: staff.filter((s) => s.compliance.expiringSoon).length,
    expired:       staff.filter((s) => s.compliance.hasExpired).length,
    suspended:     staff.filter((s) => s.status === 'suspended').length,
    active:        staff.filter((s) => s.status === 'active').length,
    ready:         staff.filter((s) => s.readiness.ready).length,
    not_ready:     staff.filter((s) => !s.readiness.ready).length,
    hr_incomplete: staff.filter((s) => !s.onboarding_completed).length,
  }

  const FILTERS: { key: FilterType; label: string }[] = [
    { key: 'all',           label: `All (${counts.all})` },
    { key: 'active',        label: `Active (${counts.active})` },
    { key: 'ready',         label: `Ready to work (${counts.ready})` },
    { key: 'not_ready',     label: `Not ready (${counts.not_ready})` },
    { key: 'hr_incomplete', label: `HR incomplete (${counts.hr_incomplete})` },
    { key: 'compliant',     label: `Compliant (${counts.compliant})` },
    { key: 'expiring_soon', label: `Expiring soon (${counts.expiring_soon})` },
    { key: 'expired',       label: `Expired (${counts.expired})` },
    { key: 'non_compliant', label: `Non-compliant (${counts.non_compliant})` },
    { key: 'suspended',     label: `Suspended (${counts.suspended})` },
  ]

  return (
    <div className="space-y-3">

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            id={`filter-${f.key}`}
            onClick={() => setFilter(f.key)}
            className={[
              'rounded-md px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors cursor-pointer',
              filter === f.key
                ? 'bg-gray-900 text-white ring-gray-900'
                : 'bg-surface-container-lowest text-gray-600 ring-gray-300 hover:bg-gray-50',
            ].join(' ')}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-8 text-center text-sm text-gray-400">
          No staff match this filter.
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Source</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Start date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Risk</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">HR</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Readiness</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider">Compliance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-primary whitespace-nowrap">
                    <Link href={`/admin/staff/${s.id}`} className="hover:underline text-indigo-700">
                      {[s.first_name, s.last_name].filter(Boolean).join(' ') || '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{s.email ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{s.job_role ?? '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge status={s.status} map={STAFF_STATUS_CLS} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                      s.applicant_id
                        ? 'bg-indigo-50 text-indigo-600 ring-indigo-600/20'
                        : 'bg-gray-50 text-on-surface-variant ring-gray-400/20'
                    }`}>
                      {s.applicant_id ? 'recruited' : 'existing'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(s.start_date)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge
                      status={riskLevel(s.compliance)}
                      map={RISK_CLS}
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                      s.onboarding_completed
                        ? 'bg-green-50 text-green-700 ring-green-600/20'
                        : 'bg-amber-50 text-amber-700 ring-amber-600/20'
                    }`}>
                      {s.onboarding_completed ? 'ready' : 'incomplete'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div
                      className="flex items-center gap-1.5"
                      title={
                        !s.readiness.ready || s.readiness.score < 100
                          ? [
                              ...(s.readiness.blockers.length ? [`Blockers:\n• ${s.readiness.blockers.join('\n• ')}`] : []),
                              ...(s.readiness.warnings.length ? [`Warnings:\n• ${s.readiness.warnings.join('\n• ')}`] : []),
                            ].join('\n\n')
                          : 'Operationally ready'
                      }
                    >
                      <span
                        className={`inline-flex items-center rounded-full w-2 h-2 ${
                          s.readiness.ready ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      />
                      <span className="text-xs text-gray-700 tabular-nums cursor-help border-b border-dotted border-gray-400">
                        {s.readiness.score}%
                      </span>
                      <span
                        className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                          s.readiness.ready
                            ? 'bg-green-50 text-green-700 ring-green-600/20'
                            : 'bg-red-50 text-red-700 ring-red-600/20'
                        }`}
                      >
                        {s.readiness.ready ? 'ready' : 'not ready'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={`${s.compliance.percentage}%`} map={{}} />
                      <StatusBadge
                        status={s.compliance.tier}
                        map={COMPLIANCE_TIER_CLS}
                      />
                      {s.compliance.hasExpired && (
                        <span className="text-xs text-red-600 font-medium">⚠ expired</span>
                      )}
                      {!s.compliance.hasExpired && s.compliance.expiringSoon && (
                        <span className="text-xs text-yellow-600">⚠ expiring</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
