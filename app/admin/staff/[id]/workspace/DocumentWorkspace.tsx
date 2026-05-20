'use client'

import { useState, useCallback, useMemo, useRef } from 'react'
import type { WorkspaceFolder, WorkspaceDocument, ViewMode, FilterKey } from './types'
import { applyFilters, folderDocCounts, SOURCE_LABELS } from './helpers'
import FolderTree from './FolderTree'
import DocumentTable from './DocumentTable'
import PreviewDrawer from './PreviewDrawer'
import ReadinessPanel from './ReadinessPanel'
import VerificationDrawer, { type DrawerMode, type DrawerDocument } from '../../../documents/verification/VerificationDrawer'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  staffProfileId: string
  companyId:      string
  folders:        WorkspaceFolder[]
  unclassified:   WorkspaceDocument[]
}

// ── Bulk actions bar ──────────────────────────────────────────────────────────

function BulkBar({ count, onApprove, onArchive, onClear, loading }: {
  count:     number
  onApprove: () => void
  onArchive: () => void
  onClear:   () => void
  loading:   boolean
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-lg bg-indigo-700 text-white px-4 py-2.5 shadow-md"
      role="status"
      aria-live="polite"
    >
      <span className="text-sm font-semibold">
        {count} document{count !== 1 ? 's' : ''} selected
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={onApprove}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-surface-container-lowest text-indigo-700 hover:bg-indigo-50 transition-colors disabled:opacity-50"
        >
          {loading
            ? <span className="material-symbols-outlined text-[13px] animate-spin">progress_activity</span>
            : <span className="material-symbols-outlined text-[13px]">check_circle</span>}
          Bulk approve
        </button>
        <button
          onClick={onArchive}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 transition-colors disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[13px]">archive</span>
          Archive
        </button>
        <button onClick={onClear} className="text-indigo-200 hover:text-white text-xs transition-colors">
          Clear
        </button>
      </div>
    </div>
  )
}

// ── Upload zone ───────────────────────────────────────────────────────────────

function UploadButton({ folderId, folderSlug, staffProfileId }: {
  folderId:       string
  folderSlug:     string
  staffProfileId: string
}) {
  const [docType, setDocType] = useState('')
  const [uploading, setUploading] = useState(false)
  const [showForm, setShowForm]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const upload = useCallback(async (file: File) => {
    if (!docType) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file); fd.append('documentType', docType)
      fd.append('staffProfileId', staffProfileId)
      fd.append('folderSlug', folderSlug); fd.append('sourceStage', 'admin_upload')
      await fetch('/api/admin/staff/' + staffProfileId + '/documents/upload', { method: 'POST', body: fd })
      setShowForm(false)
    } finally { setUploading(false) }
  }, [docType, staffProfileId, folderSlug])

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors"
      >
        <span className="material-symbols-outlined text-[14px]">upload_file</span>
        Upload
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <select value={docType} onChange={(e) => setDocType(e.target.value)}
        className="text-xs rounded-lg border border-gray-300 px-2 py-1.5 bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-indigo-500">
        <option value="">Type…</option>
        <option value="application_form">Application Form</option>
        <option value="cv">CV / Résumé</option>
        <option value="passport">Passport</option>
        <option value="brp">BRP</option>
        <option value="right_to_work">Right to Work</option>
        <option value="dbs">DBS Certificate</option>
        <option value="safeguarding_certificate">Safeguarding</option>
        <option value="contract">Contract</option>
        <option value="training_certificate">Training Certificate</option>
        <option value="manual_handling_certificate">Manual Handling</option>
        <option value="fire_safety_certificate">Fire Safety</option>
        <option value="vaccination">Vaccination</option>
        <option value="fit_note">Fit Note</option>
        <option value="supervision">Supervision Record</option>
        <option value="appraisal">Appraisal</option>
        <option value="other">Other</option>
      </select>
      <button onClick={() => inputRef.current?.click()} disabled={!docType || uploading}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-40">
        {uploading
          ? <span className="material-symbols-outlined text-[13px] animate-spin">progress_activity</span>
          : <span className="material-symbols-outlined text-[13px]">upload</span>}
        {uploading ? 'Uploading…' : 'Choose file'}
      </button>
      <button onClick={() => setShowForm(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
      <input ref={inputRef} type="file" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
    </div>
  )
}

