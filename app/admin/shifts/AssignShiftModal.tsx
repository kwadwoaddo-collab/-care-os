'use client'

import { useState, useEffect } from 'react'
import { useRouter }           from 'next/navigation'
import type { AssignmentOutcome } from '@/lib/scheduling/assignmentSafety'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AssignableShift {
  id:          string
  title:       string
  shift_date:  string
  start_time:  string
  end_time:    string
  client_name: string | null
  shift_type:  string | null
}

interface Recommendation {
  staff_profile_id:     string
  name:                 string
  score:                number
  eligible:             boolean
  reasons:              string[]
  warnings:             string[]
  safety_outcome:       AssignmentOutcome
  safety_summary:       string
  safety_block_count:   number
  safety_warning_count: number
  top_block:            string | null
  top_warning:          string | null
}

interface Props {
  shift:      AssignableShift
  onClose:    () => void
  onAssigned: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(t: string) { return t.slice(0, 5) }

function ScoreBadge({ score, eligible }: { score: number; eligible: boolean }) {
  const cls = !eligible
    ? 'bg-red-50 text-red-600 ring-red-500/20'
    : score >= 70
    ? 'bg-green-50 text-green-700 ring-green-600/20'
    : score >= 40
    ? 'bg-yellow-50 text-yellow-700 ring-yellow-600/20'
    : 'bg-gray-50 text-on-surface-variant ring-gray-400/20'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${cls}`}>
      {score}
    </span>
  )
}

function SafetyBadge({ outcome }: { outcome: AssignmentOutcome }) {
  if (outcome === 'safe_to_assign') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700 ring-1 ring-inset ring-green-600/20">
        ✓ Safe
      </span>
    )
  }
  if (outcome === 'assign_with_warning') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
        ⚠ Warnings
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 ring-1 ring-inset ring-red-500/20">
      ✕ Blocked
    </span>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AssignShiftModal({ shift, onClose, onAssigned }: Props) {
  const router = useRouter()

  const [recommendations,   setRecommendations]   = useState<Recommendation[] | null>(null)
  const [loading,           setLoading]           = useState(true)
  const [assigning,         setAssigning]         = useState<string | null>(null)
  const [error,             setError]             = useState<string | null>(null)
  const [complianceWarning, setComplianceWarning] = useState<string[] | null>(null)
  const [expanded,          setExpanded]          = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/admin/shifts/${shift.id}/recommendations`)
      .then((r) => r.json())
      .then((data) => { setRecommendations(data as Recommendation[]); setLoading(false) })
      .catch(() => { setError('Failed to load recommendations'); setLoading(false) })
  }, [shift.id])

  async function handleAssign(staffProfileId: string) {
    setAssigning(staffProfileId)
    setError(null)
    setComplianceWarning(null)
    const res = await fetch(`/api/admin/shifts/${shift.id}/assign`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ staff_profile_id: staffProfileId }),
    })
    const data = await res.json() as {
      error?:              string
      compliance_warning?: { message: string; expiringSoon: string[] }
    }
    if (res.ok) {
      router.refresh()
      if (data.compliance_warning) {
        setComplianceWarning(data.compliance_warning.expiringSoon ?? [])
        setAssigning(null)
      } else {
        onAssigned()
      }
    } else {
      setError(data.error ?? 'Failed to assign shift')
      setAssigning(null)
    }
  }

  const safe     = recommendations?.filter((r) => r.safety_outcome === 'safe_to_assign') ?? []
  const warned   = recommendations?.filter((r) => r.safety_outcome === 'assign_with_warning') ?? []
  const blocked  = recommendations?.filter((r) => r.safety_outcome === 'blocked_assignment') ?? []

  function toggleExpand(id: string) {
    setExpanded((prev) => (prev === id ? null : id))
  }

  function renderCandidate(rec: Recommendation, allowAssign: boolean) {
    const isExpanded = expanded === rec.staff_profile_id
    return (
      <div
        key={rec.staff_profile_id}
        className={[
          'rounded-lg border px-4 py-3',
          rec.safety_outcome === 'blocked_assignment' ? 'border-gray-100 bg-gray-50 opacity-70' : 'border-gray-200',
        ].join(' ')}
      >
        <div className="flex items-center justify-between gap-3">
          <button
            className="flex items-center gap-2 min-w-0 flex-1 text-left"
            onClick={() => toggleExpand(rec.staff_profile_id)}
          >
            <ScoreBadge score={rec.score} eligible={rec.eligible} />
            <SafetyBadge outcome={rec.safety_outcome} />
            <span className={`font-medium text-sm truncate ${rec.safety_outcome === 'blocked_assignment' ? 'text-gray-500' : 'text-primary'}`}>
              {rec.name}
            </span>
            {(rec.safety_warning_count > 0 || rec.safety_block_count > 0) && (
              <span className="ml-auto shrink-0 text-[10px] text-gray-400">
                {isExpanded ? '▲' : '▼'}
              </span>
            )}
          </button>

          {allowAssign && (
            <button
              data-testid="assign-worker-btn"
              onClick={() => handleAssign(rec.staff_profile_id)}
              disabled={assigning !== null}
              className={[
                'flex-shrink-0 text-xs px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                rec.safety_outcome === 'assign_with_warning'
                  ? 'bg-amber-600 text-white hover:bg-amber-700'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700',
              ].join(' ')}
            >
              {assigning === rec.staff_profile_id ? 'Assigning…' : 'Assign'}
            </button>
          )}
        </div>

        {/* Positive reasons */}
        {rec.reasons.length > 0 && !isExpanded && (
          <p className="mt-1.5 text-xs text-green-600">
            {rec.reasons.slice(0, 2).join(' · ')}
          </p>
        )}

        {/* Quick summary line */}
        {!isExpanded && rec.top_block && (
          <p className="mt-1 text-xs text-red-600">✕ {rec.top_block}</p>
        )}
        {!isExpanded && !rec.top_block && rec.top_warning && (
          <p className="mt-1 text-xs text-amber-700">⚠ {rec.top_warning}</p>
        )}

        {/* Expanded detail panel */}
        {isExpanded && (
          <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
            {rec.safety_block_count > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wider mb-1">
                  Blockers ({rec.safety_block_count})
                </p>
                <div className="space-y-1">
                  {/* We only have top_block from recommendations; full details come from safety-check API */}
                  {rec.top_block && (
                    <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">✕ {rec.top_block}</p>
                  )}
                  {rec.safety_block_count > 1 && (
                    <p className="text-xs text-gray-400">
                      + {rec.safety_block_count - 1} more blocker{rec.safety_block_count - 1 !== 1 ? 's' : ''} — view full check at Admin → Staff → {rec.name}
                    </p>
                  )}
                </div>
              </div>
            )}

            {rec.safety_warning_count > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider mb-1">
                  Warnings ({rec.safety_warning_count})
                </p>
                <div className="space-y-1">
                  {rec.top_warning && (
                    <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">⚠ {rec.top_warning}</p>
                  )}
                  {rec.safety_warning_count > 1 && (
                    <p className="text-xs text-gray-400">
                      + {rec.safety_warning_count - 1} more warning{rec.safety_warning_count - 1 !== 1 ? 's' : ''} — use the Safety Check API for full details
                    </p>
                  )}
                </div>
              </div>
            )}

            {rec.reasons.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-green-700 uppercase tracking-wider mb-1">Strengths</p>
                <ul className="space-y-0.5">
                  {rec.reasons.map((r, i) => (
                    <li key={i} className="text-xs text-green-600">✓ {r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      data-testid="assign-modal"
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-primary">Assign Shift</h2>
            <p className="text-sm text-on-surface-variant mt-0.5">
              {shift.title}
              {shift.client_name && <> · {shift.client_name}</>}
              {' · '}{shift.shift_date} · {formatTime(shift.start_time)}–{formatTime(shift.end_time)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none flex-shrink-0"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 max-h-[32rem] overflow-y-auto space-y-4">

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {complianceWarning && (
            <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800 space-y-1">
              <p className="font-medium">⚠ Compliance expires within 7 days</p>
              {complianceWarning.length > 0 && (
                <p className="text-xs">{complianceWarning.map((t) => t.replace(/_/g, ' ')).join(', ')}</p>
              )}
              <p className="text-xs">Shift assigned. Review staff compliance before the visit date.</p>
              <button onClick={onAssigned} className="mt-1 text-xs font-medium text-amber-900 underline">
                Dismiss
              </button>
            </div>
          )}

          {loading && (
            <p className="text-sm text-gray-400 text-center py-8">Loading recommendations…</p>
          )}

          {!loading && recommendations !== null && (
            <>
              {safe.length === 0 && warned.length === 0 && blocked.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">No staff found</p>
              )}

              {safe.length > 0 && (
                <section className="space-y-2">
                  <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">
                    Safe to assign · {safe.length}
                  </p>
                  {safe.map((rec) => renderCandidate(rec, true))}
                </section>
              )}

              {warned.length > 0 && (
                <section className="space-y-2">
                  <p className="text-xs font-medium text-amber-700 uppercase tracking-wider">
                    Assign with warnings · {warned.length}
                  </p>
                  {warned.map((rec) => renderCandidate(rec, true))}
                </section>
              )}

              {blocked.length > 0 && (
                <section className="space-y-2">
                  <p className="text-xs font-medium text-red-600 uppercase tracking-wider">
                    Blocked · {blocked.length}
                  </p>
                  {blocked.map((rec) => renderCandidate(rec, false))}
                </section>
              )}
            </>
          )}
        </div>

        {/* Legend */}
        <div className="px-6 py-2.5 border-t border-gray-100 bg-gray-50 flex gap-4 text-[10px] text-gray-400">
          <span>Score = assignment fit</span>
          <span>·</span>
          <span>✓ Safe · ⚠ Warnings · ✕ Blocked = safety checks</span>
          <span>·</span>
          <span>Click name to expand</span>
        </div>
      </div>
    </div>
  )
}
