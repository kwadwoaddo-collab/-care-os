'use client'

import { useState, useCallback, useEffect } from 'react'
import type { WorkspaceDocument } from './types'
import {
  fmt, fmtSize, docTypeLabel, isExpired, isExpiringSoon,
  VERIFICATION_STATUS_MAP, SOURCE_LABELS,
} from './helpers'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuditEntry {
  id:             string
  event:          string
  actor_type:     string | null
  actor_label:    string | null
  previous_value: Record<string, unknown> | null
  new_value:      Record<string, unknown> | null
  created_at:     string
}

interface Props {
  doc:            WorkspaceDocument | null
  onClose:        () => void
  onAction:       (action: 'verify' | 'approve' | 'reject' | 'resubmission' | 'archive' | 'move' | 'delete', docId: string) => void
  onStatusChange: (docId: string, newStatus: string) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const EVENT_ICONS: Record<string, string> = {
  uploaded:               'upload',
  routed:                 'route',
  manually_classified:    'edit',
  visibility_changed:     'visibility',
  conversion_linked:      'link',
  expiry_updated:         'event',
  compliance_linked:      'verified',
  viewed:                 'visibility',
  downloaded:             'download',
  approved:               'check_circle',
  rejected:               'cancel',
  archived:               'archive',
  unarchived:             'unarchive',
  version_replaced:       'history',
  deleted:                'delete',
}

const EVENT_LABEL: Record<string, string> = {
  uploaded:             'Uploaded',
  routed:               'Routed to folder',
  manually_classified:  'Manually classified',
  visibility_changed:   'Visibility changed',
  conversion_linked:    'Linked to staff profile',
  expiry_updated:       'Expiry updated',
  compliance_linked:    'Linked to compliance',
  viewed:               'Viewed',
  downloaded:           'Downloaded',
  approved:             'Approved',
  rejected:             'Rejected',
  archived:             'Archived',
  unarchived:           'Restored from archive',
  version_replaced:     'Version replaced',
  deleted:              'Deleted',
}

// ── Sub-panels ────────────────────────────────────────────────────────────────

function MetadataRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-[11px] text-gray-400 w-28 shrink-0">{label}</span>
      <span className="text-[11px] text-gray-700 flex-1 break-words">{value}</span>
    </div>
  )
}