// ── Move document dialog ──────────────────────────────────────────────────────

function MoveDocumentDialog({
  doc,
  folders,
  onMove,
  onClose,
}: {
  doc:     WorkspaceDocument
  folders: WorkspaceFolder[]
  onMove:  (folderId: string | null) => Promise<void>
  onClose: () => void
}) {
  const [targetId, setTargetId] = useState<string>('')
  const [loading, setLoading]   = useState(false)

  const handleMove = async () => {
    setLoading(true)
    await onMove(targetId || null)
    setLoading(false)
    onClose()
  }

  const visibleFolders = folders.filter((f) => f.slug !== 'archive')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-surface-container-lowest rounded-xl shadow-xl p-5 w-80">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Move document</h3>
        <p className="text-xs text-gray-500 mb-3 truncate">{doc.file_name}</p>
        <select
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-indigo-500 bg-surface-container-lowest"
        >
          <option value="">Unclassified</option>
          {visibleFolders.map((f) => (
            <option key={f.id} value={f.id} disabled={f.id === doc.folder_id}>
              {f.name}{f.is_system ? ' 🔒' : ''}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button
            onClick={() => void handleMove()}
            disabled={loading || targetId === doc.folder_id}
            className="flex-1 bg-indigo-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Moving…' : 'Move'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Permanent delete confirmation ─────────────────────────────────────────────

function DeleteConfirmDialog({
  doc,
  onDelete,
  onClose,
}: {
  doc:      WorkspaceDocument
  onDelete: () => Promise<void>
  onClose:  () => void
}) {
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    await onDelete()
    setLoading(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-surface-container-lowest rounded-xl shadow-xl p-5 w-80 border border-red-200">
        <div className="flex items-center gap-2 mb-2">
          <span className="material-symbols-outlined text-red-600 text-[22px]">delete_forever</span>
          <h3 className="text-sm font-semibold text-gray-900">Permanently delete document?</h3>
        </div>
        <p className="text-xs text-gray-500 mb-1">
          <span className="font-medium text-gray-700">{doc.file_name}</span> will be permanently removed.
        </p>
        <p className="text-xs text-red-600 mb-4">
          This action cannot be undone. The file will be removed from storage and the record deleted.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => void handleDelete()}
            disabled={loading}
            className="flex-1 bg-red-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Deleting…' : 'Delete permanently'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DocumentWorkspace({ staffProfileId, companyId, folders, unclassified }: Props) {
  // ── Local state ─────────────────────────────────────────────────────────────
  const [selectedFolder, setFolder] = useState<string | null>(null)
  const [viewMode, setView]         = useState<ViewMode>('table')
  const [selectedIds, setSelected]  = useState<Set<string>>(new Set())
  const [previewDoc, setPreview]    = useState<WorkspaceDocument | null>(null)
  const [sidebarOpen, setSidebar]   = useState(true)
  const [bulkLoading, setBulkLoad]  = useState(false)

  // Filters
  const [status,      setStatus]      = useState<FilterKey>('all')
  const [sourceStage, setSource]      = useState('')
  const [search,      setSearch]      = useState('')

  // Verification drawer
  const [vDrawerOpen, setVOpen]   = useState(false)
  const [vDrawerMode, setVMode]   = useState<DrawerMode>('approve')
  const [vDrawerDoc,  setVDoc]    = useState<DrawerDocument | null>(null)

  // Move and delete dialogs
  const [moveDoc,   setMoveDoc]   = useState<WorkspaceDocument | null>(null)
  const [deleteDoc, setDeleteDoc] = useState<WorkspaceDocument | null>(null)

  // Live documents state (enables optimistic updates)
  const [liveFolders,      setLiveFolders]      = useState<WorkspaceFolder[]>(folders)
  const [liveUnclassified, setLiveUnclassified] = useState<WorkspaceDocument[]>(unclassified)

  // ── Derived data ─────────────────────────────────────────────────────────────

  const allDocs: WorkspaceDocument[] = useMemo(
    () => liveFolders.flatMap((f) => f.documents).concat(liveUnclassified),
    [liveFolders, liveUnclassified]
  )

  const currentFolderObj = useMemo(
    () => liveFolders.find((f) => f.slug === selectedFolder) ?? null,
    [liveFolders, selectedFolder]
  )

  const sourceDocs: WorkspaceDocument[] = useMemo(() => {
    if (selectedFolder === null)              return allDocs
    if (selectedFolder === '__unclassified')  return liveUnclassified
    if (currentFolderObj)                     return currentFolderObj.documents
    return []
  }, [selectedFolder, allDocs, liveUnclassified, currentFolderObj])

  const filteredDocs = useMemo(
    () => applyFilters(sourceDocs, { status, sourceStage, expiryRisk: 'all', workerVisible: null, search }),
    [sourceDocs, status, sourceStage, search]
  )

  const counts = useMemo(() => folderDocCounts(allDocs), [allDocs])

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleSelect = useCallback((id: string, _multi: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const handleSelectAll = useCallback((checked: boolean) => {
    setSelected(checked ? new Set(filteredDocs.map((d) => d.id)) : new Set())
  }, [filteredDocs])

  const updateDocStatus = useCallback((docId: string, newStatus: string) => {
    setLiveFolders((prev) => prev.map((f) => ({
      ...f,
      documents: f.documents.map((d) =>
        d.id === docId ? { ...d, verification_status: newStatus, reviewed_status: newStatus === 'approved' ? 'approved' : d.reviewed_status } : d
      ),
    })))
    setLiveUnclassified((prev) => prev.map((d) =>
      d.id === docId ? { ...d, verification_status: newStatus } : d
    ))
  }, [])

  const removeDoc = useCallback((docId: string) => {
    setLiveFolders((prev) => prev.map((f) => ({
      ...f, documents: f.documents.filter((d) => d.id !== docId),
    })))
    setLiveUnclassified((prev) => prev.filter((d) => d.id !== docId))
    setPreview((p) => p?.id === docId ? null : p)
  }, [])

  const openVerificationDrawer = useCallback((action: 'verify' | 'approve' | 'reject' | 'resubmission' | 'archive' | 'move' | 'delete', docId: string) => {
    const doc = allDocs.find((d) => d.id === docId)

    if (action === 'archive') {
      fetch('/api/admin/documents/archive', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId }),
      }).then(() => removeDoc(docId))
      return
    }

    if (action === 'move') {
      if (doc) setMoveDoc(doc)
      return
    }

    if (action === 'delete') {
      if (doc) setDeleteDoc(doc)
      return
    }

    if (!doc) return
    setVDoc(doc as unknown as DrawerDocument)
    setVMode(action as DrawerMode)
    setVOpen(true)
  }, [allDocs, removeDoc])

  const handleMoveDoc = useCallback(async (targetFolderId: string | null) => {
    if (!moveDoc) return
    await fetch('/api/admin/documents/move', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ documentId: moveDoc.id, folderId: targetFolderId }),
    })
    // Optimistic: remove from current location, will reload on next page visit
    removeDoc(moveDoc.id)
    setMoveDoc(null)
  }, [moveDoc, removeDoc])

  const handleDeleteDoc = useCallback(async () => {
    if (!deleteDoc) return
    await fetch('/api/admin/documents/delete', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ documentId: deleteDoc.id, confirm: true, deleteFromStorage: true }),
    })
    removeDoc(deleteDoc.id)
    setDeleteDoc(null)
  }, [deleteDoc, removeDoc])

  const handleBulkApprove = useCallback(async () => {
    if (selectedIds.size === 0) return
    setBulkLoad(true)
    try {
      await fetch('/api/admin/documents/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds: Array.from(selectedIds), action: 'approve' }),
      })
      for (const id of selectedIds) updateDocStatus(id, 'approved')
      setSelected(new Set())
    } finally { setBulkLoad(false) }
  }, [selectedIds, updateDocStatus])

  const handleBulkArchive = useCallback(async () => {
    if (selectedIds.size === 0) return
    setBulkLoad(true)
    try {
      await fetch('/api/admin/documents/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds: Array.from(selectedIds), action: 'archive' }),
      })
      for (const id of selectedIds) removeDoc(id)
      setSelected(new Set())
    } finally { setBulkLoad(false) }
  }, [selectedIds, removeDoc])

  // Reload page when folders change (server-rendered data)
  const handleFoldersChange = useCallback(() => {
    window.location.reload()
  }, [])

  const currentFolderId   = currentFolderObj?.id ?? liveFolders[0]?.id ?? ''
  const currentFolderSlug = currentFolderObj?.slug ?? liveFolders[0]?.slug ?? 'training-certs'

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-0 h-full min-h-0 -mx-0">
      {/* Readiness panel */}
      <div className="mb-4">
        <ReadinessPanel staffProfileId={staffProfileId} />
      </div>

      {/* Workspace summary strip */}
      <div className="flex flex-wrap items-center gap-3 px-0 pb-3">
        <div className="flex items-center gap-3">
          <div className="text-center">
            <p className="text-xl font-bold text-gray-900 tabular-nums">{counts.total}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Total</p>
          </div>
          {counts.expired > 0 && (
            <div className="text-center">
              <p className="text-xl font-bold text-red-700 tabular-nums">{counts.expired}</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Expired</p>
            </div>
          )}
          {counts.pending > 0 && (
            <div className="text-center">
              <p className="text-xl font-bold text-amber-700 tabular-nums">{counts.pending}</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Pending</p>
            </div>
          )}
        </div>
      </div>

      {/* Main 3-column layout */}
      <div className="flex gap-0 border border-gray-200 rounded-xl overflow-hidden bg-surface-container-lowest shadow-sm" style={{ minHeight: 520 }}>

        {/* Left: Folder tree */}
        <aside
          className={`${sidebarOpen ? 'w-52' : 'w-0'} shrink-0 border-r border-gray-200 overflow-y-auto overflow-x-hidden transition-all duration-200 bg-gray-50`}
          aria-label="Folder navigation"
        >
          <div className="p-3">
            <FolderTree
              folders={liveFolders}
              unclassified={liveUnclassified.length}
              selectedSlug={selectedFolder}
              onSelect={setFolder}
              staffProfileId={staffProfileId}
              companyId={companyId}
              onFoldersChange={handleFoldersChange}
            />
          </div>
        </aside>

        {/* Centre: Document list */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Toolbar */}
          <div className="border-b border-gray-200 px-4 py-2.5 flex flex-wrap items-center gap-2 bg-surface-container-lowest shrink-0">
            {/* Sidebar toggle */}
            <button
              onClick={() => setSidebar((p) => !p)}
              className="text-gray-400 hover:text-gray-700 transition-colors"
              aria-label={sidebarOpen ? 'Hide folder tree' : 'Show folder tree'}
            >
              <span className="material-symbols-outlined text-[18px]">
                {sidebarOpen ? 'menu_open' : 'menu'}
              </span>
            </button>

            {/* Folder name */}
            <span className="text-xs font-semibold text-gray-700">
              {selectedFolder === null ? 'All documents'
                : selectedFolder === '__unclassified' ? 'Unclassified'
                : currentFolderObj?.name ?? selectedFolder}
            </span>

            <span className="text-xs text-gray-400">({filteredDocs.length})</span>

            {/* Search */}
            <div className="relative ml-auto">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 material-symbols-outlined text-[13px] text-gray-400">search</span>
              <input
                type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="pl-6 pr-3 py-1 text-xs rounded-lg border border-gray-300 bg-surface-container-lowest w-36 focus:w-48 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>

            {/* Status filter */}
            <select value={status} onChange={(e) => setStatus(e.target.value as FilterKey)}
              className="text-xs rounded-lg border border-gray-300 px-2 py-1 bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="all">All status</option>
              <option value="pending_verification">Pending</option>
              <option value="verified">Verified</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="expiring">Expiring</option>
              <option value="expired">Expired</option>
              <option value="compliance_linked">Compliance</option>
              <option value="worker_visible">Worker visible</option>
              <option value="resubmission">Resubmission</option>
            </select>

            {/* Source filter */}
            <select value={sourceStage} onChange={(e) => setSource(e.target.value)}
              className="text-xs rounded-lg border border-gray-300 px-2 py-1 bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-indigo-500 hidden sm:block">
              <option value="">All sources</option>
              {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>

            {/* View toggle */}
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              <button
                onClick={() => setView('table')}
                className={`px-2 py-1 text-[11px] transition-colors ${viewMode === 'table' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                aria-pressed={viewMode === 'table'}
                aria-label="Table view"
              >
                <span className="material-symbols-outlined text-[14px]">table_rows</span>
              </button>
              <button
                onClick={() => setView('grid')}
                className={`px-2 py-1 text-[11px] transition-colors ${viewMode === 'grid' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                aria-pressed={viewMode === 'grid'}
                aria-label="Grid view"
              >
                <span className="material-symbols-outlined text-[14px]">grid_view</span>
              </button>
            </div>

            {/* Upload */}
            {selectedFolder !== null && selectedFolder !== '__unclassified' && currentFolderObj && (
              <UploadButton
                folderId={currentFolderId}
                folderSlug={currentFolderSlug}
                staffProfileId={staffProfileId}
              />
            )}
          </div>

          {/* Bulk bar */}
          {selectedIds.size > 0 && (
            <div className="px-4 py-2 border-b border-gray-100 bg-indigo-50">
              <BulkBar
                count={selectedIds.size}
                onApprove={handleBulkApprove}
                onArchive={handleBulkArchive}
                onClear={() => setSelected(new Set())}
                loading={bulkLoading}
              />
            </div>
          )}

          {/* Document list */}
          <div className="flex-1 overflow-y-auto">
            {viewMode === 'table' ? (
              <DocumentTable
                documents={filteredDocs}
                selectedIds={selectedIds}
                onSelect={handleSelect}
                onSelectAll={handleSelectAll}
                onPreview={setPreview}
                onQuickAction={openVerificationDrawer}
                staffProfileId={staffProfileId}
              />
            ) : (
              /* Grid view */
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredDocs.length === 0 ? (
                  <div className="col-span-2 flex flex-col items-center gap-2 py-10 text-center">
                    <span className="material-symbols-outlined text-[36px] text-gray-300">folder_off</span>
                    <p className="text-sm text-gray-400">No documents</p>
                  </div>
                ) : filteredDocs.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => setPreview(doc)}
                    className={`text-left rounded-xl border p-3 hover:shadow-sm transition-all ${
                      selectedIds.has(doc.id) ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-surface-container-lowest hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-[18px] text-gray-400 mt-0.5 shrink-0">description</span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">{doc.file_name}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{doc.document_type.replace(/_/g, ' ')}</p>
                        {doc.source_label && (
                          <p className="text-[10px] text-indigo-500 mt-0.5 italic">{doc.source_label}</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Preview drawer */}
        {previewDoc && (
          <div className="w-80 lg:w-96 shrink-0 border-l border-gray-200 flex flex-col overflow-hidden">
            <PreviewDrawer
              doc={previewDoc}
              onClose={() => setPreview(null)}
              onAction={openVerificationDrawer}
              onStatusChange={updateDocStatus}
            />
          </div>
        )}
      </div>

      {/* Verification action drawer */}
      <VerificationDrawer
        open={vDrawerOpen}
        onClose={() => setVOpen(false)}
        mode={vDrawerMode}
        doc={vDrawerDoc}
        onSuccess={(docId, newStatus) => {
          updateDocStatus(docId, newStatus)
          setVOpen(false)
        }}
      />

      {/* Move document dialog */}
      {moveDoc && (
        <MoveDocumentDialog
          doc={moveDoc}
          folders={liveFolders}
          onMove={handleMoveDoc}
          onClose={() => setMoveDoc(null)}
        />
      )}

      {/* Delete confirmation dialog */}
      {deleteDoc && (
        <DeleteConfirmDialog
          doc={deleteDoc}
          onDelete={handleDeleteDoc}
          onClose={() => setDeleteDoc(null)}
        />
      )}
    </div>
  )
}
