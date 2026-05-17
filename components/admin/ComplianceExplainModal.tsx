'use client'

import { useEffect, useState } from 'react'
import type { ComplianceScoreBreakdown } from '@/lib/compliance/explainability'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExplainResponse {
  staffId:           string
  jobRole:           string | null
  status:            string
  nonCompliantSince: string | null
  activeOverride: {
    id:          string
    reason:      string
    expiresAt:   string
  } | null
  breakdown: ComplianceScoreBreakdown
}

interface Props {
  staffId:   string
  staffName: string
  open:      boolean
  onClose:   () => void
  /** Called after a new override is granted */
  onOverrideGranted?: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function daysFromNow(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
}

// ── Impact badge ──────────────────────────────────────────────────────────────

const IMPACT_CLS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 ring-red-600/20',
  high:     'bg-orange-100 text-orange-700 ring-orange-600/20',
  medium:   'bg-yellow-100 text-yellow-700 ring-yellow-600/20',
  low:      'bg-green-100 text-green-700 ring-green-600/20',
}

const STATUS_ICON: Record<string, string> = {
  missing:       'cancel',
  expired:       'warning',
  expiring_soon: 'schedule',
  ok:            'check_circle',
}

const STATUS_CLS: Record<string, string> = {
  missing:       'text-red-600',
  expired:       'text-red-600',
  expiring_soon: 'text-yellow-600',
  ok:            'text-green-600',
}

// ── Override form ─────────────────────────────────────────────────────────────

