'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Props {
  applicantId: string
  applicantName: string
  canDelete: boolean
}

export default function ArchivedApplicantActions({ applicantId, applicantName, canDelete }: Props) {
  const router = useRouter()

  // Restore state
  const [showRestore, setShowRestore]       = useState(false)
  const [restoreStatus, setRestoreStatus]   = useState<'applied' | 'shortlisted'>('applied')
  const [restoreNote, setRestoreNote]       = useState('')
  const [restoring, setRestoring]           = useState(false)
  const [restoreError, setRestoreError]     = useState<string | null>(null)

  // Delete state
  const [showDelete, setShowDelete]         = useState(false)
  const [deleteConfirm, setDeleteConfirm]   = useState('')
  const [deleting, setDeleting]             = useState(false)
  const [deleteError, setDeleteError]       = useState<string | null>(null)

  async function handleRestore() {
    setRestoring(true)
    setRestoreError(null)
    try {
      const res = await fetch(`/api/admin/applicants/${applicantId}/restore`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ new_status: restoreStatus, restore_note: restoreNote.trim() || null }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `Request failed (${res.status})`)
      }
      setShowRestore(false)
      setRestoreNote('')
      router.refresh()
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setRestoring(false)
    }
  }

  async function handleDelete() {
    if (deleteConfirm !== 'DELETE') return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/admin/applicants/${applicantId}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `Request failed (${res.status})`)
      }
      setShowDelete(false)
      setDeleteConfirm('')
      router.refresh()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 justify-end">
        <Link
          href={`/admin/applicants/${applicantId}`}
          className="inline-flex items-center rounded-md px-2.5 py-1.5 text-xs font-medium text-on-surface-variant border border-outline-variant hover:bg-surface-container transition-colors"
        >
          View Details
        </Link>
        <button
          onClick={() => setShowRestore(true)}
          className="inline-flex items-center rounded-md px-2.5 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 hover:bg-blue-100 transition-colors"
        >
          Restore
        </button>
        {canDelete && (
          <button
            onClick={() => setShowDelete(true)}
            className="inline-flex items-center rounded-md px-2.5 py-1.5 text-xs font-medium bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 hover:bg-red-100 transition-colors"
          >
            Delete
          </button>
        )}
      </div>

      {/* ── Restore modal ──────────────────────────────────────────────────────── */}
      {showRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Restore Applicant</h2>
            <p className="text-sm text-on-surface-variant">
              <span className="font-medium text-primary">{applicantName}</span> will be moved back into the active pipeline.
            </p>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">Restore to</label>
              <select
                value={restoreStatus}
                onChange={(e) => setRestoreStatus(e.target.value as 'applied' | 'shortlisted')}
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
            {restoreError && (
              <p className="text-xs text-red-600">✕ {restoreError}</p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => { setShowRestore(false); setRestoreNote(''); setRestoreError(null) }}
                disabled={restoring}
                className="rounded-lg px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRestore}
                disabled={restoring}
                className="rounded-lg px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {restoring ? 'Restoring…' : 'Restore Applicant'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete modal ───────────────────────────────────────────────────────── */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-red-600 text-lg">warning</span>
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Permanently Delete Applicant</h2>
                <p className="text-sm text-on-surface-variant mt-1">
                  This will permanently remove <span className="font-medium text-primary">{applicantName}</span> and all their data. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 space-y-1">
              <p className="font-medium">The following will be permanently deleted:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Application data and form answers</li>
                <li>Uploaded documents</li>
                <li>Interview notes</li>
              </ul>
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1">
                Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
                className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500/30"
              />
            </div>
            {deleteError && (
              <p className="text-xs text-red-600">✕ {deleteError}</p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => { setShowDelete(false); setDeleteConfirm(''); setDeleteError(null) }}
                disabled={deleting}
                className="rounded-lg px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting || deleteConfirm !== 'DELETE'}
                className="rounded-lg px-4 py-2 text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 transition-colors"
              >
                {deleting ? 'Deleting…' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
