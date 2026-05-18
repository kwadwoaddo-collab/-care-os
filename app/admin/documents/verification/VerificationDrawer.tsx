'use client'

import { useState, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type DrawerMode =
  | 'verify'
  | 'approve'
  | 'reject'
  | 'resubmission'
  | 'view'

export interface DrawerDocument {
  id:                     string
  document_type:          string
  file_name:              string
  file_path:              string | null
  mime_type:              string | null
  expiry_date:            string | null
  created_at:             string
  source_stage:           string | null
  verification_status:    string
  original_seen:          boolean
  original_seen_at:       string | null
  rejected_reason:        string | null
  resubmission_requested: boolean
  compliance_linked:      boolean
  staff_profile_id:       string | null
  staff_first_name?:      string | null
  staff_last_name?:       string | null
}

interface Props {
  open:       boolean
  onClose:    () => void
  mode:       DrawerMode
  doc:        DrawerDocument | null
  onSuccess:  (docId: string, newStatus: string) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const VERIFICATION_METHODS = [
  { value: 'original_seen',      label: 'Original document seen' },
  { value: 'certified_copy',     label: 'Certified copy accepted' },
  { value: 'digital_check',      label: 'Digital check' },
  { value: 'dbs_update_service', label: 'DBS Update Service' },
  { value: 'sponsor_check',      label: 'Sponsor check' },
  { value: 'internal_review',    label: 'Internal review' },
]

const ORIGINAL_SEEN_METHODS = [
  { value: 'in_person',      label: 'In person' },
  { value: 'video_call',     label: 'Video call' },
  { value: 'certified_copy', label: 'Certified copy' },
  { value: 'digital',        label: 'Digital verification' },
]

const REJECTION_PRESETS = [
  'Document is expired',
  'Image quality too poor to read',
  'Document type does not match requirement',
  'Information does not match staff record',
  'Original not provided — certified copy required',
  'DBS certificate not in Update Service',
]

const REQUIRES_ORIGINAL_SEEN = new Set([
  'passport', 'brp', 'visa', 'right_to_work',
  'share_code', 'share_code_confirmation', 'id',
])

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const SOURCE_LABELS: Record<string, string> = {
  applicant:         'Application stage',
  onboarding:        'Onboarding stage',
  admin_upload:      'Admin upload',
  worker_upload:     'Worker portal',
  compliance_review: 'Compliance review',
}

// ── Verification status badge ─────────────────────────────────────────────────

export function VerificationBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: string; label: string }> = {
    pending_verification: { cls: 'bg-amber-100 text-amber-800 ring-amber-600/20',   icon: 'hourglass_empty', label: 'Pending' },
    verified:             { cls: 'bg-blue-100 text-blue-800 ring-blue-600/20',      icon: 'verified_user',   label: 'Verified' },
    approved:             { cls: 'bg-green-100 text-green-800 ring-green-600/20',   icon: 'check_circle',    label: 'Approved' },
    rejected:             { cls: 'bg-red-100 text-red-800 ring-red-600/20',         icon: 'cancel',          label: 'Rejected' },
    expired:              { cls: 'bg-gray-100 text-gray-600 ring-gray-500/20',      icon: 'event_busy',      label: 'Expired' },
    superseded:           { cls: 'bg-gray-100 text-gray-400 ring-gray-400/20',      icon: 'history',         label: 'Superseded' },
  }
  const { cls, icon, label } = map[status] ?? { cls: 'bg-gray-100 text-gray-600 ring-gray-400/20', icon: 'help', label: status }
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide rounded-md px-2 py-0.5 ring-1 ring-inset ${cls}`}>
      <span className="material-symbols-outlined text-[10px]">{icon}</span>
      {label}
    </span>
  )
}

// ── Panel sections ────────────────────────────────────────────────────────────

function VerifyPanel({ doc, onSuccess, onClose }: {
  doc:        DrawerDocument
  onSuccess:  (docId: string, newStatus: string) => void
  onClose:    () => void
}) {
  const [method, setMethod]   = useState('internal_review')
  const [originalSeen, setOS] = useState(REQUIRES_ORIGINAL_SEEN.has(doc.document_type))
  const [osMethod, setOsM]    = useState('in_person')
  const [notes, setNotes]     = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const submit = useCallback(async () => {
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/admin/documents/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: doc.id, verificationMethod: method,
          originalSeen, originalSeenMethod: originalSeen ? osMethod : undefined,
          verificationNotes: notes || undefined,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      onSuccess(doc.id, 'verified')
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally { setSaving(false) }
  }, [doc.id, method, originalSeen, osMethod, notes, onSuccess, onClose])

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">Verification method</label>
        <select value={method} onChange={(e) => setMethod(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
          {VERIFICATION_METHODS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {REQUIRES_ORIGINAL_SEEN.has(doc.document_type) && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-3">
          <div className="flex items-center gap-2">
            <input type="checkbox" id="original-seen" checked={originalSeen}
              onChange={(e) => setOS(e.target.checked)}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            <label htmlFor="original-seen" className="text-sm font-medium text-blue-800">
              Original document seen
            </label>
          </div>
          {originalSeen && (
            <div>
              <label className="block text-xs font-semibold text-blue-700 mb-1">How was it seen?</label>
              <select value={osMethod} onChange={(e) => setOsM(e.target.value)}
                className="w-full rounded-lg border border-blue-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                {ORIGINAL_SEEN_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">Notes (optional)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
          placeholder="Internal verification notes…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button onClick={submit} disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-40">
        {saving ? <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
          : <span className="material-symbols-outlined text-[16px]">verified_user</span>}
        {saving ? 'Saving…' : 'Mark as verified'}
      </button>
    </div>
  )
}

function ApprovePanel({ doc, onSuccess, onClose }: {
  doc:        DrawerDocument
  onSuccess:  (docId: string, newStatus: string) => void
  onClose:    () => void
}) {
  const needsOriginal = REQUIRES_ORIGINAL_SEEN.has(doc.document_type) && !doc.original_seen
  const [notes, setNotes]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const submit = useCallback(async () => {
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/admin/documents/approve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId:        doc.id,
          staffProfileId:    doc.staff_profile_id ?? undefined,
          verificationNotes: notes || undefined,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      onSuccess(doc.id, 'approved')
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally { setSaving(false) }
  }, [doc.id, doc.staff_profile_id, notes, onSuccess, onClose])

  return (
    <div className="space-y-4">
      {needsOriginal && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <span className="material-symbols-outlined text-amber-600 text-[18px] mt-0.5">warning</span>
          <p className="text-xs text-amber-800">
            This is an identity document. Mark original as seen before approving — or verify first.
          </p>
        </div>
      )}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">Approval notes (optional)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
          placeholder="Any notes to accompany approval…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button onClick={submit} disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-40">
        {saving ? <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
          : <span className="material-symbols-outlined text-[16px]">check_circle</span>}
        {saving ? 'Approving…' : 'Approve document'}
      </button>
    </div>
  )
}

function RejectPanel({ doc, mode, onSuccess, onClose }: {
  doc:        DrawerDocument
  mode:       'reject' | 'resubmission'
  onSuccess:  (docId: string, newStatus: string) => void
  onClose:    () => void
}) {
  const [reason, setReason]   = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const isResubmit = mode === 'resubmission'

  const submit = useCallback(async () => {
    if (!reason.trim()) { setError('Please provide a reason'); return }
    setSaving(true); setError(null)
    const endpoint = isResubmit
      ? '/api/admin/documents/request-resubmission'
      : '/api/admin/documents/reject'
    try {
      const res = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId:     doc.id,
          [isResubmit ? 'reason' : 'rejectedReason']: reason,
          staffProfileId: doc.staff_profile_id ?? undefined,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      onSuccess(doc.id, 'rejected')
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally { setSaving(false) }
  }, [reason, isResubmit, doc.id, doc.staff_profile_id, onSuccess, onClose])

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-600">
        {isResubmit
          ? 'The worker will be notified and asked to upload a replacement document.'
          : 'The worker will be notified that their document has been rejected.'}
      </p>
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1">Reason</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {REJECTION_PRESETS.map((p) => (
            <button key={p} onClick={() => setReason(p)}
              className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors border border-gray-200">
              {p}
            </button>
          ))}
        </div>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
          placeholder="Reason for rejection / resubmission request…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button onClick={submit} disabled={saving}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-40 ${isResubmit ? 'bg-amber-600 hover:bg-amber-700' : 'bg-red-600 hover:bg-red-700'}`}>
        {saving ? <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
          : <span className="material-symbols-outlined text-[16px]">{isResubmit ? 'upload_file' : 'cancel'}</span>}
        {saving ? 'Saving…' : isResubmit ? 'Request resubmission' : 'Reject document'}
      </button>
    </div>
  )
}

