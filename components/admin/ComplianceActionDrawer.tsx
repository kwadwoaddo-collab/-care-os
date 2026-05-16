'use client'

import { useRef, useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  DOCUMENT_TYPES,
  TRAINING_CATEGORIES,
  MAX_FILE_BYTES,
  ALLOWED_EXTENSIONS,
} from '@/lib/documents/constants'

// ── Types ─────────────────────────────────────────────────────────────────────

export type DrawerAction = 'upload' | 'approve' | 'reject' | 'review_notes' | 'set_expiry'

export interface DrawerDoc {
  id: string
  document_type: string
  file_name: string
  reviewed_status: string | null
  expiry_date: string | null
  source: 'applicant' | 'staff'
}

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  staffProfileId: string
  action: DrawerAction
  doc?: DrawerDoc | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ALLOWED_EXT_LIST = [...ALLOWED_EXTENSIONS].join(', ').toUpperCase()
const MAX_MB = MAX_FILE_BYTES / (1024 * 1024)

function docTypeLabel(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

const ACTION_LABELS: Record<DrawerAction, string> = {
  upload:       'Upload Replacement Document',
  approve:      'Approve Document',
  reject:       'Reject Document',
  review_notes: 'Add Review Notes',
  set_expiry:   'Set Expiry Date',
}

const ACTION_ICONS: Record<DrawerAction, string> = {
  upload:       'upload_file',
  approve:      'check_circle',
  reject:       'cancel',
  review_notes: 'rate_review',
  set_expiry:   'event',
}

// ── Sub-form components ───────────────────────────────────────────────────────

function SuccessBanner({ message }: { message: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-start gap-3 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
      <span className="material-symbols-outlined text-[18px] text-green-600 shrink-0 mt-0.5">check_circle</span>
      <p className="text-sm font-medium text-green-800">{message}</p>
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div role="alert" aria-live="assertive" className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
      <span className="material-symbols-outlined text-[18px] text-red-600 shrink-0 mt-0.5">error</span>
      <p className="text-sm font-medium text-red-800">{message}</p>
    </div>
  )
}

// ── Upload form ───────────────────────────────────────────────────────────────

function UploadForm({
  staffProfileId,
  prefilledType,
  onSuccess,
}: {
  staffProfileId: string
  prefilledType?: string
  onSuccess: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [documentType, setDocumentType] = useState(prefilledType ?? DOCUMENT_TYPES[0].value)
  const [trainingCategory, setTrainingCategory] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [issueDate, setIssueDate] = useState('')
  const [trainingName, setTrainingName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null
    if (!picked) { setFile(null); return }
    if (picked.size > MAX_FILE_BYTES) {
      setError(`File exceeds the ${MAX_MB} MB limit`)
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    const ext = picked.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      setError(`File type .${ext} is not allowed. Allowed: ${ALLOWED_EXT_LIST}`)
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    setError(null)
    setFile(picked)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!file) { setError('Please select a file.'); return }

    const fd = new FormData()
    fd.append('file', file)
    fd.append('document_type', documentType)
    if (expiryDate) fd.append('expiry_date', expiryDate)
    if (issueDate) fd.append('issue_date', issueDate)
    if (documentType === 'training_certificate') {
      if (trainingCategory) fd.append('training_category', trainingCategory)
      if (trainingName) fd.append('training_name', trainingName)
    }

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/staff/${staffProfileId}/documents/upload`, {
          method: 'POST',
          body: fd,
        })
        const json = await res.json() as { error?: string }
        if (!res.ok) { setError(json.error ?? 'Upload failed.'); return }
        setSuccess(true)
        setFile(null)
        if (fileRef.current) fileRef.current.value = ''
        onSuccess()
      } catch {
        setError('Network error — please try again.')
      }
    })
  }

  if (success) return <SuccessBanner message="Document uploaded successfully. The staff profile has been refreshed." />

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <ErrorBanner message={error} />}

      {/* Document type */}
      <div>
        <label htmlFor="cad-doc-type" className="block text-xs font-semibold text-gray-700 mb-1">
          Document type <span className="text-red-500">*</span>
        </label>
        <select
          id="cad-doc-type"
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value)}
          className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {DOCUMENT_TYPES.map((dt) => (
            <option key={dt.value} value={dt.value}>{dt.label}</option>
          ))}
        </select>
      </div>

      {/* Training fields */}
      {documentType === 'training_certificate' && (
        <>
          <div>
            <label htmlFor="cad-training-cat" className="block text-xs font-semibold text-gray-700 mb-1">
              Training category <span className="text-red-500">*</span>
            </label>
            <select
              id="cad-training-cat"
              value={trainingCategory}
              onChange={(e) => setTrainingCategory(e.target.value)}
              className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">— Select category —</option>
              {TRAINING_CATEGORIES.map((tc) => (
                <option key={tc.value} value={tc.value}>{tc.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="cad-training-name" className="block text-xs font-semibold text-gray-700 mb-1">
              Training name <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              id="cad-training-name"
              type="text"
              value={trainingName}
              onChange={(e) => setTrainingName(e.target.value)}
              placeholder="e.g. City & Guilds Manual Handling"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="cad-issue-date" className="block text-xs font-semibold text-gray-700 mb-1">
              Issue date <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              id="cad-issue-date"
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </>
      )}

      {/* File */}
      <div>
        <label htmlFor="cad-file" className="block text-xs font-semibold text-gray-700 mb-1">
          File <span className="text-red-500">*</span>{' '}
          <span className="font-normal text-gray-400">({ALLOWED_EXT_LIST} — max {MAX_MB} MB)</span>
        </label>
        <input
          id="cad-file"
          ref={fileRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
        />
      </div>

      {/* Expiry date */}
      <div>
        <label htmlFor="cad-expiry" className="block text-xs font-semibold text-gray-700 mb-1">
          Expiry date <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          id="cad-expiry"
          type="date"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={isPending || !file}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? 'Uploading…' : 'Upload Document'}
        </button>
      </div>
    </form>
  )
}

// ── Approve form ──────────────────────────────────────────────────────────────

function ApproveForm({
  staffProfileId,
  doc,
  onSuccess,
}: {
  staffProfileId: string
  doc: DrawerDoc
  onSuccess: () => void
}) {
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleApprove() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/staff/${staffProfileId}/documents/${doc.id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', notes: notes.trim() || undefined }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Approval failed')
      setSuccess(true)
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  if (success) return <SuccessBanner message="Document approved successfully." />

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <div className="rounded-lg bg-green-50 border border-green-200 p-4">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-[20px] text-green-600 shrink-0 mt-0.5">verified</span>
          <div>
            <p className="text-sm font-semibold text-green-800">Approve this document?</p>
            <p className="text-xs text-green-700 mt-1">
              <strong>{doc.file_name}</strong> ({docTypeLabel(doc.document_type)}) will be marked as approved.
              This will count toward the staff member&apos;s compliance score.
            </p>
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="cad-approve-notes" className="block text-xs font-semibold text-gray-700 mb-1">
          Review notes <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          id="cad-approve-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Any notes about this approval…"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
        />
      </div>

      <button
        onClick={handleApprove}
        disabled={saving}
        className="w-full rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Approving…' : '✓ Approve Document'}
      </button>
    </div>
  )
}

// ── Reject form ───────────────────────────────────────────────────────────────

function RejectForm({
  staffProfileId,
  doc,
  onSuccess,
}: {
  staffProfileId: string
  doc: DrawerDoc
  onSuccess: () => void
}) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleReject() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/staff/${staffProfileId}/documents/${doc.id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', notes: reason.trim() || undefined }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Rejection failed')
      setSuccess(true)
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  if (success) return <SuccessBanner message="Document rejected. The staff member has been notified." />

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <div className="rounded-lg bg-red-50 border border-red-200 p-4">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-[20px] text-red-600 shrink-0 mt-0.5">cancel</span>
          <div>
            <p className="text-sm font-semibold text-red-800">Reject this document?</p>
            <p className="text-xs text-red-700 mt-1">
              <strong>{doc.file_name}</strong> will be marked as rejected. The staff member will be notified and asked to re-upload.
            </p>
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="cad-reject-reason" className="block text-xs font-semibold text-gray-700 mb-1">
          Reason for rejection <span className="text-gray-400 font-normal">(recommended)</span>
        </label>
        <textarea
          id="cad-reject-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          placeholder="e.g. Document is unclear — please reupload a higher quality scan. Or: This document has expired."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400 resize-none"
        />
        <p className="mt-1 text-xs text-gray-400">This note will be sent to the staff member as part of the rejection notification.</p>
      </div>

      <button
        onClick={handleReject}
        disabled={saving}
        className="w-full rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Rejecting…' : '✕ Reject Document'}
      </button>
    </div>
  )
}

// ── Set expiry form ───────────────────────────────────────────────────────────

function SetExpiryForm({
  staffProfileId,
  doc,
  onSuccess,
}: {
  staffProfileId: string
  doc: DrawerDoc
  onSuccess: () => void
}) {
  const [expiryDate, setExpiryDate] = useState(doc.expiry_date?.slice(0, 10) ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSave() {
    if (!expiryDate) { setError('Please select an expiry date.'); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/staff/${staffProfileId}/documents/${doc.id}/expiry`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiry_date: expiryDate }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Failed to update expiry date')
      setSuccess(true)
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  if (success) return <SuccessBanner message="Expiry date updated successfully." />

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
        <p className="text-xs text-gray-600">
          Updating expiry date for: <strong className="text-gray-800">{doc.file_name}</strong>
        </p>
      </div>

      <div>
        <label htmlFor="cad-new-expiry" className="block text-xs font-semibold text-gray-700 mb-1">
          New expiry date <span className="text-red-500">*</span>
        </label>
        <input
          id="cad-new-expiry"
          type="date"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !expiryDate}
        className="w-full rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving…' : 'Save Expiry Date'}
      </button>
    </div>
  )
}

