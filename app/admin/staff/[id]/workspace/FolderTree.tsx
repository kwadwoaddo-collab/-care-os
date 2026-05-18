'use client'

import type { WorkspaceFolder } from './types'
import { folderDocCounts } from './helpers'

interface Props {
  folders:         WorkspaceFolder[]
  unclassified:    number
  selectedSlug:    string | null
  onSelect:        (slug: string | null) => void
  staffProfileId:  string
}

function CountBadge({ n, cls }: { n: number; cls: string }) {
  if (n === 0) return null
  return (
    <span className={`shrink-0 text-[10px] font-semibold rounded-full px-1.5 py-0.5 min-w-[18px] text-center tabular-nums ${cls}`}>
      {n}
    </span>
  )
}

function FolderRow({ folder, selected, onClick }: {
  folder:   WorkspaceFolder
  selected: boolean
  onClick:  () => void
}) {
  const counts = folderDocCounts(folder.documents)
  const hasIssue = counts.expired > 0 || counts.rejected > 0 || counts.pending > 0

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all group ${
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
  )
}

export default function FolderTree({ folders, unclassified, selectedSlug, onSelect, staffProfileId }: Props) {
  const allCount  = folders.reduce((s, f) => s + f.documents.length, 0) + unclassified
  const allPending = folders.reduce((s, f) => s + folderDocCounts(f.documents).pending, 0)
  const allExpired = folders.reduce((s, f) => s + folderDocCounts(f.documents).expired, 0)

  return (
    <nav
      className="flex flex-col gap-0.5"
      aria-label="Document folders"
    >
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

      {/* Divider */}
      <div className="border-t border-gray-100 my-1" role="separator" />

      {/* System folders */}
      {folders
        .filter((f) => f.slug !== 'archive')
        .map((folder) => (
          <FolderRow
            key={folder.id}
            folder={folder}
            selected={selectedSlug === folder.slug}
            onClick={() => onSelect(folder.slug)}
          />
        ))}

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
      {(() => {
        const archive = folders.find((f) => f.slug === 'archive')
        if (!archive || archive.documents.length === 0) return null
        return (
          <>
            <div className="border-t border-gray-100 my-1" role="separator" />
            <FolderRow
              folder={archive}
              selected={selectedSlug === 'archive'}
              onClick={() => onSelect('archive')}
            />
          </>
        )
      })()}

      {/* Quick links */}
      <div className="border-t border-gray-100 mt-2 pt-2 space-y-0.5">
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
  )
}