// ── Main drawer ───────────────────────────────────────────────────────────────

const MODE_TITLES: Record<DrawerMode, string> = {
  verify:       'Verify document',
  approve:      'Approve document',
  reject:       'Reject document',
  resubmission: 'Request resubmission',
  view:         'Document details',
}

export default function VerificationDrawer({ open, onClose, mode, doc, onSuccess }: Props) {
  if (!open || !doc) return null

  const staffName = [doc.staff_first_name, doc.staff_last_name].filter(Boolean).join(' ') || 'Unknown staff'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label={MODE_TITLES[mode]}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{MODE_TITLES[mode]}</p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5 truncate">{doc.file_name}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {staffName} · {doc.document_type.replace(/_/g, ' ')}
            </p>
          </div>
          <button onClick={onClose} className="shrink-0 text-gray-400 hover:text-gray-700" aria-label="Close drawer">
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {/* Document preview strip */}
        <div className="border-b border-gray-100 bg-gray-50 px-5 py-3 flex flex-wrap items-center gap-3">
          <VerificationBadge status={doc.verification_status} />
          {doc.source_stage && (
            <span className="text-[11px] text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
              {SOURCE_LABELS[doc.source_stage] ?? doc.source_stage}
            </span>
          )}
          {doc.expiry_date && (
            <span className="text-[11px] text-gray-500">
              Exp: {fmt(doc.expiry_date)}
            </span>
          )}
          <span className="text-[11px] text-gray-400">Uploaded {fmt(doc.created_at)}</span>
          {doc.compliance_linked && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-violet-700 bg-violet-50 rounded-full px-2 py-0.5 ring-1 ring-inset ring-violet-400/20 uppercase tracking-wide">
              <span className="material-symbols-outlined text-[10px]">verified</span>
              Compliance
            </span>
          )}
          {doc.original_seen && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 rounded-full px-2 py-0.5 ring-1 ring-inset ring-blue-400/20 uppercase tracking-wide">
              <span className="material-symbols-outlined text-[10px]">visibility</span>
              Original seen {fmt(doc.original_seen_at)}
            </span>
          )}
        </div>

        {/* Rejection reason if already rejected */}
        {doc.rejected_reason && (
          <div className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
            <p className="text-xs font-semibold text-red-700">Previous rejection reason:</p>
            <p className="text-xs text-red-600 mt-0.5">{doc.rejected_reason}</p>
          </div>
        )}

        {/* Action panel */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {mode === 'verify' && (
            <VerifyPanel doc={doc} onSuccess={onSuccess} onClose={onClose} />
          )}
          {mode === 'approve' && (
            <ApprovePanel doc={doc} onSuccess={onSuccess} onClose={onClose} />
          )}
          {(mode === 'reject' || mode === 'resubmission') && (
            <RejectPanel doc={doc} mode={mode} onSuccess={onSuccess} onClose={onClose} />
          )}
        </div>

        {/* Quick action shortcuts at bottom */}
        {mode !== 'approve' && mode !== 'reject' && mode !== 'resubmission' && mode !== 'verify' && (
          <div className="border-t border-gray-100 px-5 py-3 flex items-center gap-2">
            <span className="text-xs text-gray-500">Quick actions:</span>
            <button onClick={() => onSuccess(doc.id, 'pending_verification')}
              className="text-xs text-gray-600 hover:text-green-700 transition-colors">Approve</button>
          </div>
        )}
      </div>
    </>
  )
}
