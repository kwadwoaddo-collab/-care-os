'use client'

import Link from 'next/link'
import type { StaffProfileWithCompliance } from './StaffGrid'

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CLS: Record<string, { bg: string; text: string }> = {
  pre_employment: { bg: 'bg-yellow-50',  text: 'text-yellow-700' },
  active:         { bg: 'bg-green-50',   text: 'text-green-700'  },
  suspended:      { bg: 'bg-orange-50',  text: 'text-orange-700' },
  terminated:     { bg: 'bg-red-50',     text: 'text-red-700'    },
  inactive:       { bg: 'bg-gray-100',   text: 'text-on-surface-variant'   },
}

const COMPLIANCE_DOT: Record<string, string> = {
  green: 'bg-green-500',
  amber: 'bg-yellow-400',
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
    'bg-indigo-100 text-indigo-700',
    'bg-violet-100 text-violet-700',
    'bg-sky-100    text-sky-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100  text-amber-700',
    'bg-rose-100   text-rose-700',
  ]
  const idx = id.charCodeAt(0) % colours.length
  return colours[idx]
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StaffMobileList({ staff }: { staff: StaffProfileWithCompliance[] }) {
  if (staff.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-8 text-center text-sm text-gray-400">
        No staff profiles match your filters.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {staff.map((s) => {
        const status  = STATUS_CLS[s.status] ?? STATUS_CLS.inactive
        const compDot = COMPLIANCE_DOT[s.compliance.tier] ?? 'bg-gray-300'
        const name    = [s.first_name, s.last_name].filter(Boolean).join(' ') || 'Unnamed'
        const avatar  = avatarColour(s.id)
        const risk    = s.compliance.hasExpired ? 'Expired' : s.compliance.expiringSoon ? 'Expiring' : null

        return (
          <Link
            key={s.id}
            href={`/admin/staff/${s.id}`}
            className="flex items-center gap-3.5 bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] px-4 py-3.5 shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] active:scale-[0.99] transition-all duration-150"
          >
            {/* Avatar */}
            <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-semibold ${avatar}`}>
              {initials(s.first_name, s.last_name)}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-primary truncate">{name}</p>
                {risk && (
                  <span className={`flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                    risk === 'Expired' ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-600'
                  }`}>
                    {risk}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                {s.job_role ?? 'No role assigned'}
              </p>
            </div>

            {/* Right side: status + compliance dot */}
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>
                {s.status.replace(/_/g, ' ')}
              </span>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${compDot}`} />
                <span className="text-[10px] text-gray-400 font-medium tabular-nums">
                  {s.compliance.percentage}%
                </span>
              </div>
            </div>

            {/* Chevron */}
            <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        )
      })}
    </div>
  )
}
