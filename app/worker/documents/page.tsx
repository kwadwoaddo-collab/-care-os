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
  { value: 'passport',            label: 'Passport' },
  { value: 'right_to_work',       label: 'Right to Work' },
  { value: 'dbs',                 label: 'DBS Certificate' },
  { value: 'training_certificate', label: 'Training Certificate' },
  { value: 'qualification',       label: 'Qualification' },
  { value: 'proof_of_address',    label: 'Proof of Address' },
  { value: 'national_insurance',  label: 'National Insurance' },
  { value: 'other',               label: 'Other' },
]

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function isExpired(iso: string | null) {
  return iso ? new Date(iso) < new Date() : false
}

function formatBytes(bytes: number | null) {
  if (!bytes) return '—'
  if (bytes < 1024)         return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function WorkerDocumentsPage() {
  const fileRef = useRef<HTMLInputElement>(null)

  const [docs,    setDocs]    = useState<WorkerDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [token,   setToken]   = useState('')

  const [docType,     setDocType]     = useState('passport')
  const [expiryDate,  setExpiryDate]  = useState('')
  const [file,        setFile]        = useState<File | null>(null)
  const [uploading,   setUploading]   = useState(false)
  const [uploadErr,   setUploadErr]   = useState<string | null>(null)
  const [uploadOk,    setUploadOk]    = useState(false)

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

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>
  if (error)   return <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">My Documents</h1>

      {/* Upload form */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Upload a document</h2>

        {uploadOk && (
          <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">Document uploaded successfully.</div>
        )}
        {uploadErr && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{uploadErr}</div>
        )}

        <form onSubmit={handleUpload} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Document type</label>
              <select value={docType} onChange={(e) => setDocType(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {DOCUMENT_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Expiry date <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              File <span className="font-normal text-gray-400">(PDF, JPG, PNG, DOC, DOCX — max 10 MB)</span>
            </label>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
            />
          </div>

          <button type="submit" disabled={uploading}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </form>
      </div>

      {/* Documents list */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-gray-700">
            Documents <span className="ml-1 text-gray-400 font-normal">({docs.length})</span>
          </h2>
        </div>

        {docs.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400">No documents uploaded yet.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Uploaded</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {docs.map((d) => {
                const expired = isExpired(d.expiry_date)
                return (
                  <tr key={d.id} className={expired ? 'bg-red-50' : ''}>
                    <td className="px-4 py-3 text-gray-900 truncate max-w-[180px]">{d.file_name}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{d.document_type.replace(/_/g, ' ')}</td>
                    <td className={`px-4 py-3 whitespace-nowrap text-sm ${expired ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                      {formatDate(d.expiry_date)}
                      {expired && <span className="ml-1 text-xs">(expired)</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatBytes(d.file_size)}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(d.created_at)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {d.file_path ? (
                        <a
                          href={`/api/admin/documents/download?path=${encodeURIComponent(d.file_path)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-600 hover:underline font-medium"
                        >
                          Download
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
