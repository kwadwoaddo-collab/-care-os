'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import type { WorkerReadiness, WorkerReadinessStage } from '@/lib/onboarding/readiness'
import {
  READINESS_STAGE_LABEL,
  READINESS_STAGE_CLS,
  READINESS_STAGE_ICON,
} from '@/lib/onboarding/readiness'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  staffProfileId: string
  initialReadiness?: WorkerReadiness | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ProgressRing({ value, size = 56, strokeWidth = 4 }: {
  value: number; size?: number; strokeWidth?: number
}) {
  const radius      = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const offset      = circumference - (value / 100) * circumference
  const colour      = value >= 80 ? '#16a34a' : value >= 60 ? '#d97706' : value >= 40 ? '#f97316' : '#dc2626'

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="#f3f4f6" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={colour} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round" className="transition-all duration-500" />
    </svg>
  )
}

function ProgressBar({ value, label, colour = 'bg-indigo-500' }: {
  value: number; label: string; colour?: string
}) {
  return (
    <div>
      <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
        <span>{label}</span>
        <span className="font-semibold tabular-nums">{value}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${colour}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function StageBadge({ stage }: { stage: WorkerReadinessStage }) {
  const cls  = READINESS_STAGE_CLS[stage]
  const icon = READINESS_STAGE_ICON[stage]
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide rounded-lg px-2.5 py-1 ring-1 ring-inset ${cls}`}>
      <span className="material-symbols-outlined text-[13px]">{icon}</span>
      {READINESS_STAGE_LABEL[stage]}
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ReadinessPanel({ staffProfileId, initialReadiness }: Props) {
  const [readiness, setReadiness] = useState<WorkerReadiness | null>(initialReadiness ?? null)
  const [loading, setLoading]     = useState(!initialReadiness)
  const [error, setError]         = useState<string | null>(null)
  const [expanded, setExpanded]   = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res  = await fetch(`/api/admin/onboarding/readiness?staffProfileId=${staffProfileId}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed')
      setReadiness(json.readiness)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load readiness')
    } finally { setLoading(false) }
  }, [staffProfileId])

  // Auto-fetch if no initial data
  if (!initialReadiness && !readiness && !loading && !error) {
    void refresh()
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-surface-container-lowest p-4 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-32 mb-3" />
        <div className="h-10 bg-gray-100 rounded w-full mb-2" />
        <div className="h-3 bg-gray-100 rounded w-3/4" />
      </div>
    )
  }

  if (error || !readiness) {
    return (
      <div className="rounded-xl border border-gray-200 bg-surface-container-lowest p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">Readiness panel</p>
          <button onClick={refresh} className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px]">refresh</span>
            Refresh
          </button>
        </div>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
    )
  }

  const score = readiness.deployabilityScore
  const scoreColour =
    score >= 80 ? 'text-green-700' :
    score >= 60 ? 'text-amber-700' :
    score >= 40 ? 'text-orange-700' :
    'text-red-700'

  return (
    <div className="rounded-xl border border-gray-200 bg-surface-container-lowest shadow-sm overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-gray-500 text-[18px]">verified_user</span>
          <h3 className="text-sm font-semibold text-gray-700">Deployment Readiness</h3>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Refresh readiness">
            <span className="material-symbols-outlined text-[16px]">refresh</span>
          </button>
          <button onClick={() => setExpanded((p) => !p)} className="text-gray-400 hover:text-gray-600">
            <span className="material-symbols-outlined text-[16px]">{expanded ? 'expand_less' : 'expand_more'}</span>
          </button>
        </div>
      </div>

      {/* Score row */}
      <div className="px-4 py-3 flex items-center gap-4">
        <div className="relative shrink-0">
          <ProgressRing value={score} size={60} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-sm font-bold tabular-nums ${scoreColour}`}>{score}</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <StageBadge stage={readiness.stage} />
          <div className="mt-2 space-y-1.5">
            <ProgressBar value={readiness.onboardingProgress}   label="Onboarding"
              colour={readiness.onboardingProgress === 100 ? 'bg-green-500' : 'bg-indigo-500'} />
            <ProgressBar value={readiness.verificationProgress} label="Verification"
              colour={readiness.verificationProgress === 100 ? 'bg-green-500' : 'bg-blue-500'} />
            <ProgressBar value={readiness.compliancePercentage} label="Compliance"
              colour={readiness.compliancePercentage === 100 ? 'bg-green-500' : readiness.compliancePercentage < 50 ? 'bg-red-500' : 'bg-orange-500'} />
          </div>
        </div>
      </div>

      {/* Blockers */}
      {readiness.blockers.length > 0 && (
        <div className="px-4 pb-3">
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 space-y-1">
            {readiness.blockers.slice(0, expanded ? 10 : 2).map((b, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-red-700">
                <span className="material-symbols-outlined text-[12px] mt-0.5 shrink-0">error</span>
                {b}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {readiness.warnings.length > 0 && (
        <div className="px-4 pb-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 space-y-1">
            {readiness.warnings.slice(0, expanded ? 10 : 2).map((w, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700">
                <span className="material-symbols-outlined text-[12px] mt-0.5 shrink-0">warning</span>
                {w}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-3">
          {/* Verification stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Pending verification', value: readiness.pendingVerificationCount, cls: readiness.pendingVerificationCount > 0 ? 'text-amber-700' : 'text-gray-400' },
              { label: 'Rejected docs',         value: readiness.rejectedCount,            cls: readiness.rejectedCount > 0            ? 'text-red-700'   : 'text-gray-400' },
              { label: 'Expiring (30d)',         value: readiness.criticalExpiryCount,      cls: readiness.criticalExpiryCount > 0      ? 'text-orange-700': 'text-gray-400' },
            ].map(({ label, value, cls }) => (
              <div key={label} className="text-center rounded-lg border border-gray-100 bg-gray-50 px-2 py-2">
                <p className={`text-lg font-bold tabular-nums ${cls}`}>{value}</p>
                <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Expiry alerts */}
          {readiness.expiryAlerts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1.5">Expiry alerts</p>
              <div className="space-y-1.5">
                {readiness.expiryAlerts.slice(0, 5).map((a, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-xs rounded-lg border border-gray-200 bg-surface-container-lowest px-2.5 py-1.5">
                    <span className="text-gray-700 font-medium truncate">{a.fileName}</span>
                    <span className={`shrink-0 font-semibold ${a.daysRemaining <= 14 ? 'text-red-700' : a.daysRemaining <= 30 ? 'text-orange-700' : 'text-amber-700'}`}>
                      {a.daysRemaining}d
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Document gaps */}
          {readiness.documentGaps.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1.5">Document gaps</p>
              <div className="space-y-1">
                {readiness.documentGaps.map((g, i) => (
                  <div key={i} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded border ${g.urgent ? 'border-red-200 bg-red-50 text-red-700' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
                    <span className="material-symbols-outlined text-[11px]">
                      {g.reason === 'missing' ? 'upload_file' : g.reason === 'expired' ? 'event_busy' : g.reason === 'rejected' ? 'cancel' : 'hourglass_empty'}
                    </span>
                    <span className="font-medium capitalize">{g.label}</span>
                    <span className="text-[10px] opacity-70">({g.reason.replace(/_/g, ' ')})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* View pipeline link */}
          <Link href="/admin/onboarding/pipeline"
            className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 transition-colors">
            <span className="material-symbols-outlined text-[13px]">open_in_new</span>
            View in onboarding pipeline
          </Link>
        </div>
      )}
    </div>
  )
}
