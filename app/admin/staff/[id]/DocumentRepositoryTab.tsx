'use client'

import { useState, useCallback, useRef } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RepoFolder {
  id:          string
  name:        string
  slug:        string
  sort_order:  number
  icon:        string | null
  colour:      string | null
  description: string | null
  documents:   RepoDocument[]
}

export interface RepoDocument {
  id:                     string
  document_type:          string
  file_name:              string
  file_path:              string | null
  file_size:              number | null
  mime_type:              string | null
  expiry_date:            string | null
  issue_date:             string | null
  created_at:             string
  reviewed_status:        string | null
  review_status:          string | null
  source_stage:           string | null
  worker_visible:         boolean
  visibility:             string
  compliance_linked:      boolean
  archived_at:            string | null
  version_group_id:       string | null
  requires_manual_review: boolean
  original_filename:      string | null
  applicant_id:           string | null
  staff_profile_id:       string | null
  folder_id:              string | null
  signed_url?:            string | null
}

interface Props {
  staffProfileId: string
  companyId:      string
  folders:        RepoFolder[]
  unclassified:   RepoDocument[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  applicant:         'Uploaded during application',
  onboarding:        'Uploaded during onboarding',
  staff:             'Staff upload',
  admin_upload:      'Admin upload',
  worker_upload:     'Worker portal upload',
  compliance_review: 'Compliance review',
  operations_upload: 'Operations upload',
}

const VISIBILITY_CLS: Record<string, string> = {
  worker_visible:  'bg-green-100 text-green-800 ring-green-600/20',
  management_only: 'bg-yellow-100 text-yellow-900 ring-yellow-600/20',
  compliance_only: 'bg-violet-100 text-violet-800 ring-violet-600/20',
  confidential:    'bg-red-100 text-red-800 ring-red-600/20',
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fileSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function isExpired(iso: string | null): boolean {
  return !!iso && new Date(iso) < new Date()
}

function isExpiringSoon(iso: string | null): boolean {
  if (!iso) return false
  const e = new Date(iso)
  const w = new Date(); w.setDate(w.getDate() + 30)
  return e > new Date() && e <= w
}

// ── Expiry badge ──────────────────────────────────────────────────────────────

function ExpiryBadge({ date }: { date: string | null }) {
  if (!date) return <span className="text-xs text-gray-400">No expiry</span>
  if (isExpired(date)) {
    return (
      <span className="flex items-center gap-1 text-xs font-semibold text-red-700">
        <span className="material-symbols-outlined text-[12px]">warning</span>
        Expired {fmt(date)}
      </span>
    )
  }
  if (isExpiringSoon(date)) {
    return (
      <span className="flex items-center gap-1 text-xs font-semibold text-yellow-700">
        <span className="material-symbols-outlined text-[12px]">schedule</span>
        Exp: {fmt(date)}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-xs text-green-700">
      <span className="material-symbols-outlined text-[12px]">check_circle</span>
      Exp: {fmt(date)}
    </span>
  )
}

// ── Source badge ──────────────────────────────────────────────────────────────

function SourceBadge({ stage }: { stage: string | null }) {
  if (!stage) return null
  const label = SOURCE_LABELS[stage] ?? stage.replace(/_/g, ' ')
  const isApplicant = stage === 'applicant' || stage === 'onboarding'
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ring-1 ring-inset ${isApplicant ? 'bg-indigo-50 text-indigo-700 ring-indigo-500/20' : 'bg-gray-100 text-gray-600 ring-gray-400/20'}`}>
      <span className="material-symbols-outlined text-[10px]">{isApplicant ? 'person' : 'badge'}</span>
      {label}
    </span>
  )
}

// ── Visibility badge ──────────────────────────────────────────────────────────

function VisibilityBadge({ visibility }: { visibility: string }) {
  const cls   = VISIBILITY_CLS[visibility] ?? 'bg-gray-100 text-gray-700 ring-gray-400/20'
  const label = visibility.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  return (
    <span className={`inline-flex text-[10px] font-semibold uppercase tracking-wide rounded-md px-1.5 py-0.5 ring-1 ring-inset ${cls}`}>
      {label}
    </span>
  )
}

// ── Document card ─────────────────────────────────────────────────────────────

function DocumentCard({ doc, staffProfileId, onArchived }: {
  doc:            RepoDocument
  staffProfileId: string
  onArchived:     (id: string) => void
}) {
  const [archiving, setArchiving] = useState(false)
  const needsAttention = isExpired(doc.expiry_date) || isExpiringSoon(doc.expiry_date)
    || doc.reviewed_status === 'rejected' || doc.requires_manual_review

  const archive = useCallback(async () => {
    setArchiving(true)
    try {
      await fetch(`/api/admin/documents/archive`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ documentId: doc.id }),
      })
      onArchived(doc.id)
    } finally {
      setArchiving(false)
    }
  }, [doc.id, onArchived])

  return (
    <div className={`rounded-lg border bg-surface-container-lowest p-3.5 hover:shadow-sm transition-all ${needsAttention ? 'border-amber-200' : 'border-gray-100 hover:border-gray-200'}`}>
      {/* File name + actions */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <span className="material-symbols-outlined text-[16px] text-gray-400 shrink-0 mt-0.5">description</span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate leading-tight" title={doc.file_name}>
              {doc.file_name}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {doc.document_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              {doc.file_size ? ` · ${fileSize(doc.file_size)}` : ''}
            </p>
          </div>
        </div>
        {doc.signed_url && (
          <div className="flex items-center gap-1 shrink-0">
            <a href={doc.signed_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors"
              aria-label={`View ${doc.file_name}`}>
              <span className="material-symbols-outlined text-[12px]">visibility</span>
              View
            </a>
            <a href={doc.signed_url} download={doc.file_name}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors"
              aria-label={`Download ${doc.file_name}`}>
              <span className="material-symbols-outlined text-[12px]">download</span>
              DL
            </a>
          </div>
        )}
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <SourceBadge stage={doc.source_stage} />
        <VisibilityBadge visibility={doc.visibility} />
        <ExpiryBadge date={doc.expiry_date} />
        {doc.compliance_linked && (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-violet-700 bg-violet-50 rounded-full px-2 py-0.5 ring-1 ring-inset ring-violet-500/20 uppercase tracking-wide">
            <span className="material-symbols-outlined text-[10px]">verified</span>
            Compliance
          </span>
        )}
      </div>

      {/* Upload date + archive */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
        <span className="text-[11px] text-gray-400">
          <span className="material-symbols-outlined text-[11px] align-text-bottom">upload</span>{' '}
          {fmt(doc.created_at)}
        </span>
        <button
          onClick={archive}
          disabled={archiving}
          className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-red-600 transition-colors disabled:opacity-40"
          aria-label={`Archive ${doc.file_name}`}
        >
          <span className="material-symbols-outlined text-[12px]">archive</span>
          {archiving ? '…' : 'Archive'}
        </button>
      </div>
    </div>
  )
}

// ── Upload drop zone ──────────────────────────────────────────────────────────

function UploadZone({ folderId, folderSlug, staffProfileId, onUploaded }: {
  folderId:       string
  folderSlug:     string
  staffProfileId: string
  onUploaded:     () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging]   = useState(false)
  const [docType, setDocType]     = useState('')

  const upload = useCallback(async (file: File) => {
    if (!docType) {
      alert('Please select a document type before uploading.')
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('documentType', docType)
      fd.append('staffProfileId', staffProfileId)
      fd.append('folderSlug', folderSlug)
      fd.append('sourceStage', 'admin_upload')
      await fetch('/api/admin/staff/documents/upload', { method: 'POST', body: fd })
      onUploaded()
    } finally {
      setUploading(false)
    }
  }, [docType, staffProfileId, folderSlug, onUploaded])

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2 mb-2">
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="text-xs rounded-md border border-gray-300 px-2 py-1 bg-surface-container-lowest text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-1"
        >
          <option value="">Select document type…</option>
          <option value="passport">Passport</option>
          <option value="brp">BRP</option>
          <option value="right_to_work">Right to Work</option>
          <option value="dbs">DBS Certificate</option>
          <option value="safeguarding_certificate">Safeguarding Certificate</option>
          <option value="contract">Contract</option>
          <option value="policy_acknowledgement">Policy Acknowledgement</option>
          <option value="training_certificate">Training Certificate</option>
          <option value="manual_handling_certificate">Manual Handling Certificate</option>
          <option value="fire_safety_certificate">Fire Safety Certificate</option>
          <option value="first_aid_certificate">First Aid Certificate</option>
          <option value="vaccination">Vaccination Record</option>
          <option value="fit_note">Fit Note</option>
          <option value="return_to_work">Return to Work Form</option>
          <option value="supervision">Supervision Record</option>
          <option value="appraisal">Appraisal</option>
          <option value="spot_check">Spot Check</option>
          <option value="other">Other</option>
        </select>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 border border-indigo-600 transition-colors disabled:opacity-40"
        >
          {uploading ? (
            <span className="material-symbols-outlined text-[13px] animate-spin">progress_activity</span>
          ) : (
            <span className="material-symbols-outlined text-[13px]">upload_file</span>
          )}
          Upload
        </button>
      </div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragging(false)
          const f = e.dataTransfer.files[0]
          if (f) upload(f)
        }}
        className={`rounded-lg border-2 border-dashed py-4 flex flex-col items-center gap-1 transition-colors cursor-pointer text-center ${dragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300'}`}
        onClick={() => inputRef.current?.click()}
        role="button"
        aria-label="Drop file here or click to upload"
      >
        <span className="material-symbols-outlined text-[22px] text-gray-400">cloud_upload</span>
        <p className="text-xs text-gray-400">Drop file here or click to browse</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) upload(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

// ── Folder panel ──────────────────────────────────────────────────────────────

function FolderPanel({ folder, staffProfileId }: {
  folder:         RepoFolder
  staffProfileId: string
}) {
  const [open,     setOpen]     = useState(false)
  const [docs,     setDocs]     = useState<RepoDocument[]>(folder.documents)
  const [showUpload, setUpload] = useState(false)

  const expiredCount  = docs.filter((d) => isExpired(d.expiry_date)).length
  const expiringCount = docs.filter((d) => isExpiringSoon(d.expiry_date)).length

  const onArchived = useCallback((id: string) => {
    setDocs((prev) => prev.filter((d) => d.id !== id))
  }, [])

  return (
    <div className="rounded-xl border border-gray-200 bg-surface-container-lowest overflow-hidden shadow-sm">
      {/* Folder header */}
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100 hover:bg-gray-100 transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="material-symbols-outlined text-[18px]"
            style={{ color: folder.colour ?? '#6B7280' }}
            aria-hidden="true"
          >
            {folder.icon ?? 'folder'}
          </span>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-800">{folder.name}</p>
            {folder.description && (
              <p className="text-[11px] text-gray-400">{folder.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {expiredCount > 0 && (
            <span className="text-[10px] font-semibold text-red-700 bg-red-100 rounded-full px-1.5 py-0.5 ring-1 ring-inset ring-red-500/20">
              {expiredCount} expired
            </span>
          )}
          {expiringCount > 0 && (
            <span className="text-[10px] font-semibold text-yellow-700 bg-yellow-100 rounded-full px-1.5 py-0.5 ring-1 ring-inset ring-yellow-500/20">
              {expiringCount} expiring
            </span>
          )}
          <span className="text-xs font-medium text-gray-500 bg-gray-200 rounded-full px-2 py-0.5">
            {docs.length}
          </span>
          <span className={`material-symbols-outlined text-[16px] text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        </div>
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {/* Document grid */}
          {docs.length === 0 ? (
            <p className="text-xs text-gray-400 italic text-center py-2">No documents in this folder</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {docs.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  doc={doc}
                  staffProfileId={staffProfileId}
                  onArchived={onArchived}
                />
              ))}
            </div>
          )}

          {/* Upload toggle */}
          <div>
            <button
              onClick={() => setUpload((p) => !p)}
              className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-900 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">
                {showUpload ? 'remove' : 'add'}
              </span>
              {showUpload ? 'Cancel upload' : 'Upload to this folder'}
            </button>
            {showUpload && (
              <UploadZone
                folderId={folder.id}
                folderSlug={folder.slug}
                staffProfileId={staffProfileId}
                onUploaded={() => setUpload(false)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Search + filter bar ───────────────────────────────────────────────────────

type FilterMode = 'all' | 'expiring' | 'expired' | 'compliance' | 'pending'

function filterDocs(docs: RepoDocument[], mode: FilterMode): RepoDocument[] {
  switch (mode) {
    case 'expiring':   return docs.filter((d) => isExpiringSoon(d.expiry_date))
    case 'expired':    return docs.filter((d) => isExpired(d.expiry_date))
    case 'compliance': return docs.filter((d) => d.compliance_linked)
    case 'pending':    return docs.filter((d) => d.requires_manual_review)
    default:           return docs
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DocumentRepositoryTab({ staffProfileId, companyId, folders, unclassified }: Props) {
  const [search,    setSearch]  = useState('')
  const [filterMode, setFilter] = useState<FilterMode>('all')
  const [expandAll, setExpandAll] = useState(false)

  const allDocs   = folders.flatMap((f) => f.documents).concat(unclassified)
  const totalDocs = allDocs.length
  const expiredCount  = allDocs.filter((d) => isExpired(d.expiry_date)).length
  const expiringCount = allDocs.filter((d) => isExpiringSoon(d.expiry_date)).length
  const pendingCount  = allDocs.filter((d) => d.requires_manual_review).length

  // Filter folders by search (simple filename/type match)
  const searchLower = search.toLowerCase()
  const filteredFolders = folders.map((f) => ({
    ...f,
    documents: searchLower
      ? f.documents.filter((d) =>
          d.file_name.toLowerCase().includes(searchLower) ||
          d.document_type.toLowerCase().includes(searchLower)
        )
      : filterDocs(f.documents, filterMode),
  })).filter((f) => f.documents.length > 0 || !searchLower)

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-surface-container-lowest rounded-xl border border-gray-200 px-4 py-3 text-center shadow-sm">
          <p className="text-2xl font-bold text-gray-900 tabular-nums">{totalDocs}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total documents</p>
        </div>
        <div className={`bg-surface-container-lowest rounded-xl border px-4 py-3 text-center shadow-sm ${expiredCount > 0 ? 'border-red-200' : 'border-gray-200'}`}>
          <p className={`text-2xl font-bold tabular-nums ${expiredCount > 0 ? 'text-red-700' : 'text-gray-900'}`}>{expiredCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Expired</p>
        </div>
        <div className={`bg-surface-container-lowest rounded-xl border px-4 py-3 text-center shadow-sm ${expiringCount > 0 ? 'border-yellow-200' : 'border-gray-200'}`}>
          <p className={`text-2xl font-bold tabular-nums ${expiringCount > 0 ? 'text-yellow-700' : 'text-gray-900'}`}>{expiringCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Expiring soon</p>
        </div>
        <div className={`bg-surface-container-lowest rounded-xl border px-4 py-3 text-center shadow-sm ${pendingCount > 0 ? 'border-amber-200' : 'border-gray-200'}`}>
          <p className={`text-2xl font-bold tabular-nums ${pendingCount > 0 ? 'text-amber-700' : 'text-gray-900'}`}>{pendingCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Pending review</p>
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex flex-wrap items-center gap-3 bg-surface-container-lowest rounded-xl border border-gray-200 px-4 py-3 shadow-sm">
        <div className="relative flex-1 min-w-[180px]">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[14px] text-gray-400">search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents…"
            className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-1">
          {(['all', 'expiring', 'expired', 'compliance', 'pending'] as FilterMode[]).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setSearch('') }}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${filterMode === f && !search ? 'bg-gray-800 text-white' : 'text-gray-600 bg-gray-100 hover:bg-gray-200'}`}
            >
              {f === 'all' ? 'All' : f === 'expiring' ? 'Expiring' : f === 'expired' ? 'Expired' : f === 'compliance' ? 'Compliance' : 'Pending'}
            </button>
          ))}
        </div>
        <button
          onClick={() => setExpandAll((p) => !p)}
          className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          <span className="material-symbols-outlined text-[14px]">{expandAll ? 'unfold_less' : 'unfold_more'}</span>
          {expandAll ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      {/* Folder tree */}
      <div className="space-y-3">
        {filteredFolders.map((folder) => (
          <FolderPanel
            key={folder.id}
            folder={folder}
            staffProfileId={staffProfileId}
          />
        ))}
      </div>

      {/* Unclassified documents */}
      {unclassified.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-200 flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-600 text-[18px]">help</span>
            <h3 className="text-sm font-semibold text-amber-800">
              Unclassified documents ({unclassified.length})
            </h3>
          </div>
          <div className="p-4">
            <p className="text-xs text-amber-700 mb-3">
              These documents could not be automatically routed. Classify them via the{' '}
              <a href="/admin/documents/routing" className="underline font-semibold hover:text-amber-900">
                routing review screen
              </a>.
            </p>
            <div className="space-y-2">
              {unclassified.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-surface-container-lowest px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{doc.file_name}</p>
                    <p className="text-[11px] text-gray-400">{doc.document_type.replace(/_/g, ' ')} · {fmt(doc.created_at)}</p>
                  </div>
                  <a
                    href="/admin/documents/routing"
                    className="text-xs font-semibold text-amber-700 hover:text-amber-900 transition-colors whitespace-nowrap"
                  >
                    Classify →
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {totalDocs === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <span className="material-symbols-outlined text-[40px] text-gray-300">folder_off</span>
          <div>
            <p className="text-sm font-medium text-gray-600">No documents yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Expand a folder above to upload the first document for this staff member.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
