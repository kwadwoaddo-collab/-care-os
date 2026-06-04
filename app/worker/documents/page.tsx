'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { TRAINING_CATEGORIES, DOCUMENT_TYPES, TRAINING_CATEGORY_LABELS } from '@/lib/documents/constants'

// ── Types ──────────────────────────────────────────────────────────────────────

interface WorkerDocument {
  id:                      string
  document_type:           string
  training_category:       string | null
  file_name:               string
  file_path:               string | null
  file_size:               number | null
  expiry_date:             string | null
  issue_date:              string | null
  created_at:              string
  reviewed_status:         string | null
  review_notes:            string | null
  verification_status:     string | null
  rejected_reason:         string | null
  resubmission_requested:  boolean
}

interface Requirements {
  requiredTraining:    string[]
  approvedCategories:  string[]
  pendingCategories:   string[]
  missingCategories:   string[]
  requiredDocs:        string[]
  uploadedDocTypes:    string[]
  missingDocs:         string[]
  // Compliance explainability fields
  complianceState?:      string
  compliancePercentage?: number
  primaryBlocker?:       string | null
  stateExplanation?:     string
  nextActions?: Array<{
    label:  string
    action: string
    status: string
    impact: string
  }>
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const ACCEPTED      = '.pdf,.jpg,.jpeg,.png,.doc,.docx'
const MAX_BYTES     = 10 * 1024 * 1024

function fmt(bytes: number | null) {
  if (!bytes) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}
function fmtDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
function isExpired(iso: string | null)     { return iso ? new Date(iso) < new Date() : false }
function isExpiringSoon(iso: string | null) {
  if (!iso) return false
  const d = (new Date(iso).getTime() - Date.now()) / 86400000
  return d >= 0 && d <= 30
}

function docTypeLabel(t: string) {
  return DOCUMENT_TYPES.find((d) => d.value === t)?.label ?? t.replace(/_/g, ' ')
}
function trainingLabel(c: string) {
  return (TRAINING_CATEGORY_LABELS as Record<string, string>)[c] ?? c.replace(/_/g, ' ')
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function VerificationStatusBadge({ verificationStatus, reviewedStatus, resubmissionRequested }: {
  verificationStatus:    string | null
  reviewedStatus:        string | null
  resubmissionRequested: boolean
}) {
  const status = verificationStatus ?? (reviewedStatus === 'approved' ? 'approved' : reviewedStatus === 'rejected' ? 'rejected' : 'pending_verification')
  const map: Record<string, { label: string; cls: string }> = {
    pending_verification: { label: '⏳ Pending review',        cls: 'bg-amber-100 text-amber-700' },
    verified:             { label: '✓ Verified',               cls: 'bg-blue-100 text-blue-700' },
    approved:             { label: '✓ Approved',               cls: 'bg-green-100 text-green-700' },
    rejected:             { label: resubmissionRequested ? '↩ Resubmission required' : '✕ Rejected', cls: 'bg-red-100 text-red-700' },
    expired:              { label: 'Expired',                  cls: 'bg-gray-100 text-gray-600' },
    superseded:           { label: 'Superseded',               cls: 'bg-gray-100 text-gray-400' },
  }
  const entry = map[status] ?? { label: '⏳ Pending review', cls: 'bg-amber-100 text-amber-700' }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${entry.cls}`}>
      {entry.label}
    </span>
  )
}

function DocCard({ d }: { d: WorkerDocument }) {
  const expired = isExpired(d.expiry_date)
  const soon    = !expired && isExpiringSoon(d.expiry_date)
  const cardCls = expired ? 'bg-red-50 border-red-200 border-l-red-500' : soon ? 'bg-amber-50 border-amber-200 border-l-amber-500' : 'bg-surface-container-lowest border-gray-200 border-l-indigo-300'

  // File type icon
  const ext = d.file_name.split('.').pop()?.toLowerCase() ?? ''
  const fileIcon = ext === 'pdf' ? '📄'
    : ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? '🖼️'
    : ['doc', 'docx'].includes(ext) ? '📓'
    : '📎'

  return (
    <div className={`rounded-xl border border-l-4 p-4 space-y-2 shadow-sm ${cardCls}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <span className="text-2xl flex-shrink-0 mt-0.5" aria-hidden="true">{fileIcon}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">{docTypeLabel(d.document_type)}</p>
            {d.training_category && (
              <p className="text-xs text-indigo-600 font-medium">{trainingLabel(d.training_category)}</p>
            )}
            <p className="text-xs text-gray-500 mt-0.5 truncate">{d.file_name}</p>
            <p className="text-xs text-gray-400">
              {[fmt(d.file_size), fmtDate(d.created_at) ? `Uploaded ${fmtDate(d.created_at)}` : null]
                .filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        <div className="flex-shrink-0 text-right space-y-1">
          {d.expiry_date && (
            <p className={`text-xs ${expired ? 'text-red-600 font-semibold' : soon ? 'text-amber-600 font-medium' : 'text-gray-500'}`}>
              {expired ? 'Expired ' : soon ? 'Expiring ' : 'Expires '}{fmtDate(d.expiry_date)}
            </p>
          )}
          {d.file_path && (
            <a
              href={`/api/admin/documents/download?path=${encodeURIComponent(d.file_path)}`}
              target="_blank" rel="noopener noreferrer"
              className="text-xs text-indigo-600 font-semibold hover:underline"
            >
              Download →
            </a>
          )}
        </div>
      </div>
      <VerificationStatusBadge
        verificationStatus={d.verification_status}
        reviewedStatus={d.reviewed_status}
        resubmissionRequested={d.resubmission_requested}
      />
      {(d.rejected_reason || d.review_notes) && (d.verification_status === 'rejected' || d.reviewed_status === 'rejected') && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
          <p className="text-xs font-semibold text-red-700">Action required</p>
          <p className="text-xs text-red-600 mt-0.5">{d.rejected_reason ?? d.review_notes}</p>
          {d.resubmission_requested && (
            <a href="/worker/documents#upload"
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg px-3 py-1.5 transition-colors">
              <span className="material-symbols-outlined text-[13px]">upload_file</span>
              Upload replacement
            </a>
          )}
        </div>
      )}
    </div>
  )
}

// ── Compliance status panel ────────────────────────────────────────────────────

function ComplianceStatusPanel({ reqs }: { reqs: Requirements }) {
  const state      = reqs.complianceState ?? 'compliant'
  const percentage = reqs.compliancePercentage ?? 100

  if (state === 'compliant') return null   // only show if there's something to explain

  const stateConfig: Record<string, { bg: string; border: string; icon: string; title: string; iconCls: string }> = {
    blocked:       { bg: 'bg-red-50',    border: 'border-red-200',    icon: '🚫', title: 'Blocked from shifts',  iconCls: 'text-red-600' },
    non_compliant: { bg: 'bg-orange-50', border: 'border-orange-200', icon: '⚠️', title: 'Action required',      iconCls: 'text-orange-600' },
    warning:       { bg: 'bg-amber-50',  border: 'border-amber-200',  icon: '🗓',  title: 'Credentials expiring', iconCls: 'text-amber-600' },
  }

  const cfg = stateConfig[state] ?? stateConfig['non_compliant']!

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{cfg.title}</p>
          {reqs.stateExplanation && (
            <p className="text-xs text-gray-700 mt-0.5">{reqs.stateExplanation}</p>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="text-lg font-bold text-gray-800 tabular-nums">{percentage}%</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">compliant</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-surface-container-lowest rounded-full overflow-hidden border border-gray-100">
        <div
          className={`h-full rounded-full transition-all ${
            state === 'blocked'       ? 'bg-red-500' :
            state === 'non_compliant' ? 'bg-orange-500' :
            'bg-amber-400'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Primary blocker */}
      {reqs.primaryBlocker && (
        <p className="text-xs font-medium text-gray-700">
          <strong>Primary issue:</strong> {reqs.primaryBlocker}
        </p>
      )}

      {/* Next actions */}
      {reqs.nextActions && reqs.nextActions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">What to do next:</p>
          {reqs.nextActions.map((action, i) => (
            <div key={i} className="flex items-start gap-2 bg-white/70 rounded-lg px-3 py-2 border border-gray-100">
              <span className="text-xs font-bold text-gray-400 w-4 mt-0.5">{i + 1}.</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800">{action.label}</p>
                <p className="text-xs text-gray-600 mt-0.5">{action.action}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MissingBanner({ reqs }: { reqs: Requirements }) {
  const hasMissing = reqs.missingDocs.length > 0 || reqs.missingCategories.length > 0
  const hasPending = reqs.pendingCategories.length > 0
  if (!hasMissing && !hasPending) return null

  return (
    <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-3">
      <p className="text-sm font-semibold text-amber-800">Compliance items needed</p>

      {reqs.missingDocs.length > 0 && (
        <div>
          <p className="text-xs font-medium text-amber-700 mb-1.5">Missing documents:</p>
          <div className="flex flex-wrap gap-1.5">
            {reqs.missingDocs.map((d) => (
              <span key={d} className="inline-flex items-center rounded-full bg-red-100 text-red-700 px-2.5 py-1 text-xs font-medium">
                {docTypeLabel(d)}
              </span>
            ))}
          </div>
        </div>
      )}

      {reqs.missingCategories.length > 0 && (
        <div>
          <p className="text-xs font-medium text-amber-700 mb-1.5">Missing training:</p>
          <div className="flex flex-wrap gap-1.5">
            {reqs.missingCategories.map((c) => (
              <span key={c} className="inline-flex items-center rounded-full bg-red-100 text-red-700 px-2.5 py-1 text-xs font-medium">
                {trainingLabel(c)}
              </span>
            ))}
          </div>
        </div>
      )}

      {hasPending && (
        <div>
          <p className="text-xs font-medium text-amber-700 mb-1.5">Awaiting review:</p>
          <div className="flex flex-wrap gap-1.5">
            {reqs.pendingCategories.map((c) => (
              <span key={c} className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 px-2.5 py-1 text-xs font-medium">
                ⏳ {trainingLabel(c)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function WorkerDocumentsPage() {
  const fileRef = useRef<HTMLInputElement>(null)

  const [docs,       setDocs]      = useState<WorkerDocument[]>([])
  const [reqs,       setReqs]      = useState<Requirements | null>(null)
  const [loading,    setLoading]   = useState(true)
  const [error,      setError]     = useState<string | null>(null)
  const [token,      setToken]     = useState('')

  // Upload form
  const [docType,          setDocType]          = useState('passport')
  const [trainingCategory, setTrainingCategory] = useState('')
  const [expiryDate,       setExpiryDate]       = useState('')
  const [issueDate,        setIssueDate]        = useState('')
  const [file,             setFile]             = useState<File | null>(null)
  const [uploading,        setUploading]        = useState(false)
  const [progress,         setProgress]         = useState(0)
  const [uploadErr,        setUploadErr]        = useState<string | null>(null)
  const [uploadOk,         setUploadOk]         = useState(false)
  const [isDragOver,       setIsDragOver]       = useState(false)
  const [dupWarning,       setDupWarning]       = useState<string | null>(null)
  const [dupConfirmed,     setDupConfirmed]     = useState(false)

  const loadDocs = useCallback((t: string) => {
    return fetch(`/api/worker/documents?token=${encodeURIComponent(t)}`)
      .then(async (res) => {
        const data = await res.json() as WorkerDocument[] | { error: string }
        if (!res.ok) { setError((data as { error: string }).error ?? 'Failed to load.'); return }
        setDocs(data as WorkerDocument[])
      })
  }, [])

  const loadReqs = useCallback((t: string) => {
    return fetch(`/api/worker/onboarding/requirements?token=${encodeURIComponent(t)}`)
      .then(async (res) => {
        if (!res.ok) return
        setReqs(await res.json() as Requirements)
      })
  }, [])

  useEffect(() => {
    const t = sessionStorage.getItem('worker_token')
    if (!t) { setError('Session expired. Please use your portal link again.'); setLoading(false); return }
    setToken(t)
    Promise.all([loadDocs(t), loadReqs(t)])
      .catch(() => setError('Network error — please try again.'))
      .finally(() => setLoading(false))
  }, [loadDocs, loadReqs])

  function validateFile(f: File): string | null {
    if (f.size > MAX_BYTES) return `File too large (max 10 MB, yours is ${fmt(f.size)}).`
    const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    if (!['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'].includes(ext))
      return 'Unsupported file type. Use PDF, JPG, PNG, DOC, or DOCX.'
    return null
  }

  function handleFileChange(f: File | null) {
    setFile(f); setUploadOk(false); setUploadErr(null); setDupWarning(null); setDupConfirmed(false)
    if (f) { const e = validateFile(f); if (e) { setUploadErr(e); setFile(null) } }
  }

  // Check for duplicate approved cert when training category changes
  function checkDuplicate(cat: string) {
    if (!cat || !reqs) return
    if (reqs.approvedCategories.includes(cat)) {
      setDupWarning(`You already have an approved ${trainingLabel(cat)} certificate. Uploading another will supersede it and require re-approval.`)
    } else {
      setDupWarning(null)
    }
    setDupConfirmed(false)
  }

  function handleCategoryChange(v: string) {
    setTrainingCategory(v)
    checkDuplicate(v)
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) { setUploadErr('Please select a file.'); return }
    if (docType === 'training_certificate' && !trainingCategory) {
      setUploadErr('Please select a training category.'); return
    }
    if (dupWarning && !dupConfirmed) {
      setUploadErr('Please confirm you want to upload a duplicate.'); return
    }
    const validErr = validateFile(file)
    if (validErr) { setUploadErr(validErr); return }

    setUploading(true); setUploadErr(null); setUploadOk(false); setProgress(0)

    const fd = new FormData()
    fd.append('token', token)
    fd.append('file', file)
    fd.append('document_type', docType)
    if (expiryDate) fd.append('expiry_date', expiryDate)
    if (issueDate)  fd.append('issue_date',  issueDate)
    if (docType === 'training_certificate' && trainingCategory) {
      fd.append('training_category', trainingCategory)
    }

    await new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest()
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100))
      }
      xhr.onload = () => {
        setUploading(false)
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploadOk(true); setFile(null); setExpiryDate(''); setIssueDate('')
          setTrainingCategory(''); setProgress(0); setDupWarning(null); setDupConfirmed(false)
          if (fileRef.current) fileRef.current.value = ''
          Promise.all([loadDocs(token), loadReqs(token)]).catch(() => null)
        } else {
          try { setUploadErr((JSON.parse(xhr.responseText) as { error?: string }).error ?? `Upload failed (${xhr.status}).`) }
          catch { setUploadErr(`Upload failed (${xhr.status}).`) }
        }
        resolve()
      }
      xhr.onerror = () => { setUploading(false); setUploadErr('Network error — please try again.'); resolve() }
      xhr.open('POST', '/api/worker/documents/upload')
      xhr.send(fd)
    })
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-gray-100 rounded-xl w-40" />
        <div className="h-32 bg-gray-100 rounded-2xl" />
        <div className="h-48 bg-gray-100 rounded-2xl" />
      </div>
    )
  }

  if (error) {
    return <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>
  }

  const expiredDocs       = docs.filter((d) => isExpired(d.expiry_date))
  const soonDocs          = docs.filter((d) => !isExpired(d.expiry_date) && isExpiringSoon(d.expiry_date))
  const okDocs            = docs.filter((d) => !isExpired(d.expiry_date) && !isExpiringSoon(d.expiry_date))
  const resubmissionDocs  = docs.filter((d) => d.resubmission_requested)
  const rejectedDocs      = docs.filter((d) => (d.verification_status === 'rejected' || d.reviewed_status === 'rejected') && !d.resubmission_requested)
  const pendingDocs       = docs.filter((d) => d.verification_status === 'pending_verification' || (!d.verification_status && d.reviewed_status === 'pending'))
  const approvedDocs      = docs.filter((d) => d.verification_status === 'approved' || (!d.verification_status && d.reviewed_status === 'approved'))

  return (
    <div className="space-y-6 pb-4" id="worker-doc-center">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">My Documents</h1>
        <Link href="/worker/onboarding" className="text-xs text-indigo-600 font-medium hover:underline">
          View checklist →
        </Link>
      </div>

      {/* Document status summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 bg-surface-container-lowest px-3 py-2.5 text-center">
          <p className="text-xl font-bold text-gray-900 tabular-nums">{docs.length}</p>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">Total</p>
        </div>
        <div className={`rounded-xl border px-3 py-2.5 text-center ${approvedDocs.length > 0 ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-surface-container-lowest'}`}>
          <p className={`text-xl font-bold tabular-nums ${approvedDocs.length > 0 ? 'text-green-700' : 'text-gray-400'}`}>{approvedDocs.length}</p>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">Approved</p>
        </div>
        <div className={`rounded-xl border px-3 py-2.5 text-center ${pendingDocs.length > 0 ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-surface-container-lowest'}`}>
          <p className={`text-xl font-bold tabular-nums ${pendingDocs.length > 0 ? 'text-amber-700' : 'text-gray-400'}`}>{pendingDocs.length}</p>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">Under review</p>
        </div>
        <div className={`rounded-xl border px-3 py-2.5 text-center ${(resubmissionDocs.length + rejectedDocs.length) > 0 ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-surface-container-lowest'}`}>
          <p className={`text-xl font-bold tabular-nums ${(resubmissionDocs.length + rejectedDocs.length) > 0 ? 'text-red-700' : 'text-gray-400'}`}>
            {resubmissionDocs.length + rejectedDocs.length}
          </p>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">Action needed</p>
        </div>
      </div>

      {/* Resubmission alerts */}
      {resubmissionDocs.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-red-600 text-[20px]">upload_file</span>
            <p className="text-sm font-semibold text-red-800">
              {resubmissionDocs.length} document{resubmissionDocs.length > 1 ? 's' : ''} require resubmission
            </p>
          </div>
          {resubmissionDocs.map((d) => (
            <div key={d.id} className="rounded-lg border border-red-200 bg-surface-container-lowest px-3 py-2.5">
              <p className="text-xs font-semibold text-gray-800">{d.file_name}</p>
              {(d.rejected_reason || d.review_notes) && (
                <p className="text-xs text-red-600 mt-0.5">{d.rejected_reason ?? d.review_notes}</p>
              )}
              <a href="#upload" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg px-3 py-1.5 transition-colors">
                <span className="material-symbols-outlined text-[12px]">upload</span>
                Upload replacement
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Expiry reminders */}
      {(expiredDocs.length > 0 || soonDocs.length > 0) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-amber-600 text-[18px]">schedule</span>
            <p className="text-sm font-semibold text-amber-800">Document expiry reminders</p>
          </div>
          {expiredDocs.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2 text-xs bg-surface-container-lowest rounded-lg border border-red-200 px-3 py-1.5">
              <span className="font-medium text-gray-800">{d.file_name}</span>
              <span className="text-red-700 font-semibold shrink-0">Expired {fmtDate(d.expiry_date)}</span>
            </div>
          ))}
          {soonDocs.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2 text-xs bg-surface-container-lowest rounded-lg border border-amber-200 px-3 py-1.5">
              <span className="font-medium text-gray-800">{d.file_name}</span>
              <span className="text-amber-700 font-semibold shrink-0">Expires {fmtDate(d.expiry_date)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Compliance status + explainability panel */}
      {reqs && <ComplianceStatusPanel reqs={reqs} />}

      {/* Missing / pending compliance banner */}
      {reqs && <MissingBanner reqs={reqs} />}
      
      {/* Success CTA when all required documents are uploaded */}
      {reqs && reqs.missingDocs.length === 0 && reqs.missingCategories.length === 0 && (
        <div className="rounded-xl bg-green-50 border border-green-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <div>
              <p className="text-sm font-semibold text-green-800">All required documents uploaded</p>
              <p className="text-xs text-green-700 mt-0.5">You can return to the checklist to complete any remaining steps.</p>
            </div>
          </div>
          <Link
            href="/worker/onboarding"
            className="whitespace-nowrap rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
          >
            Return to Checklist
          </Link>
        </div>
      )}

      {/* Expiry alerts */}
      {(expiredDocs.length > 0 || soonDocs.length > 0) && (
        <div className="space-y-2">
          {expiredDocs.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              <span>⚠</span>
              <span><strong>{expiredDocs.length}</strong> document{expiredDocs.length > 1 ? 's have' : ' has'} expired — please upload a replacement.</span>
            </div>
          )}
          {soonDocs.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
              <span>🗓</span>
              <span><strong>{soonDocs.length}</strong> document{soonDocs.length > 1 ? 's expire' : ' expires'} within 30 days.</span>
            </div>
          )}
        </div>
      )}

      {/* Upload form */}
      <div className="bg-surface-container-lowest rounded-2xl border border-gray-200 p-4 space-y-4 shadow-sm" id="upload">
        <h2 className="text-sm font-bold text-gray-900 border-l-4 border-indigo-500 pl-3">Upload a document</h2>

        {uploadOk && (
          <div data-testid="upload-document-ok" className="rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-700 font-medium">
            ✓ Document uploaded successfully — awaiting admin review.
          </div>
        )}

        {uploadErr && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 space-y-2">
            <p className="text-sm text-red-700">{uploadErr}</p>
            <button
              type="button"
              onClick={() => { setUploadErr(null); setFile(null); if (fileRef.current) fileRef.current.value = '' }}
              className="text-xs text-red-600 font-medium underline"
            >
              Try again
            </button>
          </div>
        )}

        <form onSubmit={handleUpload} className="space-y-4">
          {/* Document type */}
          <div>
            <label htmlFor="doc-type" className="block text-sm font-medium text-gray-700 mb-1.5">
              Document type
            </label>
            <select
              id="doc-type"
              value={docType}
              onChange={(e) => { setDocType(e.target.value); setTrainingCategory(''); setDupWarning(null); setDupConfirmed(false) }}
              className="block w-full rounded-xl border border-gray-300 px-3 py-3 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              {DOCUMENT_TYPES.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

          {/* Training category */}
          {docType === 'training_certificate' && (
            <>
              <div>
                <label htmlFor="training-cat" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Training category <span className="text-red-500">*</span>
                </label>
                <select
                  id="training-cat"
                  value={trainingCategory}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="block w-full rounded-xl border border-gray-300 px-3 py-3 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">— Select category —</option>
                  {TRAINING_CATEGORIES.map((tc) => {
                    const isMissing  = reqs?.missingCategories.includes(tc.value)
                    const isPending  = reqs?.pendingCategories.includes(tc.value)
                    const isApproved = reqs?.approvedCategories.includes(tc.value)
                    const suffix = isMissing ? ' ← needed' : isPending ? ' (pending review)' : isApproved ? ' ✓ approved' : ''
                    return (
                      <option key={tc.value} value={tc.value}>{tc.label}{suffix}</option>
                    )
                  })}
                </select>

                {/* Missing training callout */}
                {reqs && reqs.missingCategories.length > 0 && !trainingCategory && (
                  <p className="text-xs text-amber-700 mt-1.5">
                    Still needed: {reqs.missingCategories.map((c) => trainingLabel(c)).join(', ')}
                  </p>
                )}
              </div>

              {/* Duplicate warning */}
              {dupWarning && (
                <div className="rounded-xl bg-amber-50 border border-amber-300 p-3 space-y-2">
                  <p className="text-sm text-amber-800 font-medium">⚠ Duplicate certificate</p>
                  <p className="text-xs text-amber-700">{dupWarning}</p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dupConfirmed}
                      onChange={(e) => setDupConfirmed(e.target.checked)}
                      className="rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-xs text-amber-800 font-medium">I understand, upload anyway</span>
                  </label>
                </div>
              )}

              <div>
                <label htmlFor="issue-date" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Issue date <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <input
                  id="issue-date" type="date" value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="block w-full rounded-xl border border-gray-300 px-3 py-3 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs text-blue-700">
                👁️ Training certificates require admin approval before counting towards compliance.
              </div>
            </>
          )}

          {/* Expiry date */}
          <div>
            <label htmlFor="expiry-date" className="block text-sm font-medium text-gray-700 mb-1.5">
              Expiry date <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              id="expiry-date" type="date" value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="block w-full rounded-xl border border-gray-300 px-3 py-3 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {/* File zone */}
          <div>
            <p className="block text-sm font-medium text-gray-700 mb-1.5">
              File <span className="font-normal text-gray-400">(PDF, JPG, PNG, DOC · Max 10 MB)</span>
            </p>
            <label
              className={[
                'flex flex-col items-center gap-2 w-full rounded-xl border-2 border-dashed px-4 py-6 cursor-pointer transition-all',
                isDragOver ? 'border-indigo-500 bg-indigo-50 scale-[1.01]'
                : file     ? 'border-green-400 bg-green-50/40'
                :             'border-gray-300 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50/50',
              ].join(' ')}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileChange(f) }}
            >
              <span className="text-3xl">{file ? '✅' : isDragOver ? '⬇️' : '📎'}</span>
              <span className="text-sm font-medium text-indigo-600">
                {file ? 'Change file' : isDragOver ? 'Drop to upload' : 'Tap to select or drag a file here'}
              </span>
              {file && <span className="text-xs text-gray-600 text-center truncate max-w-full px-2">{file.name} ({fmt(file.size)})</span>}
              <input
                ref={fileRef} type="file" accept={ACCEPTED} capture="environment"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                className="sr-only" aria-label="Select document file"
              />
            </label>
          </div>

          {uploading && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Uploading…</span><span className="tabular-nums font-medium">{progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-indigo-500 transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          <button
            data-testid="upload-document-btn"
            type="submit"
            disabled={uploading || !file || (dupWarning !== null && !dupConfirmed)}
            className="w-full rounded-xl bg-indigo-600 py-3.5 text-base font-semibold text-white hover:bg-indigo-500 active:scale-95 transition-all disabled:opacity-40"
          >
            {uploading ? `Uploading ${progress}%…` : 'Upload Document'}
          </button>
        </form>
      </div>

      {/* Document list */}
      <div>
        <h2 className="text-sm font-bold text-gray-900 mb-3 border-l-4 border-indigo-500 pl-3">
          My Documents
          <span className="ml-1.5 text-gray-400 font-normal">({docs.length})</span>
        </h2>
        {docs.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-2xl border border-gray-200 px-4 py-10 text-center shadow-sm">
            <p className="text-4xl mb-3" aria-hidden="true">📦</p>
            <p className="text-sm font-semibold text-gray-700 mb-1">No documents uploaded yet</p>
            <p className="text-xs text-gray-400 mb-4">Upload your first document using the form above to get started.</p>
            <a
              href="#upload"
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">upload_file</span>
              Upload a document
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            {expiredDocs.map((d) => <DocCard key={d.id} d={d} />)}
            {soonDocs.map((d)    => <DocCard key={d.id} d={d} />)}
            {okDocs.map((d)      => <DocCard key={d.id} d={d} />)}
          </div>
        )}
      </div>
    </div>
  )
}
