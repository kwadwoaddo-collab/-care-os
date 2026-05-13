'use client'

import { useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  staffProfileId: string
  docId:          string
  docType:        string
  initialStatus:  string | null
  reviewedBy?:    string | null
  reviewedAt?:    string | null
  reviewNotes?:   string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

const STATUS_CLS: Record<string, string> = {
  approved: 'bg-green-50 text-green-700 ring-green-600/20',
  rejected: 'bg-red-50 text-red-700 ring-red-600/20',
  pending:  'bg-gray-50 text-on-surface-variant ring-gray-400/20',
}

const STATUS_LABEL: Record<string, string> = {
  approved: '✓ Approved',
  rejected: '✕ Rejected',
  pending:  '· Pending review',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DocumentApprovalButton({
  staffProfileId,
  docId,
  docType,
  initialStatus,
  reviewedBy,
  reviewedAt,
  reviewNotes,
}: Props) {
  const [status,      setStatus]      = useState<string | null>(initialStatus ?? 'pending')
  const [by,          setBy]          = useState(reviewedBy ?? '')
  const [at,          setAt]          = useState(reviewedAt ?? '')
  const [notes,       setNotes]       = useState(reviewNotes ?? '')
  const [showReject,  setShowReject]  = useState(false)
  const [rejectNotes, setRejectNotes] = useState('')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [saved,       setSaved]       = useState(false)

  async function doAction(action: 'approve' | 'reject', actionNotes?: string) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/staff/${staffProfileId}/documents/${docId}/approve`,
        {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ action, notes: actionNotes }),
        }
      )
      const json = await res.json() as {
        document?: {
          reviewed_status: string
          reviewed_by:     string | null
          reviewed_at:     string | null
          review_notes:    string | null
        }
        error?: string
      }
      if (!res.ok) throw new Error(json.error ?? 'Action failed')
      const d = json.document!
      setStatus(d.reviewed_status)
      setBy(d.reviewed_by ?? '')
      setAt(d.reviewed_at ?? '')
      setNotes(d.review_notes ?? '')
      setShowReject(false)
      setRejectNotes('')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const statusCls   = STATUS_CLS[status ?? 'pending']   ?? STATUS_CLS.pending
  const statusLabel = STATUS_LABEL[status ?? 'pending'] ?? '· Unknown'

  return (
    <div className="mt-2">
      {/* Current review status badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusCls}`}>
          {statusLabel}
        </span>

        {at && (
          <span className="text-xs text-gray-400">
            {by ? `by ${by} · ` : ''}{formatDate(at)}
          </span>
        )}
        {notes && (
          <span className="text-xs text-on-surface-variant italic">"{notes}"</span>
        )}
      </div>

      {/* Action buttons — shown only if not yet approved/rejected */}
      {status !== 'approved' && status !== 'rejected' && !showReject && (
        <div className="flex gap-1.5 mt-1.5">
          <button
            onClick={() => doAction('approve')}
            disabled={saving}
            className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            aria-label={`Approve ${docType.replace(/_/g, ' ')}`}
          >
            {saving ? '…' : '✓ Approve'}
          </button>
          <button
            onClick={() => setShowReject(true)}
            disabled={saving}
            className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium bg-white text-red-600 ring-1 ring-inset ring-red-300 hover:bg-red-50 disabled:opacity-50 transition-colors"
            aria-label={`Reject ${docType.replace(/_/g, ' ')}`}
          >
            ✕ Reject
          </button>
        </div>
      )}

      {/* Re-review buttons — allow changing a previous decision */}
      {(status === 'approved' || status === 'rejected') && !showReject && (
        <button
          onClick={() => setShowReject(true)}
          className="mt-1.5 text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
        >
          Change decision
        </button>
      )}

      {/* Reject / re-review form */}
      {showReject && (
        <div className="mt-2 space-y-2 bg-gray-50 border border-gray-200 rounded-md p-3">
          <p className="text-xs font-medium text-gray-700">
            {status === 'approved' ? 'Change decision' : 'Reject document'}
          </p>
          <textarea
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            placeholder="Optional note (e.g. 'Document unclear — please reupload')"
            rows={2}
            className="w-full rounded border border-gray-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
          />
          <div className="flex gap-1.5">
            <button
              onClick={() => doAction('approve', rejectNotes || undefined)}
              disabled={saving}
              className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {saving ? '…' : '✓ Approve'}
            </button>
            <button
              onClick={() => doAction('reject', rejectNotes || undefined)}
              disabled={saving}
              className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {saving ? '…' : '✕ Reject'}
            </button>
            <button
              onClick={() => { setShowReject(false); setRejectNotes('') }}
              className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-300 bg-white hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}

      {saved && !showReject && (
        <p className="text-xs text-green-600 mt-1">Saved.</p>
      )}
    </div>
  )
}
