'use client'

import { useState, useRef, useEffect } from 'react'
import type { WorkspaceFolder } from './types'
import { folderDocCounts } from './helpers'

interface Props {
  folders:         WorkspaceFolder[]
  unclassified:    number
  selectedSlug:    string | null
  onSelect:        (slug: string | null) => void
  staffProfileId:  string
  companyId:       string
  onFoldersChange: () => void   // called after folder CRUD so parent can reload
}

function CountBadge({ n, cls }: { n: number; cls: string }) {
  if (n === 0) return null
  return (
    <span className={`shrink-0 text-[10px] font-semibold rounded-full px-1.5 py-0.5 min-w-[18px] text-center tabular-nums ${cls}`}>
      {n}
    </span>
  )
}

// ── Custom folder context menu ─────────────────────────────────────────────────

function FolderMenu({
  folder,
  companyId,
  onRename,
  onArchive,
}: {
  folder:    WorkspaceFolder
  companyId: string
  onRename:  (newName: string) => Promise<void>
  onArchive: () => Promise<void>
}) {
  const [open, setOpen]         = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName]   = useState(folder.name)
  const [loading, setLoading]   = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleRename = async () => {
    if (!newName.trim() || newName === folder.name) { setRenaming(false); return }
    setLoading(true)
    await onRename(newName.trim())
    setLoading(false)
    setRenaming(false)
    setOpen(false)
  }

  const handleArchive = async () => {
    if (!confirm(`Archive folder "${folder.name}"? Its documents will be moved to unclassified.`)) return
    setLoading(true)
    await onArchive()
    setLoading(false)
    setOpen(false)
  }

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 rounded hover:bg-white/20 transition-all"
        aria-label="Folder options"
        title="Folder options"
      >
        <span className="material-symbols-outlined text-[13px]">more_vert</span>
      </button>

      {open && !renaming && (
        <div className="absolute right-0 top-6 z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 w-36 text-xs">
          <button
            onClick={(e) => { e.stopPropagation(); setRenaming(true); setOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-gray-700"
          >
            <span className="material-symbols-outlined text-[13px]">edit</span>
            Rename
          </button>
          <div className="border-t border-gray-100 my-0.5" />
          <button
            onClick={(e) => { e.stopPropagation(); void handleArchive() }}
            disabled={loading}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-red-50 text-red-600 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[13px]">archive</span>
            Archive folder
          </button>
        </div>
      )}

      {renaming && (
        <div
          className="absolute right-0 top-6 z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-3 w-52 text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-gray-500 mb-1.5 font-medium">Rename folder</p>
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter')  void handleRename()
              if (e.key === 'Escape') { setRenaming(false); setOpen(false) }
            }}
            className="w-full border border-gray-300 rounded px-2 py-1 text-xs mb-2 focus:outline-none focus:border-indigo-400"
            maxLength={80}
          />
          <div className="flex gap-1.5">
            <button
              onClick={() => void handleRename()}
              disabled={loading}
              className="flex-1 bg-indigo-600 text-white rounded px-2 py-1 hover:bg-indigo-700 disabled:opacity-50 text-xs font-medium"
            >
              {loading ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => { setRenaming(false); setOpen(false) }}
              className="flex-1 border border-gray-300 rounded px-2 py-1 hover:bg-gray-50 text-gray-600 text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── New folder dialog ─────────────────────────────────────────────────────────

function NewFolderDialog({
  companyId,
  onCreated,
  onClose,
}: {
  companyId: string
  onCreated: () => void
  onClose:   () => void
}) {
  const [name, setName]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const handleCreate = async () => {
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/admin/documents/folders', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: name.trim() }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok) { setError(json.error ?? 'Failed to create folder'); return }
      onCreated()
      onClose()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-xl p-5 w-80">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">New document folder</h3>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate(); if (e.key === 'Escape') onClose() }}
          placeholder="Folder name"
          maxLength={80}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-1 focus:outline-none focus:border-indigo-500"
        />
        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
        <p className="text-xs text-gray-400 mb-3">Cannot use the same name as a system folder.</p>
        <div className="flex gap-2">
          <button
            onClick={() => void handleCreate()}
            disabled={loading || !name.trim()}
            className="flex-1 bg-indigo-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating…' : 'Create folder'}
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

// ── FolderRow ─────────────────────────────────────────────────────────────────

function FolderRow({ folder, selected, onClick, companyId, onFoldersChange }: {
  folder:          WorkspaceFolder
  selected:        boolean
  onClick:         () => void
  companyId:       string
  onFoldersChange: () => void
}) {
  const counts   = folderDocCounts(folder.documents)
  const hasIssue = counts.expired > 0 || counts.rejected > 0 || counts.pending > 0

  const handleRename = async (newName: string) => {
    await fetch(`/api/admin/documents/folders/${folder.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name: newName }),
    })
    onFoldersChange()
  }

  const handleArchive = async () => {
    await fetch(`/api/admin/documents/folders/${folder.id}`, { method: 'DELETE' })
    onFoldersChange()
  }

  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${
          selected
            ? 'bg-indigo-600 text-white shadow-sm'
            : hasIssue
              ? 'text-gray-700 hover:bg-amber-50 hover:text-gray-900'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
        aria-pressed={selected}
        aria-label={`${folder.name} — ${counts.total} documents`}
      >
        <span
          className={`material-symbols-outlined text-[16px] shrink-0 ${selected ? 'text-white' : ''}`}
          style={selected ? {} : { color: folder.colour ?? '#6B7280' }}
          aria-hidden="true"
        >
          {folder.icon ?? 'folder'}
        </span>

        <span className="flex-1 min-w-0 text-xs font-medium truncate">{folder.name}</span>

        {/* System folder lock indicator */}
        {folder.is_system && (
          <span
            className={`material-symbols-outlined text-[11px] shrink-0 ${selected ? 'text-white/60' : 'text-gray-300'}`}
            title="System folder — cannot be renamed or archived"
            aria-label="Protected system folder"
          >
            lock
          </span>
        )}

        {/* Counts */}
        <div className="flex items-center gap-1 shrink-0">
          {counts.expired > 0 && (
            <CountBadge n={counts.expired}
              cls={selected ? 'bg-white/25 text-white' : 'bg-red-100 text-red-700'} />
          )}
          {counts.pending > 0 && (
            <CountBadge n={counts.pending}
              cls={selected ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-700'} />
          )}
          <CountBadge n={counts.total}
            cls={selected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'} />
        </div>
      </button>

      {/* Custom folder menu */}
      {folder.is_custom && (
        <div className={`absolute right-2 top-1/2 -translate-y-1/2 ${selected ? 'text-white' : 'text-gray-500'}`}>
          <FolderMenu
            folder={folder}
            companyId={companyId}
            onRename={handleRename}
            onArchive={handleArchive}
          />
        </div>
      )}
    </div>
  )
}

// ── FolderTree ────────────────────────────────────────────────────────────────

export default function FolderTree({ folders, unclassified, selectedSlug, onSelect, staffProfileId, companyId, onFoldersChange }: Props) {
  const [showNewFolder, setShowNewFolder] = useState(false)

  const systemFolders = folders.filter((f) => f.is_system && f.slug !== 'archive')
  const customFolders = folders.filter((f) => f.is_custom)
  const archiveFolder = folders.find((f) => f.slug === 'archive')

  const allCount   = folders.reduce((s, f) => s + f.documents.length, 0) + unclassified
  const allPending = folders.reduce((s, f) => s + folderDocCounts(f.documents).pending, 0)
  const allExpired = folders.reduce((s, f) => s + folderDocCounts(f.documents).expired, 0)

  return (
    <>
      <nav className="flex flex-col gap-0.5" aria-label="Document folders">
        {/* All documents */}
        <button
          onClick={() => onSelect(null)}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${
            selectedSlug === null
              ? 'bg-gray-900 text-white shadow-sm'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
          aria-pressed={selectedSlug === null}
        >
          <span className="material-symbols-outlined text-[16px] shrink-0" aria-hidden="true">grid_view</span>
          <span className="flex-1 text-xs font-semibold">All documents</span>
          <div className="flex items-center gap-1">
            {allExpired > 0 && (
              <CountBadge n={allExpired}
                cls={selectedSlug === null ? 'bg-white/20 text-white' : 'bg-red-100 text-red-700'} />
            )}
            {allPending > 0 && (
              <CountBadge n={allPending}
                cls={selectedSlug === null ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'} />
            )}
            <CountBadge n={allCount}
              cls={selectedSlug === null ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'} />
          </div>
        </button>

        <div className="border-t border-gray-100 my-1" role="separator" />

        {/* System folders */}
        {systemFolders.map((folder) => (
          <FolderRow
            key={folder.id}
            folder={folder}
            selected={selectedSlug === folder.slug}
            onClick={() => onSelect(folder.slug)}
            companyId={companyId}
            onFoldersChange={onFoldersChange}
          />
        ))}

        {/* Custom folders section */}
        {customFolders.length > 0 && (
          <>
            <div className="border-t border-gray-100 my-1" role="separator" />
            <p className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              Custom
            </p>
            {customFolders.map((folder) => (
              <FolderRow
                key={folder.id}
                folder={folder}
                selected={selectedSlug === folder.slug}
                onClick={() => onSelect(folder.slug)}
                companyId={companyId}
                onFoldersChange={onFoldersChange}
              />
            ))}
          </>
        )}

        {/* Unclassified */}
        {unclassified > 0 && (
          <>
            <div className="border-t border-gray-100 my-1" role="separator" />
            <button
              onClick={() => onSelect('__unclassified')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all ${
                selectedSlug === '__unclassified'
                  ? 'bg-amber-600 text-white'
                  : 'text-amber-700 bg-amber-50 hover:bg-amber-100'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">help</span>
              <span className="flex-1 text-xs font-medium">Unclassified</span>
              <CountBadge n={unclassified}
                cls={selectedSlug === '__unclassified' ? 'bg-white/25 text-white' : 'bg-amber-200 text-amber-900'} />
            </button>
          </>
        )}

        {/* Archive folder */}
        {archiveFolder && archiveFolder.documents.length > 0 && (
          <>
            <div className="border-t border-gray-100 my-1" role="separator" />
            <FolderRow
              folder={archiveFolder}
              selected={selectedSlug === 'archive'}
              onClick={() => onSelect('archive')}
              companyId={companyId}
              onFoldersChange={onFoldersChange}
            />
          </>
        )}

        {/* New folder button */}
        <div className="border-t border-gray-100 mt-1 pt-1">
          <button
            onClick={() => setShowNewFolder(true)}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors font-medium"
          >
            <span className="material-symbols-outlined text-[14px]">create_new_folder</span>
            New folder
          </button>
        </div>

        {/* Quick links */}
        <div className="border-t border-gray-100 mt-1 pt-1 space-y-0.5">
          <a
            href="/admin/documents/verification"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">fact_check</span>
            Verification queue
          </a>
          <a
            href="/admin/documents/routing"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">route</span>
            Routing review
          </a>
        </div>
      </nav>

      {showNewFolder && (
        <NewFolderDialog
          companyId={companyId}
          onCreated={onFoldersChange}
          onClose={() => setShowNewFolder(false)}
        />
      )}
    </>
  )
}
