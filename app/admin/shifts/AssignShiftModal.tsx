'use client'

import { useState, useEffect } from 'react'
import { useRouter }           from 'next/navigation'

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
  staff_profile_id: string
  name:             string
  score:            number
  eligible:         boolean
  reasons:          string[]
  warnings:         string[]
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
    : 'bg-gray-50 text-gray-500 ring-gray-400/20'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${cls}`}>
      {score}%
    </span>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AssignShiftModal({ shift, onClose, onAssigned }: Props) {
  const router = useRouter()

  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null)
  const [loading,         setLoading]         = useState(true)
  const [assigning,       setAssigning]       = useState<string | null>(null)
  const [error,           setError]           = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/admin/shifts/${shift.id}/recommendations`)
      .then((r) => r.json())
      .then((data) => { setRecommendations(data as Recommendation[]); setLoading(false) })
      .catch(() => { setError('Failed to load recommendations'); setLoading(false) })
  }, [shift.id])

  async function handleAssign(staffProfileId: string) {
    setAssigning(staffProfileId)
    setError(null)
    const res = await fetch(`/api/admin/shifts/${shift.id}/assign`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ staff_profile_id: staffProfileId }),
    })
    if (res.ok) {
      router.refresh()
      onAssigned()
    } else {
      const data = await res.json() as { error?: string }
      setError(data.error ?? 'Failed to assign shift')
      setAssigning(null)
    }
  }

  const eligible   = recommendations?.filter((r) => r.eligible) ?? []
  const ineligible = recommendations?.filter((r) => !r.eligible) ?? []

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Assign Shift</h2>
            <p className="text-sm text-gray-500 mt-0.5">
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
        <div className="px-6 py-4 max-h-[28rem] overflow-y-auto space-y-4">

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading && (
            <p className="text-sm text-gray-400 text-center py-8">
              Loading recommendations…
            </p>
          )}

          {!loading && recommendations !== null && (
            <>
              {eligible.length === 0 && ineligible.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">No staff found</p>
              )}

              {eligible.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Eligible · {eligible.length}
                  </p>
                  {eligible.map((rec) => (
                    <div
                      key={rec.staff_profile_id}
                      className="rounded-lg border border-gray-200 px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <ScoreBadge score={rec.score} eligible={rec.eligible} />
                          <span className="font-medium text-sm text-gray-900 truncate">
                            {rec.name}
                          </span>
                        </div>
                        <button
                          onClick={() => handleAssign(rec.staff_profile_id)}
                          disabled={assigning !== null}
                          className="flex-shrink-0 text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {assigning === rec.staff_profile_id ? 'Assigning…' : 'Assign'}
                        </button>
                      </div>

                      {rec.reasons.length > 0 && (
                        <p className="mt-1.5 text-xs text-green-600">
                          {rec.reasons.slice(0, 2).join(' · ')}
                        </p>
                      )}
                      {rec.warnings.length > 0 && (
                        <p className="mt-0.5 text-xs text-amber-600">
                          ⚠ {rec.warnings.slice(0, 2).join(' · ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {ineligible.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Not eligible · {ineligible.length}
                  </p>
                  {ineligible.map((rec) => (
                    <div
                      key={rec.staff_profile_id}
                      className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 opacity-70"
                    >
                      <div className="flex items-center gap-2">
                        <ScoreBadge score={rec.score} eligible={rec.eligible} />
                        <span className="font-medium text-sm text-gray-600 truncate">
                          {rec.name}
                        </span>
                      </div>
                      {rec.warnings.length > 0 && (
                        <p className="mt-1 text-xs text-red-500">
                          {rec.warnings.slice(0, 2).join(' · ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