// ── Review notes form ─────────────────────────────────────────────────────────

function ReviewNotesForm({
  staffProfileId,
  onSuccess,
}: {
  staffProfileId: string
  onSuccess: () => void
}) {
  const [reviewedBy, setReviewedBy] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/staff/${staffProfileId}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewed_by: reviewedBy, notes }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Save failed')
      setSuccess(true)
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  if (success) return <SuccessBanner message="Compliance review notes saved successfully." />

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <div>
        <label htmlFor="cad-reviewer" className="block text-xs font-semibold text-gray-700 mb-1">
          Reviewed by
        </label>
        <input
          id="cad-reviewer"
          type="text"
          value={reviewedBy}
          onChange={(e) => setReviewedBy(e.target.value)}
          placeholder="Name of reviewer"
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label htmlFor="cad-review-notes" className="block text-xs font-semibold text-gray-700 mb-1">
          Review notes
        </label>
        <textarea
          id="cad-review-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          placeholder="Any notes about this compliance review…"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving…' : 'Save Review Notes'}
      </button>
    </div>
  )
}

// ── Main drawer ───────────────────────────────────────────────────────────────

export default function ComplianceActionDrawer({
  open,
  onClose,
  onSuccess,
  staffProfileId,
  action,
  doc,
}: Props) {
  const router = useRouter()
  const drawerRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Trap scroll behind backdrop
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  function handleSuccess() {
    onSuccess()
    router.refresh()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={ACTION_LABELS[action]}
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 bg-gray-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 shrink-0">
              <span className="material-symbols-outlined text-[20px] text-indigo-700" aria-hidden="true">
                {ACTION_ICONS[action]}
              </span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">{ACTION_LABELS[action]}</h2>
              {doc && (
                <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[220px]">
                  {docTypeLabel(doc.document_type)}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close drawer"
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5">
          {action === 'upload' && (
            <UploadForm
              staffProfileId={staffProfileId}
              prefilledType={doc?.document_type}
              onSuccess={handleSuccess}
            />
          )}
          {action === 'approve' && doc && (
            <ApproveForm
              staffProfileId={staffProfileId}
              doc={doc}
              onSuccess={handleSuccess}
            />
          )}
          {action === 'reject' && doc && (
            <RejectForm
              staffProfileId={staffProfileId}
              doc={doc}
              onSuccess={handleSuccess}
            />
          )}
          {action === 'set_expiry' && doc && (
            <SetExpiryForm
              staffProfileId={staffProfileId}
              doc={doc}
              onSuccess={handleSuccess}
            />
          )}
          {action === 'review_notes' && (
            <ReviewNotesForm
              staffProfileId={staffProfileId}
              onSuccess={handleSuccess}
            />
          )}
        </div>

        {/* Footer — fallback link */}
        <div className="border-t border-gray-200 bg-gray-50 px-5 py-3">
          <p className="text-xs text-gray-400">
            Need more options?{' '}
            <a
              href={`/admin/compliance?staff=${staffProfileId}`}
              className="underline underline-offset-2 hover:text-gray-600 transition-colors"
            >
              Open full compliance view
            </a>
          </p>
        </div>
      </div>
    </>
  )
}
