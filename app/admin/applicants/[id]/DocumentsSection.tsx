'use client'

import { useState } from 'react'
import StatusBadge, { expiryVariant } from '@/components/ui/StatusBadge'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Document {
  id: string
  company_id: string
  applicant_id: string
  document_type: string
  file_name: string
  file_path: string
  file_size: number | null
  mime_type: string | null
  expiry_date: string | null
  uploaded_by: string | null
  created_at: string
}

interface Props {
  applicantId: string
  initialDocuments: Document[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  passport:             'Passport',
  right_to_work:        'Right to Work',
  dbs:                  'DBS Certificate',
  cv:                   'CV',
  qualification:        'Qualification',
  training_certificate: 'Training Certificate',
  proof_of_address:     'Proof of Address',
  national_insurance:   'National Insurance',
  other:                'Other',
}

const DOCUMENT_TYPE_OPTIONS = Object.entries(DOCUMENT_TYPE_LABELS).map(
  ([value, label]) => ({ value, label })
)

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Returns null (valid), 'expiring' (within 30 days), or 'expired'.
 */
function expiryStatus(expiryDate: string | null): 'expired' | 'expiring' | 'valid' | null {
  if (!expiryDate) return null
  const now   = new Date()
  const expiry = new Date(expiryDate)
  if (expiry < now) return 'expired'
  const diff = expiry.getTime() - now.getTime()
  const days = diff / (1000 * 60 * 60 * 24)
  if (days <= 30) return 'expiring'
  return 'valid'
}

function ExpiryBadge({ expiryDate }: { expiryDate: string | null }) {
  if (!expiryDate) return <span className="text-gray-400 text-xs" aria-label="No expiry date">No expiry</span>
  const variant = expiryVariant(expiryDate)
  const label   = formatDate(expiryDate)
  const ariaMap: Record<string, string> = {
    expired:  `Expired on ${label}`,
    expiring: `Expiring soon: ${label}`,
    success:  `Valid until ${label}`,
  }
  return (
    <StatusBadge
      variant={variant}
      label={label}
      ariaLabel={ariaMap[variant] ?? `Expires ${label}`}
      size="xs"
    />
  )
}

// ── Upload Form ───────────────────────────────────────────────────────────────

interface UploadFormProps {
  applicantId: string
  onUploaded: (doc: Document) => void
  onCancel: () => void
}

function UploadForm({ applicantId, onUploaded, onCancel }: UploadFormProps) {
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [docType, setDocType] = useState('')
  const [expiry, setExpiry]   = useState('')
  const [file, setFile]       = useState<File | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!file)    { setError('Please select a file'); return }
    if (!docType) { setError('Please select a document type'); return }

    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('file',          file)
      fd.append('applicant_id',  applicantId)
      fd.append('document_type', docType)
      if (expiry) fd.append('expiry_date', expiry)

      const res = await fetch('/api/admin/documents', {
        method: 'POST',
        body:   fd,
        // Do NOT set Content-Type — the browser sets it with the boundary
      })

      let json: { document?: Document; error?: string }
      try {
        json = await res.json() as { document?: Document; error?: string }
      } catch {
        const fallback = `HTTP ${res.status} — non-JSON response`
        console.error('[DocumentsSection] upload failed:', fallback)
        throw new Error(fallback)
      }

      if (!res.ok) {
        console.error('[DocumentsSection] upload failed:', { status: res.status, body: json })
        throw new Error(json.error ?? `Request failed with status ${res.status}`)
      }

      onUploaded(json.document!)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-3 space-y-3">
      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Upload Document</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Document type */}
        <div>
          <label className="block text-xs text-on-surface-variant mb-1" htmlFor="doc-type">Document Type</label>
          <select
            id="doc-type"
            className={inputCls}
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
          >
            <option value="">Select type…</option>
            {DOCUMENT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Expiry date */}
        <div>
          <label className="block text-xs text-on-surface-variant mb-1" htmlFor="doc-expiry">
            Expiry Date <span className="text-gray-400">(optional)</span>
          </label>
          <input
            id="doc-expiry"
            type="date"
            className={inputCls}
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
          />
        </div>

        {/* File picker */}
        <div className="sm:col-span-2">
          <label className="block text-xs text-on-surface-variant mb-1" htmlFor="doc-file">
            File <span className="text-gray-400">(PDF, JPG, PNG, DOC, DOCX · max 10 MB)</span>
          </label>
          <input
            id="doc-file"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            className="w-full text-sm text-gray-700 file:mr-3 file:rounded file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-200"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-600">✕ {error}</p>}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          id="submit-upload-document"
          className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {saving ? 'Uploading…' : 'Upload'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium bg-surface-container-lowest text-gray-600 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── Documents Table ───────────────────────────────────────────────────────────

function DocumentsTable({ documents }: { documents: Document[] }) {
  if (documents.length === 0) {
    return <p className="text-sm text-gray-400">No documents uploaded yet.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-100 text-sm">
        <thead>
          <tr className="text-left text-xs font-medium text-on-surface-variant uppercase tracking-wide">
            <th className="pb-2 pr-4">File</th>
            <th className="pb-2 pr-4">Type</th>
            <th className="pb-2 pr-4">Size</th>
            <th className="pb-2 pr-4">Uploaded</th>
            <th className="pb-2 pr-4">Expiry</th>
            <th className="pb-2">Download</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {documents.map((doc) => (
            <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
              <td className="py-2 pr-4 font-medium text-primary max-w-[180px] truncate" title={doc.file_name}>
                {doc.file_name}
              </td>
              <td className="py-2 pr-4 text-gray-600 whitespace-nowrap">
                {DOCUMENT_TYPE_LABELS[doc.document_type] ?? doc.document_type}
              </td>
              <td className="py-2 pr-4 text-on-surface-variant whitespace-nowrap">
                {formatBytes(doc.file_size)}
              </td>
              <td className="py-2 pr-4 text-on-surface-variant whitespace-nowrap">
                {formatDate(doc.created_at)}
              </td>
              <td className="py-2 pr-4 whitespace-nowrap">
                <ExpiryBadge expiryDate={doc.expiry_date} />
              </td>
              <td className="py-2">
                <DownloadButton filePath={doc.file_path} fileName={doc.file_name} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Download Button ───────────────────────────────────────────────────────────

function DownloadButton({ filePath, fileName }: { filePath: string; fileName: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleDownload() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/admin/documents/download?path=${encodeURIComponent(filePath)}`
      )
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(json.error ?? `Download failed: ${res.status}`)
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <span>
      <button
        onClick={handleDownload}
        disabled={loading}
        className="text-blue-600 hover:text-blue-800 text-xs underline underline-offset-2 disabled:opacity-50"
      >
        {loading ? 'Downloading…' : 'Download'}
      </button>
      {error && <span className="ml-2 text-xs text-red-600">{error}</span>}
    </span>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function DocumentsSection({ applicantId, initialDocuments }: Props) {
  const [documents, setDocuments] = useState<Document[]>(initialDocuments)
  const [showForm, setShowForm]   = useState(false)

  function handleUploaded(doc: Document) {
    setDocuments((prev) => [doc, ...prev])
    setShowForm(false)
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
      {/* Section header */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">
          Documents
          {documents.length > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-400">({documents.length})</span>
          )}
        </h2>
        {!showForm && (
          <button
            id="btn-upload-document"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium bg-surface-container-lowest text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
          >
            + Upload Document
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Upload form (inline) */}
        {showForm && (
          <UploadForm
            applicantId={applicantId}
            onUploaded={handleUploaded}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* Documents table */}
        <DocumentsTable documents={documents} />
      </div>
    </div>
  )
}