function VerificationBadge({ status }: { status: string | null }) {
  if (!status) return null
  const { cls, icon, label } = VERIFICATION_STATUS_MAP[status] ?? { cls: 'bg-gray-100 text-gray-600 ring-gray-400/20', icon: 'help', label: status }
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide rounded-md px-2 py-0.5 ring-1 ring-inset ${cls}`}>
      <span className="material-symbols-outlined text-[10px]">{icon}</span>
      {label}
    </span>
  )
}

function AuditTimeline({ documentId }: { documentId: string }) {
  const [history, setHistory]   = useState<AuditEntry[] | null>(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/documents/${documentId}/audit-history`)
      .then((r) => r.json())
      .then((j) => setHistory(j.history ?? []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false))
  }, [documentId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-xs text-gray-400">
        <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
        Loading history…
      </div>
    )
  }

  if (!history || history.length === 0) {
    return <p className="text-xs text-gray-400 py-3">No audit history recorded yet.</p>
  }

  return (
    <ol className="relative border-l border-gray-200 ml-2 space-y-0" aria-label="Document audit history">
      {history.map((entry) => {
        const icon  = EVENT_ICONS[entry.event] ?? 'info'
        const label = EVENT_LABEL[entry.event] ?? entry.event.replace(/_/g, ' ')
        const isPositive = entry.event === 'approved' || entry.event === 'uploaded' || entry.event === 'version_replaced'
        const isNegative = entry.event === 'rejected' || entry.event === 'deleted'

        return (
          <li key={entry.id} className="relative pl-5 pb-4">
            <span
              className={`absolute left-[-9px] top-1 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-white ${
                isPositive ? 'bg-green-500' : isNegative ? 'bg-red-500' : 'bg-gray-300'
              }`}
              aria-hidden="true"
            >
              <span className="material-symbols-outlined text-white text-[10px]">{icon}</span>
            </span>
            <div>
              <p className="text-xs font-medium text-gray-800">{label}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {entry.actor_label || entry.actor_type || 'System'}
                {' · '}
                {fmt(entry.created_at)}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function DocumentPreview({ doc }: { doc: WorkspaceDocument }) {
  const [previewUrl, setUrl]  = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  useEffect(() => {
    setLoading(true); setError(false); setUrl(null)
    fetch(`/api/admin/documents/${doc.id}/preview-url`)
      .then((r) => r.json())
      .then((j) => setUrl(j.url ?? null))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [doc.id])

  const isPdf   = doc.mime_type === 'application/pdf' || doc.file_name.endsWith('.pdf')
  const isImage = doc.mime_type?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.file_name)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 bg-gray-50 rounded-lg">
        <span className="material-symbols-outlined text-[28px] text-gray-300 animate-spin">progress_activity</span>
      </div>
    )
  }

  if (error || !previewUrl) {
    return (
      <div className="flex flex-col items-center gap-2 h-40 bg-gray-50 rounded-lg justify-center">
        <span className="material-symbols-outlined text-[28px] text-gray-300">description</span>
        <p className="text-xs text-gray-400">Preview not available</p>
        {doc.file_path && (
          <a href={`/api/admin/documents/download?path=${encodeURIComponent(doc.file_path)}`}
            target="_blank" rel="noopener noreferrer"
            className="text-xs text-indigo-600 hover:underline font-semibold">
            Download to view →
          </a>
        )}
      </div>
    )
  }

  if (isPdf) {
    return (
      <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
        <iframe
          src={previewUrl}
          title={`Preview: ${doc.file_name}`}
          className="w-full h-80 border-0"
          aria-label={`PDF preview of ${doc.file_name}`}
        />
      </div>
    )
  }

  if (isImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={previewUrl}
        alt={`Preview of ${doc.file_name}`}
        className="w-full max-h-80 object-contain rounded-lg border border-gray-200 bg-gray-50"
      />
    )
  }

  return (
    <div className="flex flex-col items-center gap-2 h-40 bg-gray-50 rounded-lg justify-center">
      <span className="material-symbols-outlined text-[28px] text-gray-400">description</span>
      <p className="text-xs text-gray-500 font-medium">{doc.file_name}</p>
      <a href={previewUrl} target="_blank" rel="noopener noreferrer"
        className="text-xs text-indigo-600 hover:underline font-semibold">
        Open in new tab →
      </a>
    </div>
  )
}

// ── Main drawer ───────────────────────────────────────────────────────────────

type ActiveTab = 'preview' | 'metadata' | 'history'

export default function PreviewDrawer({ doc, onClose, onAction, onStatusChange }: Props) {
  const [tab, setTab] = useState<ActiveTab>('preview')

  useEffect(() => {
    if (doc) setTab('preview')
  }, [doc?.id])

  if (!doc) return null

  const vs = doc.verification_status ?? 'pending_verification'
  const expiredFlag  = isExpired(doc.expiry_date)
  const expiringFlag = isExpiringSoon(doc.expiry_date)

  return (
    <>
      {/* Scrim */}
      <div
        className="fixed inset-0 bg-black/10 z-30 lg:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className="flex flex-col bg-surface-container-lowest border-l border-gray-200 h-full overflow-hidden"
        style={{ minWidth: 0 }}
        aria-label={`Document details: ${doc.file_name}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 border-b border-gray-200 px-4 py-3 shrink-0">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate leading-tight" title={doc.file_name}>
              {doc.file_name}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">{docTypeLabel(doc.document_type)}</p>
          </div>
          <button onClick={onClose} className="shrink-0 text-gray-400 hover:text-gray-700 transition-colors" aria-label="Close preview">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Status strip */}
        <div className="border-b border-gray-100 bg-gray-50 px-4 py-2.5 flex flex-wrap items-center gap-1.5 shrink-0">
          <VerificationBadge status={vs} />
          {expiredFlag && (
            <span className="text-[10px] font-semibold text-red-700 bg-red-100 rounded px-1.5 py-0.5 ring-1 ring-inset ring-red-500/20">
              Expired {fmt(doc.expiry_date)}
            </span>
          )}
          {expiringFlag && !expiredFlag && (
            <span className="text-[10px] font-semibold text-yellow-700 bg-yellow-100 rounded px-1.5 py-0.5 ring-1 ring-inset ring-yellow-500/20">
              Expiring {fmt(doc.expiry_date)}
            </span>
          )}
          {doc.original_seen && (
            <span className="text-[10px] text-blue-700 bg-blue-50 rounded px-1.5 py-0.5 ring-1 ring-inset ring-blue-400/20 flex items-center gap-1">
              <span className="material-symbols-outlined text-[10px]">visibility</span>
              Original seen
            </span>
          )}
          {doc.compliance_linked && (
            <span className="text-[10px] text-violet-700 bg-violet-50 rounded px-1.5 py-0.5 ring-1 ring-inset ring-violet-400/20 flex items-center gap-1">
              <span className="material-symbols-outlined text-[10px]">verified</span>
              Compliance
            </span>
          )}
          {doc.worker_visible && (
            <span className="text-[10px] text-green-700 bg-green-50 rounded px-1.5 py-0.5 ring-1 ring-inset ring-green-400/20 flex items-center gap-1">
              <span className="material-symbols-outlined text-[10px]">badge</span>
              Worker visible
            </span>
          )}
        </div>

        {/* Quick actions */}
        <div className="border-b border-gray-100 px-4 py-2 flex flex-wrap gap-1.5 shrink-0">
          {vs === 'pending_verification' && (
            <button onClick={() => onAction('verify', doc.id)}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors">
              <span className="material-symbols-outlined text-[11px]">verified_user</span>
              Verify
            </button>
          )}
          {(vs === 'pending_verification' || vs === 'verified') && (
            <button onClick={() => onAction('approve', doc.id)}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 transition-colors">
              <span className="material-symbols-outlined text-[11px]">check_circle</span>
              Approve
            </button>
          )}
          {vs !== 'approved' && (
            <button onClick={() => onAction('reject', doc.id)}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors">
              <span className="material-symbols-outlined text-[11px]">cancel</span>
              Reject
            </button>
          )}
          <button onClick={() => onAction('resubmission', doc.id)}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors">
            <span className="material-symbols-outlined text-[11px]">refresh</span>
            Resubmit
          </button>
          {doc.file_path && (
            <a href={`/api/admin/documents/download?path=${encodeURIComponent(doc.file_path)}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors">
              <span className="material-symbols-outlined text-[11px]">download</span>
              Download
            </a>
          )}
          <button onClick={() => onAction('move', doc.id)}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors">
            <span className="material-symbols-outlined text-[11px]">drive_file_move</span>
            Move
          </button>
          <button onClick={() => onAction('archive', doc.id)}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-gray-400 hover:text-amber-700 hover:bg-amber-50 border border-gray-200 hover:border-amber-200 transition-colors">
            <span className="material-symbols-outlined text-[11px]">archive</span>
            Archive
          </button>
          {doc.archived_at && (
            <button onClick={() => onAction('delete', doc.id)}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-red-400 hover:text-red-700 hover:bg-red-50 border border-red-100 hover:border-red-300 transition-colors">
              <span className="material-symbols-outlined text-[11px]">delete_forever</span>
              Delete
            </button>
          )}
        </div>

        {/* Tab bar */}
        <div className="border-b border-gray-100 flex shrink-0">
          {(['preview', 'metadata', 'history'] as ActiveTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-[11px] font-semibold uppercase tracking-wide transition-colors border-b-2 ${
                tab === t
                  ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {t === 'preview' ? 'Preview' : t === 'metadata' ? 'Info' : 'History'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'preview' && (
            <div className="p-4">
              <DocumentPreview doc={doc} />
            </div>
          )}

          {tab === 'metadata' && (
            <div className="px-4 py-3 space-y-0">
              <MetadataRow label="Document type"   value={docTypeLabel(doc.document_type)} />
              <MetadataRow label="File name"       value={doc.file_name} />
              <MetadataRow label="File size"       value={fmtSize(doc.file_size)} />
              <MetadataRow label="MIME type"       value={doc.mime_type} />
              <MetadataRow label="Uploaded"        value={fmt(doc.created_at)} />
              <MetadataRow label="Source"          value={doc.source_stage ? SOURCE_LABELS[doc.source_stage] ?? doc.source_stage : undefined} />
              <MetadataRow label="Expiry date"     value={doc.expiry_date ? (
                <span className={expiredFlag ? 'text-red-700 font-semibold' : expiringFlag ? 'text-yellow-700 font-semibold' : ''}>
                  {fmt(doc.expiry_date)}
                </span>
              ) : undefined} />
              <MetadataRow label="Issue date"      value={fmt(doc.issue_date)} />
              {doc.verification_status !== 'pending_verification' && <>
                <MetadataRow label="Verified by"   value={doc.verified_by} />
                <MetadataRow label="Verified at"   value={fmt(doc.verified_at)} />
                <MetadataRow label="Method"        value={doc.verification_method?.replace(/_/g, ' ')} />
                <MetadataRow label="Original seen" value={doc.original_seen ? 'Yes' : undefined} />
              </>}
              {doc.approved_by && <>
                <MetadataRow label="Approved by"   value={doc.approved_by} />
                <MetadataRow label="Approved at"   value={fmt(doc.approved_at)} />
              </>}
              {doc.rejected_reason && (
                <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  <p className="text-[11px] font-semibold text-red-700">Rejection reason</p>
                  <p className="text-[11px] text-red-600 mt-0.5">{doc.rejected_reason}</p>
                </div>
              )}
            </div>
          )}

          {tab === 'history' && (
            <div className="px-4 py-4">
              <AuditTimeline documentId={doc.id} />
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
