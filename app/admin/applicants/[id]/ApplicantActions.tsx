'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Props {
  applicantId: string
  currentStatus: string
  rejectedAt?: string | null
  rejectionReason?: string | null
  rejectionNotes?: string | null
  canRestore?: boolean
  linkedStaffProfileId?: string | null
  linkedStaffName?: string | null
  convertedAt?: string | null
}

type ActionStatus  = 'idle' | 'saving' | 'success' | 'error'
type ConvertStatus = 'idle' | 'loading' | 'done' | 'error'
type RestoreStatus = 'idle' | 'saving' | 'success' | 'error'

const STATUS_BADGE_MAP: Record<string, string> = {
  applied:              'bg-blue-50 text-blue-700 ring-blue-600/20',
  shortlisted:          'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  rejected:             'bg-red-50 text-red-700 ring-red-600/20',
  interview_scheduled:  'bg-purple-50 text-purple-700 ring-purple-600/20',
  hired:                'bg-green-50 text-green-700 ring-green-600/20',
  withdrawn:            'bg-gray-50 text-gray-600 ring-gray-500/20',
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_BADGE_MAP[status] ?? 'bg-gray-50 text-gray-600 ring-gray-500/20'
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const PIPELINE_ACTIONS: { label: string; targetStatus: string; btnCls: string }[] = [
  {
    label:        'Shortlist',
    targetStatus: 'shortlisted',
    btnCls:       'bg-yellow-50 text-yellow-700 ring-yellow-600/20 hover:bg-yellow-100',
  },
  {
    label:        'Schedule Interview',
    targetStatus: 'interview_scheduled',
    btnCls:       'bg-purple-50 text-purple-700 ring-purple-600/20 hover:bg-purple-100',
  },
  {
    label:        'Hire',
    targetStatus: 'hired',
    btnCls:       'bg-green-50 text-green-700 ring-green-600/20 hover:bg-green-100',
  },
]

export default function ApplicantActions({
  applicantId,
  currentStatus,
  rejectedAt,
  rejectionReason,
  canRestore = false,
  linkedStaffProfileId = null,
  linkedStaffName      = null,
  convertedAt          = null,
}: Props) {
  const [status, setStatus]             = useState(currentStatus)
  const [actionStatus, setActionStatus] = useState<ActionStatus>('idle')
  const [message, setMessage]           = useState<string | null>(null)

  // Initialise from server-side conversion state so the button is never
  // active for an already-converted applicant, even on a fresh page load.
  const [convertStatus, setConvertStatus]   = useState<ConvertStatus>(linkedStaffProfileId ? 'done' : 'idle')
  const [convertMessage, setConvertMessage] = useState<string | null>(null)
  const [staffProfileId, setStaffProfileId] = useState<string | null>(linkedStaffProfileId)
  const [convertedAtDisplay, setConvertedAtDisplay] = useState<string | null>(convertedAt)
  const [justConverted, setJustConverted] = useState(false)

  // Rejection modal state
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason]       = useState('')
  const [rejectNotes, setRejectNotes]         = useState('')

  // Restore modal state
  const [showRestoreModal, setShowRestoreModal]   = useState(false)
  const [restoreNewStatus, setRestoreNewStatus]   = useState<'applied' | 'shortlisted'>('applied')
  const [restoreNote, setRestoreNote]             = useState('')
  const [restoreStatus, setRestoreStatus]         = useState<RestoreStatus>('idle')
  const [restoreMessage, setRestoreMessage]       = useState<string | null>(null)

  async function handleAction(targetStatus: string) {
    if (targetStatus === 'rejected') {
      setShowRejectModal(true)
      return
    }
    setActionStatus('saving')
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/applicants/${applicantId}/status`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: targetStatus }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `Request failed with status ${res.status}`)
      }
      setStatus(targetStatus)
      setActionStatus('success')
      setMessage(`Status updated to "${targetStatus.replace(/_/g, ' ')}"`)
    } catch (err) {
      setActionStatus('error')
      setMessage(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  async function handleReject() {
    setActionStatus('saving')
    setMessage(null)
    setShowRejectModal(false)
    try {
      const res = await fetch(`/api/admin/applicants/${applicantId}/status`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          status:           'rejected',
          rejection_reason: rejectReason.trim() || null,
          rejection_notes:  rejectNotes.trim()  || null,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `Request failed with status ${res.status}`)
      }
      setStatus('rejected')
      setActionStatus('success')
      setMessage('Applicant rejected.')
      setRejectReason('')
      setRejectNotes('')
    } catch (err) {
      setActionStatus('error')
      setMessage(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  async function handleRestore() {
    setRestoreStatus('saving')
    setRestoreMessage(null)
    try {
      const res = await fetch(`/api/admin/applicants/${applicantId}/restore`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ new_status: restoreNewStatus, restore_note: restoreNote.trim() || null }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `Request failed with status ${res.status}`)
      }
      setStatus(restoreNewStatus)
      setRestoreStatus('success')
      setRestoreMessage(`Applicant restored to "${restoreNewStatus === 'shortlisted' ? 'In Review' : 'Applied'}".`)
      setShowRestoreModal(false)
      setRestoreNote('')
    } catch (err) {
      setRestoreStatus('error')
      setRestoreMessage(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  async function handleConvert() {
    setConvertStatus('loading')
    setConvertMessage(null)
    try {
      const res = await fetch(`/api/admin/applicants/${applicantId}/convert`, { method: 'POST' })
      const body = await res.json() as {
        staff_profile?: { id: string; created_at?: string }
        error?: string
      }

      // 409 means already converted (race condition / second tab)
      if (res.status === 409 && body.staff_profile) {
        setStaffProfileId(body.staff_profile.id)
        setConvertedAtDisplay(body.staff_profile.created_at ?? null)
        setConvertStatus('done')
        setConvertMessage(null)
        return
      }

      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`)

      setStaffProfileId(body.staff_profile?.id ?? null)
      setConvertedAtDisplay(body.staff_profile?.created_at ?? null)
      setJustConverted(true)
      setConvertStatus('done')
    } catch (err) {
      setConvertStatus('error')
      setConvertMessage(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  const isSaving   = actionStatus === 'saving'
  const isTerminal = status === 'hired' || status === 'rejected' || status === 'withdrawn'

  return (
    <>
      <div className="bg-surface-container-lowest border border-gray-200 rounded-lg px-4 py-3 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {/* Current status */}
          <div className="flex items-center gap-1.5 mr-2">
            <span className="text-xs text-on-surface-variant font-medium">Status:</span>
            <StatusBadge status={status} />
          </div>

          {/* Pipeline buttons */}
          {!isTerminal && (
            <>
              <div className="h-4 w-px bg-gray-200" />
              {PIPELINE_ACTIONS.map((action) => {
                const isActive = status === action.targetStatus
                return (
                  <button
                    key={action.targetStatus}
                    id={`action-${action.targetStatus}`}
                    onClick={() => handleAction(action.targetStatus)}
                    disabled={isSaving || isActive}
                    className={[
                      'inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors',
                      action.btnCls,
                      isActive ? 'opacity-40 cursor-not-allowed' : isSaving ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
                    ].join(' ')}
                  >
                    {isSaving ? (
                      <span className="flex items-center gap-1">
                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        {action.label}
                      </span>
                    ) : action.label}
                  </button>
                )
              })}
              {/* Reject button — triggers modal */}
              <button
                id="action-rejected"
                onClick={() => handleAction('rejected')}
                disabled={isSaving}
                className={[
                  'inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors',
                  'bg-red-50 text-red-700 ring-red-600/20 hover:bg-red-100',
                  isSaving ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
                ].join(' ')}
              >
                Reject
              </button>
            </>
          )}

          {/* Rejected state */}
          {status === 'rejected' && (
            <>
              <div className="h-4 w-px bg-gray-200" />
              <span className="text-xs text-red-600 font-medium">Rejected</span>
              {rejectedAt && (
                <span className="text-xs text-on-surface-variant">on {formatDate(rejectedAt)}</span>
              )}
              {canRestore && (
                <button
                  onClick={() => setShowRestoreModal(true)}
                  className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium ring-1 ring-inset bg-blue-50 text-blue-700 ring-blue-600/20 hover:bg-blue-100 cursor-pointer transition-colors"
                >
                  Restore Applicant
                </button>
              )}
            </>
          )}

          {/* Other terminal states */}
          {isTerminal && status !== 'hired' && status !== 'rejected' && (
            <>
              <div className="h-4 w-px bg-gray-200" />
              <span className="text-xs text-on-surface-variant italic">Pipeline closed</span>
            </>
          )}
        </div>

        {/* Rejection reason display */}
        {status === 'rejected' && rejectionReason && (
          <div className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            <span className="font-medium">Reason: </span>{rejectionReason}
          </div>
        )}

        {/* Feedback messages */}
        {message && (
          <p className={`mt-2 text-xs ${actionStatus === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {actionStatus === 'success' ? '✓ ' : '✕ '}{message}
          </p>
        )}
        {restoreMessage && (
          <p className={`mt-2 text-xs ${restoreStatus === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {restoreStatus === 'success' ? '✓ ' : '✕ '}{restoreMessage}
          </p>
        )}

        {/* Lifecycle helper — shown only for active applicants */}
        {!isTerminal && (
          <p className="mt-2 text-xs text-on-surface-variant border-t border-gray-100 pt-2">
            Applicants can only be permanently deleted after they are rejected or archived.{' '}
            <Link href="/admin/applicants/archived" className="underline hover:text-primary transition-colors">
              View Archived Applicants →
            </Link>
          </p>
        )}

        {/* Conversion section — only shown for hired applicants */}
        {status === 'hired' && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            {convertStatus === 'done' ? (
              <>
                {/* Success banner shown immediately after clicking Convert */}
                {justConverted && (
                  <div className="mb-2 flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2">
                    <svg className="h-4 w-4 text-green-600 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-xs font-medium text-green-700">Applicant successfully converted to staff.</span>
                  </div>
                )}

                {/* Converted state — profile summary */}
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20">
                    ✓ Converted to Staff
                  </span>

                  {linkedStaffName && (
                    <span className="text-xs text-on-surface-variant font-medium">{linkedStaffName}</span>
                  )}

                  {convertedAtDisplay && (
                    <span className="text-xs text-on-surface-variant">
                      Converted {formatDate(convertedAtDisplay)}
                    </span>
                  )}

                  {staffProfileId && (
                    <Link
                      href={`/admin/staff/${staffProfileId}`}
                      className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/20 hover:bg-indigo-100 transition-colors"
                    >
                      View Staff Profile →
                    </Link>
                  )}
                </div>
              </>
            ) : (
              /* Not yet converted — show action button */
              <div className="flex flex-wrap items-center gap-3">
                <button
                  id="btn-convert-to-staff"
                  onClick={handleConvert}
                  disabled={convertStatus === 'loading'}
                  className={[
                    'inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors',
                    convertStatus === 'loading'
                      ? 'bg-indigo-50 text-indigo-700 ring-indigo-600/20 opacity-60 cursor-not-allowed'
                      : 'bg-indigo-50 text-indigo-700 ring-indigo-600/20 hover:bg-indigo-100 cursor-pointer',
                  ].join(' ')}
                >
                  {convertStatus === 'loading' ? (
                    <span className="flex items-center gap-1">
                      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Converting…
                    </span>
                  ) : 'Convert to Staff'}
                </button>
                {convertMessage && convertStatus === 'error' && (
                  <p className="text-xs text-red-600">✕ {convertMessage}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Rejection modal ──────────────────────────────────────────────────── */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-surface-container-lowest rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Reject Applicant</h2>
            <p className="text-sm text-on-surface-variant">
              This applicant will be moved to the archived view. You can restore them later if needed.
            </p>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">
                Rejection reason <span className="text-on-surface-variant font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Not enough experience, role filled…"
                className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">
                Additional notes <span className="text-on-surface-variant font-normal">(optional)</span>
              </label>
              <textarea
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                rows={2}
                placeholder="Any further context…"
                className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => { setShowRejectModal(false); setRejectReason(''); setRejectNotes('') }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="rounded-lg px-4 py-2 text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Restore modal ────────────────────────────────────────────────────── */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-surface-container-lowest rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Restore Applicant</h2>
            <p className="text-sm text-on-surface-variant">
              Choose which stage to restore this applicant to in the pipeline.
            </p>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Restore to</label>
              <select
                value={restoreNewStatus}
                onChange={(e) => setRestoreNewStatus(e.target.value as 'applied' | 'shortlisted')}
                className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="applied">Applied</option>
                <option value="shortlisted">In Review (Shortlisted)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">
                Reason for restoring <span className="text-on-surface-variant font-normal">(optional)</span>
              </label>
              <textarea
                value={restoreNote}
                onChange={(e) => setRestoreNote(e.target.value)}
                rows={2}
                placeholder="e.g. Reconsidering after further review…"
                className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => { setShowRestoreModal(false); setRestoreNote('') }}
                disabled={restoreStatus === 'saving'}
                className="rounded-lg px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRestore}
                disabled={restoreStatus === 'saving'}
                className="rounded-lg px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {restoreStatus === 'saving' ? 'Restoring…' : 'Restore Applicant'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
