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

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_PILL: Record<string, string> = {
  pre_employment: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
  active:         'bg-green-100 text-green-700',
  suspended:      'bg-orange-100 text-orange-700',
  terminated:     'bg-red-100 text-red-700',
  inactive:       'bg-surface-container-highest text-on-surface-variant',
}

const COMPLIANCE_DOT: Record<string, string> = {
  green: 'bg-green-500',
  amber: 'bg-yellow-500',
  red:   'bg-red-500',
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function StaffGrid({ staff }: { staff: StaffProfileWithCompliance[] }) {
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
    { key: 'ready',         label: `Ready (${counts.ready})` },
    { key: 'not_ready',     label: `Not ready (${counts.not_ready})` },
    { key: 'hr_incomplete', label: `HR incomplete (${counts.hr_incomplete})` },
    { key: 'compliant',     label: `Compliant (${counts.compliant})` },
    { key: 'expiring_soon', label: `Expiring (${counts.expiring_soon})` },
    { key: 'expired',       label: `Expired (${counts.expired})` },
    { key: 'non_compliant', label: `Non-compliant (${counts.non_compliant})` },
    { key: 'suspended',     label: `Suspended (${counts.suspended})` },
  ]

  return (
    <div className="space-y-6">

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            id={`filter-${f.key}`}
            onClick={() => setFilter(f.key)}
            className={[
              'rounded-full px-3 py-1 text-xs font-medium border transition-colors cursor-pointer',
              filter === f.key
                ? 'bg-primary border-primary text-on-primary'
                : 'bg-white border-outline-variant text-on-surface hover:bg-surface-container-low',
            ].join(' ')}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Staff Power Cards Grid */}
      {filtered.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-10 text-center space-y-3">
          <span className="material-symbols-outlined text-[40px] text-on-surface-variant block">group</span>
          <p className="text-sm font-medium text-primary">No staff match this filter</p>
          <p className="text-xs text-on-surface-variant">Try a different status or clear the filter to see all staff.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map((s) => {
            const name      = [s.first_name, s.last_name].filter(Boolean).join(' ') || 'Unnamed'
            const compDot   = COMPLIANCE_DOT[s.compliance.tier] ?? 'bg-gray-300'
            const statusCls = STATUS_PILL[s.status] ?? STATUS_PILL.inactive
            const avatar    = avatarColour(s.id)

            return (
              <div
                key={s.id}
                className="bg-surface-container-lowest rounded-xl p-card-padding shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border border-transparent hover:border-secondary/20 transition-all group relative overflow-hidden flex flex-col"
              >
                {/* Header: Avatar + Name */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="relative">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold ${avatar}`}>
                      {initials(s.first_name, s.last_name)}
                    </div>
                    <div
                      className={`absolute bottom-0 right-0 w-4 h-4 border-2 border-white rounded-full ${compDot}`}
                      title={`Compliance: ${s.compliance.tier}`}
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-headline-md text-headline-md text-primary truncate">{name}</h3>
                    <p className="text-on-surface-variant font-body-md text-body-md truncate">
                      {s.job_role?.replace(/_/g, ' ') ?? 'No role assigned'}
                    </p>
                  </div>
                </div>

                {/* Info rows */}
                <div className="space-y-3 flex-1">
                  {/* Status */}
                  <div className="flex justify-between items-center text-[12px]">
                    <span className="text-on-surface-variant font-label-md">Status</span>
                    <span className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px] ${statusCls}`}>
                      {s.status.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {/* Source */}
                  <div className="flex justify-between items-center text-[12px]">
                    <span className="text-on-surface-variant font-label-md">Source</span>
                    <span className="text-on-surface font-semibold">
                      {s.applicant_id ? 'Recruited' : 'Existing'}
                    </span>
                  </div>

                  {/* Compliance */}
                  <div className="flex justify-between items-center text-[12px]">
                    <span className="text-on-surface-variant font-label-md">Compliance</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${compDot}`} />
                      <span className="text-on-surface font-semibold tabular-nums">{s.compliance.percentage}%</span>
                      {s.compliance.hasExpired && (
                        <span className="text-[10px] font-bold text-error uppercase">Expired</span>
                      )}
                      {!s.compliance.hasExpired && s.compliance.expiringSoon && (
                        <span className="text-[10px] font-bold text-tertiary uppercase">Expiring</span>
                      )}
                    </div>
                  </div>

                  {/* Readiness */}
                  <div className="flex justify-between items-center text-[12px]">
                    <span className="text-on-surface-variant font-label-md">Readiness</span>
                    <span className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px] ${
                      s.readiness.ready
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {s.readiness.ready ? 'Ready' : 'Not ready'}
                    </span>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-6 pt-4 border-t border-surface-container-high flex justify-between items-center">
                  <Link
                    href={`/admin/staff/${s.id}`}
                    className="text-secondary font-bold text-[12px] hover:underline"
                  >
                    View Profile
                  </Link>
                  <Link
                    href={`/admin/staff/${s.id}`}
                    className="material-symbols-outlined text-outline hover:text-primary transition-colors"
                    aria-label={`More options for ${name}`}
                  >
                    more_vert
                  </Link>
                </div>
              </div>
            )
          })}

          {/* Add New Member placeholder card */}
          <div className="bg-surface-container/50 border-2 border-dashed border-outline-variant rounded-xl flex flex-col items-center justify-center p-card-padding min-h-[250px] cursor-pointer hover:bg-surface-container transition-colors group">
            <span className="material-symbols-outlined text-4xl text-outline-variant group-hover:text-secondary mb-2">person_add</span>
            <span className="font-label-md text-label-md text-on-surface-variant group-hover:text-secondary">Add New Member</span>
          </div>
        </div>
      )}
    </div>
  )
}
