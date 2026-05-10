'use client'

import { useEffect, useRef, useState } from 'react'

interface WorkerDocument {
  id:            string
  document_type: string
  file_name:     string
  file_path:     string | null
  file_size:     number | null
  expiry_date:   string | null
  created_at:    string
}

const DOCUMENT_TYPES = [
  { value: 'passport',             label: 'Passport' },
  { value: 'right_to_work',        label: 'Right to Work' },
  { value: 'dbs',                  label: 'DBS Certificate' },
  { value: 'training_certificate', label: 'Training Certificate' },
  { value: 'qualification',        label: 'Qualification' },
  { value: 'proof_of_address',     label: 'Proof of Address' },
  { value: 'national_insurance',   label: 'National Insurance' },
  { value: 'other',                label: 'Other' },
]

function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function isExpired(iso: string | null) {
  return iso ? new Date(iso) < new Date() : false
}

function isExpiringSoon(iso: string | null) {
  if (!iso) return false
  const days = (new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return days >= 0 && days <= 30
}

function formatBytes(bytes: number | null) {
  if (!bytes) return null
  if (bytes < 1024)         return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function DocCard({ d }: { d: WorkerDocument }) {
  const expired = isExpired(d.expiry_date)
  const soon    = !expired && isExpiringSoon(d.expiry_date)
  const expiryLabel = formatDate(d.expiry_date)

  const cardCls = expired
    ? 'bg-red-50 border-red-200'
    : soon
    ? 'bg-amber-50 border-amber-200'
    : 'bg-white border-gray-200'

  const expiryBadgeCls = expired
    ? 'text-red-600 font-semibold'
    : soon
    ? 'text-amber-600 font-medium'
    : 'text-gray-500'

  return (
    <div className={`rounded-xl border p-4 ${cardCls}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">
            {d.document_type.replace(/_/g, ' ')}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{d.file_name}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {[formatBytes(d.file_size), formatDate(d.created_at) ? `Uploaded ${formatDate(d.created_at)}` : null]
              .filter(Boolean).join(' · ')}
          </p>
        </div>

        <div className="flex-shrink-0 flex flex-col items-end gap-2 text-right">
          {expiryLabel ? (
            <span className={`text-xs ${expiryBadgeCls}`}>
              {expired ? 'Expired ' : soon ? 'Expiring ' : 'Expires '}
              {expiryLabel}
            </span>
          ) : (
            <span className="text-xs text-gray-400">No expiry</span>
          )}
          {d.file_path ? (
            <a
              href={`/api/admin/documents/download?path=${encodeURIComponent(d.file_path)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-600 font-semibold hover:underline"
            >
              Download →
            </a>
          ) : (
            <span className="text-xs text-gray-400">—</span>
          )}
        </div>
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-48 bg-gray-100 rounded-2xl" />
      <div className="h-6 bg-gray-100 rounded w-32" />
      <div className="space-y-2">
        {[1, 2].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}
      </div>
    </div>
  )
}

export default function WorkerDocumentsPage() {
  const fileRef = useRef<HTMLInputElement>(null)

  const [docs,    setDocs]    = useState<WorkerDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [token,   setToken]   = useState('')

  const [docType,    setDocType]    = useState('passport')
  const [expiryDate, setExpiryDate] = useState('')
  const [file,       setFile]       = useState<File | null>(null)
  const [uploading,  setUploading]  = useState(false)
  const [uploadErr,  setUploadErr]  = useState<string | null>(null)
  const [uploadOk,   setUploadOk]   = useState(false)

  function loadDocs(t: string) {
    fetch(`/api/worker/documents?token=${encodeURIComponent(t)}`)
      .then(async (res) => {
        const data = await res.json() as WorkerDocument[] | { error: string }
        if (!res.ok) {
          setError((data as { error: string }).error ?? 'Failed to load documents.')
          return
        }
        setDocs(data as WorkerDocument[])
      })
      .catch(() => setError('Network error — please try again.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    const t = sessionStorage.getItem('worker_token')
    if (!t) {
      setError('Session expired. Please use your portal link again.')
      setLoading(false)
      return
    }
    setToken(t)
    loadDocs(t)
  }, [])

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) { setUploadErr('Please select a file.'); return }
    setUploading(true)
    setUploadErr(null)
    setUploadOk(false)

    const fd = new FormData()
    fd.append('token',         token)
    fd.append('file',          file)
    fd.append('document_type', docType)
    if (expiryDate) fd.append('expiry_date', expiryDate)

    try {
      const res  = await fetch('/api/worker/documents/upload', { method: 'POST', body: fd })
      const json = await res.json() as { error?: string }
      if (!res.ok) { setUploadErr(json.error ?? 'Upload failed.'); return }
      setUploadOk(true)
      setFile(null)
      setExpiryDate('')
      if (fileRef.current) fileRef.current.value = ''
      loadDocs(token)
    } catch {
      setUploadErr('Network error — please try again.')
    } finally {
      setUploading(false)
    }
  }

  if (loading) return <Skeleton />

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>
    )
  }

  const expiredDocs = docs.filter((d) => isExpired(d.expiry_date))
  const soonDocs    = docs.filter((d) => isExpiringSoon(d.expiry_date))
  const okDocs      = docs.filter((d) => !isExpired(d.expiry_date) && !isExpiringSoon(d.expiry_date))

  return (
    <div className="space-y-6 pb-4">
      <h1 className="text-xl font-bold text-gray-900">My Documents</h1>

      {/* Status summary */}
      {(expiredDocs.length > 0 || soonDocs.length > 0) && (
        <div className="space-y-2">
          {expiredDocs.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              <span className="text-base">⚠</span>
              <span>
                <strong>{expiredDocs.length}</strong> document{expiredDocs.length > 1 ? 's have' : ' has'} expired — please upload a replacement.
              </span>
            </div>
          )}
          {soonDocs.length > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
              <span className="text-base">🗓</span>
              <span>
                <strong>{soonDocs.length}</strong> document{soonDocs.length > 1 ? 's expire' : ' expires'} within 30 days.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Upload form */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Upload a document</h2>

        {uploadOk && (
          <div data-testid="upload-document-ok" className="rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-700 font-medium">
            ✓ Document uploaded successfully.
          </div>
        )}
        {uploadErr && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{uploadErr}</div>
        )}

        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label htmlFor="doc-type" className="block text-sm font-medium text-gray-700 mb-1.5">
              Document type
            </label>
            <select
              id="doc-type"
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="block w-full rounded-xl border border-gray-300 px-3 py-3 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              {DOCUMENT_TYPES.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="expiry-date" className="block text-sm font-medium text-gray-700 mb-1.5">
              Expiry date <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              id="expiry-date"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="block w-full rounded-xl border border-gray-300 px-3 py-3 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              File <span className="font-normal text-gray-400">(PDF, JPG, PNG, DOC — max 10 MB)</span>
            </label>
            {/* Custom file button */}
            <label className="flex flex-col items-center gap-2 w-full rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-5 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors">
              <span className="text-2xl">📎</span>
              <span className="text-sm font-medium text-indigo-600">
                {file ? 'Change file' : 'Tap to select a file'}
              </span>
              {file ? (
                <span className="text-xs text-gray-600 text-center truncate max-w-full px-2">
                  {file.name} ({formatBytes(file.size)})
                </span>
              ) : (
                <span className="text-xs text-gray-400">PDF, JPG, PNG, DOC, DOCX</span>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null)
                  setUploadOk(false)
                }}
                className="sr-only"
                aria-label="Select document file"
              />
            </label>
          </div>

          <button
            data-testid="upload-document-btn"
            type="submit"
            disabled={uploading || !file}
            className="w-full rounded-xl bg-indigo-600 py-3.5 text-base font-semibold text-white hover:bg-indigo-500 active:scale-95 transition-all disabled:opacity-40"
          >
            {uploading ? 'Uploading…' : 'Upload Document'}
          </button>
        </form>
      </div>

      {/* Document list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">
            My Documents
            <span className="ml-1.5 text-gray-400 font-normal">({docs.length})</span>
          </h2>
        </div>

        {docs.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-8 text-center text-sm text-gray-400">
            No documents uploaded yet.
          </div>
        ) : (
          <div className="space-y-2">
            {/* Expired first */}
            {expiredDocs.map((d) => <DocCard key={d.id} d={d} />)}
            {soonDocs.map((d)    => <DocCard key={d.id} d={d} />)}
            {okDocs.map((d)      => <DocCard key={d.id} d={d} />)}
          </div>
        )}
      </div>
    </div>
  )
}
