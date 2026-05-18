'use client'

import type { WorkspaceDocument } from './types'
import {
  fmt, fmtSize, docTypeLabel, isExpired, isExpiringSoon,
  VERIFICATION_STATUS_MAP, SOURCE_LABELS,
} from './helpers'

interface Props {
  documents:      WorkspaceDocument[]
  selectedIds:    Set<string>
  onSelect:       (id: string, multi: boolean) => void
  onSelectAll:    (checked: boolean) => void
  onPreview:      (doc: WorkspaceDocument) => void
  onQuickAction:  (action: 'verify' | 'approve' | 'reject' | 'resubmission' | 'archive', docId: string) => void
  staffProfileId: string
}

// ── Cells ─────────────────────────────────────────────────────────────────────

function VBadge({ status }: { status: string | null }) {
  if (!status) return null
  const info = VERIFICATION_STATUS_MAP[status]
  if (!info) return null
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 ring-1 ring-inset ${info.cls}`}>
      <span className="material-symbols-outlined text-[10px]">{info.icon}</span>
      {info.label}
    </span>
  )
}

function ExpiryCell({ date }: { date: string | null }) {
  if (!date) return <span className="text-xs text-gray-300">—</span>
  const expired  = isExpired(date)
  const expiring = isExpiringSoon(date)
  return (
    <span className={`text-xs ${expired ? 'text-red-700 font-semibold' : expiring ? 'text-yellow-700 font-medium' : 'text-gray-600'}`}>
      {expired ? '⚠ ' : expiring ? '⏰ ' : ''}{fmt(date)}
    </span>
  )
}

// ── Row ───────────────────────────────────────────────────────────────────────

function DocRow({ doc, selected, onSelect, onPreview, onQuickAction, staffProfileId }: {
  doc:            WorkspaceDocument
  selected:       boolean
  onSelect:       (id: string, multi: boolean) => void
  onPreview:      (doc: WorkspaceDocument) => void
  onQuickAction:  (action: 'verify' | 'approve' | 'reject' | 'resubmission' | 'archive', docId: string) => void
  staffProfileId: string
}) {
  const vs = doc.verification_status ?? 'pending_verification'
  const needsAttention = isExpired(doc.expiry_date) || isExpiringSoon(doc.expiry_date)
    || vs === 'rejected' || vs === 'pending_verification'

  return (
    <tr
      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${
        selected ? 'bg-indigo-50' : needsAttention ? 'bg-amber-50/30' : ''
      }`}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-no-row-click]')) return
        onPreview(doc)
      }}
      aria-selected={selected}
    >
      {/* Checkbox */}
      <td className="px-3 py-2.5 w-8" data-no-row-click>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onSelect(doc.id, false)}
          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          aria-label={`Select ${doc.file_name}`}
          onClick={(e) => e.stopPropagation()}
        />
      </td>

      {/* File name + type */}
      <td className="px-3 py-2.5 min-w-0 max-w-[220px]">
        <div className="flex items-start gap-2">
          <span className="material-symbols-outlined text-[15px] text-gray-400 shrink-0 mt-0.5" aria-hidden="true">description</span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate leading-tight" title={doc.file_name}>
              {doc.file_name}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">{docTypeLabel(doc.document_type)}</p>
          </div>
        </div>
      </td>

      {/* Verification status */}
      <td className="px-3 py-2.5 whitespace-nowrap">
        <VBadge status={vs} />
        {doc.resubmission_requested && (
          <span className="ml-1 text-[10px] text-amber-700 bg-amber-50 rounded px-1 ring-1 ring-inset ring-amber-400/20">
            Resubmit
          </span>
        )}
      </td>

      {/* Source */}
      <td className="px-3 py-2.5 whitespace-nowrap hidden sm:table-cell">
        {doc.source_stage && (
          <span className="text-[11px] text-gray-500 bg-gray-100 rounded-full px-1.5 py-0.5">
            {SOURCE_LABELS[doc.source_stage] ?? doc.source_stage}
          </span>
        )}
      </td>

      {/* Expiry */}
      <td className="px-3 py-2.5 whitespace-nowrap hidden md:table-cell">
        <ExpiryCell date={doc.expiry_date} />
      </td>

      {/* Size */}
      <td className="px-3 py-2.5 whitespace-nowrap hidden lg:table-cell">
        <span className="text-[11px] text-gray-400">{fmtSize(doc.file_size)}</span>
      </td>

      {/* Uploaded */}
      <td className="px-3 py-2.5 whitespace-nowrap hidden md:table-cell">
        <span className="text-[11px] text-gray-500">{fmt(doc.created_at)}</span>
      </td>

      {/* Quick actions */}
      <td className="px-3 py-2.5 whitespace-nowrap" data-no-row-click>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {vs === 'pending_verification' && (
            <button
              onClick={(e) => { e.stopPropagation(); onQuickAction('approve', doc.id) }}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 transition-colors"
              aria-label={`Approve ${doc.file_name}`}
            >
              <span className="material-symbols-outlined text-[10px]">check</span>
              Approve
            </button>
          )}
          {vs !== 'approved' && vs !== 'pending_verification' && (
            <button
              onClick={(e) => { e.stopPropagation(); onQuickAction('approve', doc.id) }}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 transition-colors"
              aria-label={`Approve ${doc.file_name}`}
            >
              <span className="material-symbols-outlined text-[10px]">check</span>
              Approve
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onQuickAction('reject', doc.id) }}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors"
            aria-label={`Reject ${doc.file_name}`}
          >
            <span className="material-symbols-outlined text-[10px]">close</span>
            Reject
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Table ─────────────────────────────────────────────────────────────────────

export default function DocumentTable({
  documents, selectedIds, onSelect, onSelectAll, onPreview, onQuickAction, staffProfileId,
}: Props) {
  const allSelected = documents.length > 0 && documents.every((d) => selectedIds.has(d.id))

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center" role="status">
        <span className="material-symbols-outlined text-[36px] text-gray-300">folder_off</span>
        <p className="text-sm font-medium text-gray-500">No documents match your filters</p>
        <p className="text-xs text-gray-400">Try adjusting the filters or selecting a different folder.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto -mx-0">
      <table className="w-full text-sm group" aria-label="Documents">
        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
          <tr>
            <th className="px-3 py-2.5 w-8">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => onSelectAll(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                aria-label="Select all documents"
              />
            </th>
            <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Document</th>
            <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
            <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Source</th>
            <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Expiry</th>
            <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Size</th>
            <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Uploaded</th>
            <th className="px-3 py-2.5 w-24">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {documents.map((doc) => (
            <DocRow
              key={doc.id}
              doc={doc}
              selected={selectedIds.has(doc.id)}
              onSelect={onSelect}
              onPreview={onPreview}
              onQuickAction={onQuickAction}
              staffProfileId={staffProfileId}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