function OverrideForm({ staffId, onSuccess, onCancel }: {
  staffId:   string
  onSuccess: () => void
  onCancel:  () => void
}) {
  const [reason,    setReason]   = useState('')
  const [expiresAt, setExpires]  = useState('')
  const [busy,      setBusy]     = useState(false)
  const [error,     setError]    = useState<string | null>(null)

  // Default expiry: 7 days from now
  const defaultExpiry = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  const maxExpiry     = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason.trim() || reason.trim().length < 10) {
      setError('Reason must be at least 10 characters')
      return
    }
    if (!expiresAt) {
      setError('Expiry date is required')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/staff/${staffId}/compliance/override`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ reason: reason.trim(), expiresAt }),
      })
      if (!res.ok) {
        const j = await res.json() as { error?: string }
        throw new Error(j.error ?? 'Failed to create override')
      }
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 bg-orange-50 border border-orange-200 rounded-xl p-4">
      <h4 className="text-sm font-semibold text-orange-800 flex items-center gap-1.5">
        <span className="material-symbols-outlined text-[16px]">shield_with_heart</span>
        Grant Temporary Compliance Override
      </h4>
      <p className="text-xs text-orange-700">
        This override allows the worker to be assigned to shifts despite compliance issues.
        It must be justified, time-limited, and logged for audit.
      </p>

      <div>
        <label className="block text-xs font-medium text-orange-800 mb-1">Override reason <span className="text-red-500">*</span></label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="e.g. DBS renewal in progress — certificate applied for 2026-01-10, expected 2026-02-15. Worker covered by existing enhanced check during transition."
          className="w-full rounded-lg border border-orange-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white resize-none"
          required
          minLength={10}
        />
        <p className="text-[11px] text-orange-600 mt-0.5">Min 10 characters. This reason is logged to the audit trail.</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-orange-800 mb-1">Override expires <span className="text-red-500">*</span></label>
        <input
          type="date"
          value={expiresAt || defaultExpiry}
          min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
          max={maxExpiry}
          onChange={(e) => setExpires(e.target.value)}
          className="rounded-lg border border-orange-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
          required
        />
        <p className="text-[11px] text-orange-600 mt-0.5">Maximum 30 days. Auto-expires — no manual removal needed.</p>
      </div>

      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="flex-1 bg-orange-600 text-white text-sm font-semibold py-2 rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
        >
          {busy ? 'Granting…' : 'Grant Override'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-orange-700 bg-white border border-orange-300 rounded-lg hover:bg-orange-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function ComplianceExplainModal({ staffId, staffName, open, onClose, onOverrideGranted }: Props) {
  const [data,           setData]           = useState<ExplainResponse | null>(null)
  const [loading,        setLoading]        = useState(false)
  const [showOverride,   setShowOverride]   = useState(false)
  const [revoking,       setRevoking]       = useState(false)
  const [showOkItems,    setShowOkItems]    = useState(false)
  const [activeTab,      setActiveTab]      = useState<'breakdown' | 'escalation'>('breakdown')
  const [escalation,     setEscalation]     = useState<{
    history: Array<{ id: string; timestamp: string; level: string; levelLabel: string; daysNonCompliant: number }>
    remindersLog: Array<{ id: string; timestamp: string; subject: string | null }>
  } | null>(null)

  useEffect(() => {
    if (!open || !staffId) return
    setLoading(true)
    setData(null)
    setShowOverride(false)
    setActiveTab('breakdown')

    fetch(`/api/admin/staff/${staffId}/compliance/explain`)
      .then((r) => r.json() as Promise<ExplainResponse>)
      .then(setData)
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [open, staffId])

  // Load escalation data when tab switches
  useEffect(() => {
    if (activeTab !== 'escalation' || escalation || !staffId || !open) return
    fetch(`/api/admin/staff/${staffId}/compliance/escalation`)
      .then((r) => r.json() as Promise<typeof escalation>)
      .then(setEscalation)
      .catch(() => null)
  }, [activeTab, staffId, open, escalation])

  async function revokeOverride() {
    if (!staffId || revoking) return
    setRevoking(true)
    try {
      await fetch(`/api/admin/staff/${staffId}/compliance/override`, {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ reason: 'Revoked from compliance dashboard' }),
      })
      // Reload
      const res = await fetch(`/api/admin/staff/${staffId}/compliance/explain`)
      setData(await res.json() as ExplainResponse)
      onOverrideGranted?.()
    } catch { /* ignore */ }
    finally { setRevoking(false) }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Compliance details for ${staffName}`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Compliance Explanation</h2>
            <p className="text-sm text-gray-500 mt-0.5">{staffName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Close">
            <span className="material-symbols-outlined text-[20px] text-gray-500">close</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-5">
          {(['breakdown', 'escalation'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={[
                'py-3 px-1 mr-5 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              {tab === 'breakdown' ? 'Score Breakdown' : 'Escalation History'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading && (
            <div className="py-12 text-center text-sm text-gray-400 animate-pulse">Loading compliance details…</div>
          )}

          {!loading && data && activeTab === 'breakdown' && (
            <>
              {/* Score + state explanation */}
              <div className="bg-gray-50 rounded-xl p-4 flex items-start gap-4">
                <div className="flex-shrink-0 text-center">
                  <div className="text-3xl font-bold text-primary tabular-nums">{data.breakdown.percentage}%</div>
                  <div className="text-[11px] text-gray-500 uppercase tracking-wider mt-0.5">compliance</div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{data.breakdown.stateExplanation}</p>
                  {data.breakdown.primaryBlocker && (
                    <p className="text-xs text-red-600 mt-1 font-medium">
                      Primary blocker: {data.breakdown.primaryBlocker}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {data.breakdown.compliantItems} of {data.breakdown.totalRequired} required items satisfied
                    {data.breakdown.penaltyPerItem > 0 && (
                      <> · each issue costs −{data.breakdown.penaltyPerItem}%</>
                    )}
                  </p>
                </div>
              </div>

              {/* Active override banner */}
              {data.activeOverride && (
                <div className="rounded-xl bg-orange-50 border border-orange-200 p-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-orange-800 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">shield_with_heart</span>
                      Active Compliance Override
                    </p>
                    <p className="text-xs text-orange-700 mt-1">{data.activeOverride.reason}</p>
                    <p className="text-xs text-orange-600 mt-0.5">
                      Expires {fmtDate(data.activeOverride.expiresAt)}
                      {' '}· {Math.max(0, daysFromNow(data.activeOverride.expiresAt))} days remaining
                    </p>
                  </div>
                  <button
                    onClick={revokeOverride}
                    disabled={revoking}
                    className="text-xs text-orange-700 bg-white border border-orange-300 rounded-lg px-3 py-1.5 hover:bg-orange-50 transition-colors whitespace-nowrap disabled:opacity-50"
                  >
                    {revoking ? 'Revoking…' : 'Revoke'}
                  </button>
                </div>
              )}

              {/* Issues list */}
              {data.breakdown.issues.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Issues ({data.breakdown.issues.length})
                  </h3>
                  <div className="space-y-2">
                    {data.breakdown.issues.map((reason) => (
                      <div
                        key={`${reason.item}-${reason.status}`}
                        className="rounded-xl border border-gray-200 p-3.5 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className={`material-symbols-outlined text-[18px] ${STATUS_CLS[reason.status] ?? 'text-gray-500'}`}>
                              {STATUS_ICON[reason.status] ?? 'info'}
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-gray-800">{reason.label}</p>
                              <p className="text-[11px] text-gray-400 capitalize">{reason.category}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {reason.scorePenalty < 0 && (
                              <span className="text-xs font-bold text-red-600 tabular-nums">
                                {reason.scorePenalty}%
                              </span>
                            )}
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ring-1 ${IMPACT_CLS[reason.impact] ?? ''}`}>
                              {reason.impact}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-gray-600">{reason.explanation}</p>

                        {reason.expiryDate && (
                          <p className="text-xs text-gray-500">
                            {reason.status === 'expired'
                              ? `Expired: ${fmtDate(reason.expiryDate)}`
                              : `Expires: ${fmtDate(reason.expiryDate)} (${Math.max(0, reason.daysUntilExpiry ?? 0)} days)`
                            }
                          </p>
                        )}

                        <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                          <p className="text-xs font-medium text-blue-700 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                            {reason.action}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* OK items (collapsible) */}
              {data.breakdown.ok.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowOkItems((v) => !v)}
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {showOkItems ? 'expand_less' : 'expand_more'}
                    </span>
                    {showOkItems ? 'Hide' : 'Show'} satisfied items ({data.breakdown.ok.length})
                  </button>
                  {showOkItems && (
                    <div className="mt-2 space-y-1.5">
                      {data.breakdown.ok.map((reason) => (
                        <div key={reason.item} className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-100 px-3 py-2">
                          <span className="material-symbols-outlined text-[16px] text-green-600">check_circle</span>
                          <span className="text-xs font-medium text-green-800">{reason.label}</span>
                          {reason.expiryDate && (
                            <span className="ml-auto text-[11px] text-green-600">Exp: {fmtDate(reason.expiryDate)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Override CTA */}
              {!data.activeOverride && data.breakdown.issues.some((r) => r.status === 'missing' || r.status === 'expired') && (
                <div>
                  {showOverride ? (
                    <OverrideForm
                      staffId={staffId}
                      onSuccess={() => {
                        setShowOverride(false)
                        setLoading(true)
                        fetch(`/api/admin/staff/${staffId}/compliance/explain`)
                          .then((r) => r.json() as Promise<ExplainResponse>)
                          .then(setData)
                          .catch(() => null)
                          .finally(() => setLoading(false))
                        onOverrideGranted?.()
                      }}
                      onCancel={() => setShowOverride(false)}
                    />
                  ) : (
                    <button
                      onClick={() => setShowOverride(true)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-orange-300 text-orange-700 text-sm font-medium rounded-xl hover:bg-orange-50 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">shield_with_heart</span>
                      Grant Temporary Override
                    </button>
                  )}
                </div>
              )}

              {/* View profile link */}
              <a
                href={`/admin/staff/${staffId}`}
                className="flex items-center justify-center gap-1.5 text-xs text-primary font-medium hover:underline"
              >
                <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                View full staff profile
              </a>
            </>
          )}

          {/* Escalation tab */}
          {!loading && activeTab === 'escalation' && (
            <div className="space-y-4">
              {!escalation ? (
                <div className="py-8 text-center text-sm text-gray-400 animate-pulse">Loading escalation history…</div>
              ) : (
                <>
                  {escalation.history.length === 0 && escalation.remindersLog.length === 0 ? (
                    <div className="py-8 text-center text-sm text-gray-400">No escalations or reminders recorded.</div>
                  ) : (
                    <>
                      {escalation.history.length > 0 && (
                        <div>
                          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Escalation Events</h3>
                          <div className="space-y-2">
                            {escalation.history.map((event) => (
                              <div key={event.id} className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="text-sm font-semibold text-orange-800">{event.levelLabel}</p>
                                    <p className="text-xs text-orange-600 mt-0.5">{event.daysNonCompliant} days non-compliant at time of escalation</p>
                                  </div>
                                  <time className="text-xs text-orange-500 whitespace-nowrap flex-shrink-0">
                                    {fmtDate(event.timestamp)}
                                  </time>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {escalation.remindersLog.length > 0 && (
                        <div>
                          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Reminder Notifications Sent</h3>
                          <div className="space-y-1.5">
                            {escalation.remindersLog.map((r) => (
                              <div key={r.id} className="flex items-start justify-between gap-2 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                                <div>
                                  <p className="text-xs font-medium text-gray-700">{r.subject ?? 'Compliance reminder'}</p>
                                </div>
                                <time className="text-[11px] text-gray-400 whitespace-nowrap">{fmtDate(r.timestamp)}</time>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
