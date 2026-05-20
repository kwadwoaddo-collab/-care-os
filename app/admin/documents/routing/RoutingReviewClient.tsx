'use client'

import { useState, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Diagnostics {
  total:               number
  autoRouted:          number
  pendingReview:       number
  unrecognised:        number
  manuallyClassified:  number
  complianceLinked:    number
}

interface DocRow {
  id:             string
  document_type:  string
  file_name:      string
  original_filename: string | null
  mime_type:      string | null
  source_stage:   string | null
  review_status:  string | null
  requires_manual_review: boolean
  created_at:     string
  applicant_id:   string | null
  staff_profile_id: string | null
  folder_id:      string | null
  staff_document_folders: { id: string; name: string; slug: string } | null
}

interface Folder {
  id:   string
  name: string
  slug: string
}

interface Props {
  diagnostics: Diagnostics
  pending:     DocRow[]
  unrecognised: DocRow[]
  folders:     Folder[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CLS: Record<string, string> = {
  auto_routed:          'bg-green-100 text-green-800 ring-green-600/20',
  pending_review:       'bg-yellow-100 text-yellow-900 ring-yellow-600/20',
  manually_classified:  'bg-blue-100 text-blue-800 ring-blue-600/20',
  unrecognised:         'bg-red-100 text-red-800 ring-red-600/20',
  compliance_linked:    'bg-violet-100 text-violet-800 ring-violet-600/20',
  archived:             'bg-gray-100 text-gray-600 ring-gray-500/20',
}

const SOURCE_LABELS: Record<string, string> = {
  applicant:          'Application',
  onboarding:         'Onboarding',
  staff:              'Staff upload',
  admin_upload:       'Admin upload',
  worker_upload:      'Worker portal',
  compliance_review:  'Compliance review',
  operations_upload:  'Operations',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, colour }: { label: string; value: number; icon: string; colour: string }) {
  return (
    <div className={`rounded-xl border bg-surface-container-lowest p-4 flex items-start gap-3 shadow-sm ${colour}`}>
      <span className="material-symbols-outlined text-[22px] mt-0.5" aria-hidden="true">{icon}</span>
      <div>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

// ── Document row in review table ──────────────────────────────────────────────

function ReviewRow({
  doc,
  folders,
  onClassified,
}: {
  doc: DocRow
  folders: Folder[]
  onClassified: (docId: string, folderId: string, folderName: string) => void
}) {
  const [selectedSlug, setSelectedSlug] = useState('')
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState<string | null>(null)

  const classify = useCallback(async () => {
    if (!selectedSlug) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/documents/classify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ documentId: doc.id, folderSlug: selectedSlug }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed')
      onClassified(doc.id, json.folder.id, json.folder.name)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }, [doc.id, selectedSlug, onClassified])

  const status = doc.review_status ?? 'pending_review'
  const cls    = STATUS_CLS[status] ?? 'bg-gray-100 text-gray-700 ring-gray-400/20'

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate max-w-[220px]" title={doc.file_name}>
          {doc.file_name}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {doc.document_type.replace(/_/g, ' ')}
        </p>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {doc.source_stage && (
          <span className="text-xs font-medium text-gray-600 bg-gray-100 rounded-full px-2 py-0.5">
            {SOURCE_LABELS[doc.source_stage] ?? doc.source_stage}
          </span>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={`inline-flex items-center text-[10px] font-semibold uppercase tracking-wide rounded-md px-2 py-0.5 ring-1 ring-inset ${cls}`}>
          {status.replace(/_/g, ' ')}
        </span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {doc.staff_document_folders ? (
          <span className="text-xs text-gray-700">{doc.staff_document_folders.name}</span>
        ) : (
          <span className="text-xs text-gray-400 italic">Unassigned</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmt(doc.created_at)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <select
            value={selectedSlug}
            onChange={(e) => setSelectedSlug(e.target.value)}
            className="text-xs rounded-md border border-gray-300 px-2 py-1 bg-surface-container-lowest text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label={`Select folder for ${doc.file_name}`}
          >
            <option value="">— Move to folder —</option>
            {folders.map((f) => (
              <option key={f.id} value={f.slug}>{f.name}</option>
            ))}
          </select>
          <button
            onClick={classify}
            disabled={!selectedSlug || saving}
            className="flex items-center gap-1 px-3 py-1 rounded-md text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors disabled:opacity-40"
          >
            {saving ? (
              <span className="material-symbols-outlined text-[12px] animate-spin">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-[12px]">check</span>
            )}
            Apply
          </button>
        </div>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </td>
    </tr>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RoutingReviewClient({ diagnostics, pending, unrecognised, folders }: Props) {
  const [docs, setDocs]           = useState<DocRow[]>(pending)
  const [batchRunning, setBatch]  = useState(false)
  const [batchResult, setBatchResult] = useState<{ routed: number; unrecognised: number } | null>(null)
  const [filter, setFilter]       = useState<'all' | 'unrecognised' | 'pending'>('all')

  const handleClassified = useCallback((docId: string, folderId: string, folderName: string) => {
    setDocs((prev) =>
      prev.map((d) =>
        d.id === docId
          ? { ...d, folder_id: folderId, review_status: 'manually_classified', requires_manual_review: false,
              staff_document_folders: { id: folderId, name: folderName, slug: '' } }
          : d
      )
    )
  }, [])

  const runBatchRoute = useCallback(async () => {
    setBatch(true)
    try {
      const res = await fetch('/api/admin/documents/route-document', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ mode: 'batch' }),
      })
      const json = await res.json()
      setBatchResult({ routed: json.routed, unrecognised: json.unrecognised })
    } finally {
      setBatch(false)
    }
  }, [])

  const filtered = docs.filter((d) => {
    if (filter === 'unrecognised') return d.review_status === 'unrecognised'
    if (filter === 'pending')      return d.requires_manual_review
    return true
  })

  return (
    <div className="space-y-6">
      {/* Diagnostics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total documents"   value={diagnostics.total}              icon="folder" colour="text-gray-700 border-gray-200" />
        <StatCard label="Auto-routed"       value={diagnostics.autoRouted}         icon="check_circle" colour="text-green-700 border-green-200" />
        <StatCard label="Pending review"    value={diagnostics.pendingReview}      icon="hourglass_empty" colour="text-yellow-700 border-yellow-200" />
        <StatCard label="Unrecognised"      value={diagnostics.unrecognised}       icon="help" colour="text-red-700 border-red-200" />
        <StatCard label="Manual classified" value={diagnostics.manuallyClassified} icon="edit" colour="text-blue-700 border-blue-200" />
        <StatCard label="Compliance linked" value={diagnostics.complianceLinked}   icon="verified" colour="text-violet-700 border-violet-200" />
      </div>

      {/* Batch action + filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-container-lowest rounded-xl border border-gray-200 px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">Routing actions</span>
          <button
            onClick={runBatchRoute}
            disabled={batchRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors disabled:opacity-40"
          >
            {batchRunning ? (
              <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-[14px]">route</span>
            )}
            Run auto-routing
          </button>
          {batchResult && (
            <span className="text-xs text-gray-600">
              Routed {batchResult.routed}, unrecognised {batchResult.unrecognised}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {(['all', 'pending', 'unrecognised'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                filter === f
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? 'All' : f === 'pending' ? 'Pending review' : 'Unrecognised'}
            </button>
          ))}
        </div>
      </div>

      {/* Unrecognised docs alert */}
      {unrecognised.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <span className="material-symbols-outlined text-red-600 text-[20px] mt-0.5" aria-hidden="true">warning</span>
          <div>
            <p className="text-sm font-semibold text-red-800">
              {unrecognised.length} unrecognised document type{unrecognised.length !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              These documents could not be automatically classified. Use the table below to assign them to a folder manually.
            </p>
          </div>
        </div>
      )}

      {/* Review table */}
      <div className="bg-surface-container-lowest rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 px-4 py-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-gray-500 text-[18px]" aria-hidden="true">table</span>
          <h2 className="text-sm font-semibold text-gray-700">
            Document routing queue
            <span className="ml-2 text-xs font-normal text-gray-400">({filtered.length} shown)</span>
          </h2>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <span className="material-symbols-outlined text-[36px] text-gray-300">done_all</span>
            <p className="text-sm font-medium text-gray-500">All documents are classified</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Document</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Source</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Current folder</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Uploaded</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc) => (
                  <ReviewRow
                    key={doc.id}
                    doc={doc}
                    folders={folders}
                    onClassified={handleClassified}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
