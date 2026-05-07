'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

const DOCUMENT_TYPES = [
  { value: 'passport',           label: 'Passport' },
  { value: 'right_to_work',      label: 'Right to Work' },
  { value: 'dbs',                label: 'DBS Certificate' },
  { value: 'training_certificate', label: 'Training Certificate' },
  { value: 'qualification',      label: 'Qualification' },
  { value: 'proof_of_address',   label: 'Proof of Address' },
  { value: 'national_insurance', label: 'National Insurance' },
  { value: 'other',              label: 'Other' },
]

interface StaffDocumentUploadProps {
  staffProfileId: string
}

export default function StaffDocumentUpload({ staffProfileId }: StaffDocumentUploadProps) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [open,         setOpen]         = useState(false)
  const [documentType, setDocumentType] = useState('passport')
  const [expiryDate,   setExpiryDate]   = useState('')
  const [trainingName, setTrainingName] = useState('')
  const [file,         setFile]         = useState<File | null>(null)
  const [error,        setError]        = useState<string | null>(null)
  const [success,      setSuccess]      = useState(false)
  const [isPending,    startTransition] = useTransition()

  function reset() {
    setDocumentType('passport')
    setExpiryDate('')
    setTrainingName('')
    setFile(null)
    setError(null)
    setSuccess(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!file) {
      setError('Please select a file.')
      return
    }

    const fd = new FormData()
    fd.append('file', file)
    fd.append('document_type', documentType)
    if (expiryDate) fd.append('expiry_date', expiryDate)
    if (documentType === 'training_certificate' && trainingName)
      fd.append('training_name', trainingName)

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/staff/${staffProfileId}/documents/upload`, {
          method: 'POST',
          body: fd,
        })
        const json = await res.json() as { error?: string }
        if (!res.ok) {
          setError(json.error ?? 'Upload failed.')
          return
        }
        setSuccess(true)
        reset()
        router.refresh()
      } catch {
        setError('Network error — please try again.')
      }
    })
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Upload Document</h2>
        <button
          type="button"
          data-testid="doc-upload-toggle"
          onClick={() => { setOpen((o) => !o); setError(null); setSuccess(false) }}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
        >
          {open ? 'Collapse ↑' : 'Expand ↓'}
        </button>
      </div>

      {open && (
        <div className="p-4">
          {success && (
            <div data-testid="doc-upload-success" className="mb-4 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
              ✓ Document uploaded successfully.
            </div>
          )}
          {error && (
            <div data-testid="doc-upload-error" className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Document type */}
            <div>
              <label htmlFor="doc-type" className="block text-xs font-medium text-gray-700 mb-1">
                Document type <span className="text-red-500">*</span>
              </label>
              <select
                id="doc-type"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {DOCUMENT_TYPES.map((dt) => (
                  <option key={dt.value} value={dt.value}>{dt.label}</option>
                ))}
              </select>
            </div>

            {/* Training name (only for training_certificate) */}
            {documentType === 'training_certificate' && (
              <div>
                <label htmlFor="training-name" className="block text-xs font-medium text-gray-700 mb-1">
                  Training name
                </label>
                <input
                  id="training-name"
                  type="text"
                  value={trainingName}
                  onChange={(e) => setTrainingName(e.target.value)}
                  placeholder="e.g. Moving & Handling, First Aid…"
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            )}

            {/* File */}
            <div>
              <label htmlFor="doc-file" className="block text-xs font-medium text-gray-700 mb-1">
                File <span className="text-red-500">*</span>
                <span className="ml-1 font-normal text-gray-400">(PDF, JPG, PNG, DOC, DOCX — max 10 MB)</span>
              </label>
              <input
                id="doc-file"
                data-testid="doc-upload-file"
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
              />
            </div>

            {/* Expiry date */}
            <div>
              <label htmlFor="expiry-date" className="block text-xs font-medium text-gray-700 mb-1">
                Expiry date <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                id="expiry-date"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                data-testid="doc-upload-submit"
                disabled={isPending}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {isPending ? 'Uploading…' : 'Upload'}
              </button>
              <button
                type="button"
                onClick={reset}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Clear
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
