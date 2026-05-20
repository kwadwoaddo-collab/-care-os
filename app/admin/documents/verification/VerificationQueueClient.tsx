'use client'

import { useState, useCallback, useMemo } from 'react'
import VerificationDrawer, {
  VerificationBadge,
  type DrawerMode,
  type DrawerDocument,
} from './VerificationDrawer'
import type { VerificationQueueItem, VerificationDiagnostics } from '@/lib/documents/verification'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  queue:       VerificationQueueItem[]
  diagnostics: VerificationDiagnostics
}

type FilterStatus = 'all' | 'pending_verification' | 'verified' | 'approved' | 'rejected' | 'resubmission'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function isExpired(iso: string | null)     { return !!iso && new Date(iso) < new Date() }
function isExpiringSoon(iso: string | null) {
  if (!iso) return false
  const e = new Date(iso), w = new Date(); w.setDate(w.getDate() + 30)
  return e > new Date() && e <= w
}

const SOURCE_LABELS: Record<string, string> = {
  applicant:         'Application',
  onboarding:        'Onboarding',
  admin_upload:      'Admin',
  worker_upload:     'Worker portal',
  compliance_review: 'Compliance',
}

const REQUIRES_ORIGINAL_SEEN = new Set([
  'passport', 'brp', 'visa', 'right_to_work',
  'share_code', 'share_code_confirmation', 'id',
])

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, urgent }: {
  label:   string
  value:   number
  icon:    string
  urgent?: boolean
}) {
  return (
    <div className={`rounded-xl border bg-surface-container-lowest px-4 py-3 flex items-start gap-3 shadow-sm ${urgent && value > 0 ? 'border-red-200' : 'border-gray-200'}`}>
      <span className={`material-symbols-outlined text-[20px] mt-0.5 ${urgent && value > 0 ? 'text-red-600' : 'text-gray-400'}`}>{icon}</span>
      <div>
        <p className={`text-xl font-bold tabular-nums ${urgent && value > 0 ? 'text-red-700' : 'text-gray-900'}`}>{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

// ── Document row ──────────────────────────────────────────────────────────────

function QueueRow({ item, onAction }: {
  item:     VerificationQueueItem
  onAction: (item: VerificationQueueItem, mode: DrawerMode) => void
}) {
  const needsOriginal = REQUIRES_ORIGINAL_SEEN.has(item.document_type) && !item.original_seen
  const expExpired    = isExpired(item.expiry_date)
  const expSoon       = isExpiringSoon(item.expiry_date)
  const staffName     = [item.staff_first_name, item.staff_last_name].filter(Boolean).join(' ') || '—'

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors group">
      {/* Document */}
      <td className="px-4 py-3 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]" title={item.file_name}>
          {item.file_name}
        </p>
        <p className="text-[11px] text-gray-400 mt-0.5">
          {item.document_type.replace(/_/g, ' ')}
          {item.compliance_linked && (
            <span className="ml-1.5 text-violet-500">· compliance</span>
          )}
        </p>
      </td>

      {/* Staff */}
      <td className="px-4 py-3 whitespace-nowrap">
        <p className="text-xs font-medium text-gray-700">{staffName}</p>
        {item.staff_job_role && (
          <p className="text-[11px] text-gray-400 mt-0.5">{item.staff_job_role}</p>
        )}
      </td>

      {/* Source */}
      <td className="px-4 py-3 whitespace-nowrap">
        {item.source_stage && (
          <span className="text-[11px] text-gray-600 bg-gray-100 rounded-full px-2 py-0.5">
            {SOURCE_LABELS[item.source_stage] ?? item.source_stage}
          </span>
        )}
      </td>

      {/* Status */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex flex-col gap-1">
          <VerificationBadge status={item.verification_status} />
          {item.resubmission_requested && (
            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 ring-1 ring-inset ring-amber-500/20">
              Resubmission requested
            </span>
          )}
          {needsOriginal && (
            <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 rounded px-1.5 py-0.5 ring-1 ring-inset ring-blue-400/20">
              Original required
            </span>
          )}
        </div>
      </td>

      {/* Expiry */}
      <td className="px-4 py-3 whitespace-nowrap">
        {item.expiry_date ? (
          <span className={`text-xs font-medium ${expExpired ? 'text-red-700' : expSoon ? 'text-yellow-700' : 'text-gray-600'}`}>
            {expExpired ? '⚠ ' : ''}{fmt(item.expiry_date)}
          </span>
        ) : (
          <span className="text-xs text-gray-400">No expiry</span>
        )}
      </td>

      {/* Uploaded */}
      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
        {fmt(item.created_at)}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          {item.verification_status === 'pending_verification' && (
            <>
              <button onClick={() => onAction(item, 'verify')}
                className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors">
                <span className="material-symbols-outlined text-[11px]">verified_user</span>
                Verify
              </button>
              <button onClick={() => onAction(item, 'approve')}
                className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 transition-colors">
                <span className="material-symbols-outlined text-[11px]">check_circle</span>
                Approve
              </button>
            </>
          )}
          {item.verification_status === 'verified' && (
            <button onClick={() => onAction(item, 'approve')}
              className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 transition-colors">
              <span className="material-symbols-outlined text-[11px]">check_circle</span>
              Approve
            </button>
          )}
          <button onClick={() => onAction(item, 'reject')}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors">
            <span className="material-symbols-outlined text-[11px]">cancel</span>
            Reject
          </button>
          <button onClick={() => onAction(item, 'resubmission')}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors">
            <span className="material-symbols-outlined text-[11px]">refresh</span>
            Resubmit
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function VerificationQueueClient({ queue: initialQueue, diagnostics: initialDiag }: Props) {
  const [queue, setQueue]         = useState<VerificationQueueItem[]>(initialQueue)
  const [diagnostics, setDiag]    = useState<VerificationDiagnostics>(initialDiag)
  const [drawerOpen, setOpen]     = useState(false)
  const [drawerMode, setMode]     = useState<DrawerMode>('verify')
  const [drawerDoc,  setDoc]      = useState<DrawerDocument | null>(null)
  const [filter, setFilter]       = useState<FilterStatus>('all')
  const [searchTerm, setSearch]   = useState('')
  const [folderFilter, setFolder] = useState('')
  const [typeFilter, setType]     = useState('')

  const openDrawer = useCallback((item: VerificationQueueItem, mode: DrawerMode) => {
    setDoc(item as unknown as DrawerDocument)
    setMode(mode)
    setOpen(true)
  }, [])

  const handleSuccess = useCallback((docId: string, newStatus: string) => {
    setQueue((prev) => prev.map((d) =>
      d.id === docId ? { ...d, verification_status: newStatus } : d
    ))
    // Update diagnostics lazily
    setDiag((prev) => ({
      ...prev,
      pendingVerification: newStatus === 'approved' || newStatus === 'rejected'
        ? Math.max(0, prev.pendingVerification - 1) : prev.pendingVerification,
      approved: newStatus === 'approved' ? prev.approved + 1 : prev.approved,
      rejected: newStatus === 'rejected' ? prev.rejected + 1 : prev.rejected,
    }))
  }, [])

  // Filtered queue
  const filtered = useMemo(() => {
    return queue.filter((d) => {
      if (filter === 'pending_verification' && d.verification_status !== 'pending_verification') return false
      if (filter === 'verified'            && d.verification_status !== 'verified')             return false
      if (filter === 'approved'            && d.verification_status !== 'approved')             return false
      if (filter === 'rejected'            && d.verification_status !== 'rejected')             return false
      if (filter === 'resubmission'        && !d.resubmission_requested)                        return false
      if (folderFilter && d.staff_document_folders?.slug !== folderFilter)                      return false
      if (typeFilter   && d.document_type !== typeFilter)                                       return false
      if (searchTerm) {
        const s = searchTerm.toLowerCase()
        const name = [d.staff_first_name, d.staff_last_name].join(' ').toLowerCase()
        if (!d.file_name.toLowerCase().includes(s) && !name.includes(s) && !d.document_type.toLowerCase().includes(s)) return false
      }
      return true
    })
  }, [queue, filter, folderFilter, typeFilter, searchTerm])

  // Unique folders + types for filter dropdowns
  const uniqueFolders = useMemo(() => {
    const map = new Map<string, string>()
    queue.forEach((d) => {
      if (d.staff_document_folders) map.set(d.staff_document_folders.slug, d.staff_document_folders.name)
    })
    return Array.from(map.entries()).map(([slug, name]) => ({ slug, name }))
  }, [queue])

  const uniqueTypes = useMemo(() => {
    const set = new Set(queue.map((d) => d.document_type))
    return Array.from(set).sort()
  }, [queue])

  return (
    <>
      <div className="space-y-5">
        {/* Diagnostics strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <StatCard label="Total"              value={diagnostics.total}               icon="folder" />
          <StatCard label="Pending"            value={diagnostics.pendingVerification}  icon="hourglass_empty" urgent />
          <StatCard label="Verified"           value={diagnostics.verified}             icon="verified_user" />
          <StatCard label="Approved"           value={diagnostics.approved}             icon="check_circle" />
          <StatCard label="Rejected"           value={diagnostics.rejected}             icon="cancel"      urgent />
          <StatCard label="Resubmission"       value={diagnostics.resubmissionRequested}icon="refresh"     urgent />
          <StatCard label="Needs original"     value={diagnostics.requiresOriginalSeen} icon="visibility"  urgent />
        </div>

        {/* Filter bar */}
        <div className="bg-surface-container-lowest rounded-xl border border-gray-200 px-4 py-3 shadow-sm space-y-3">
          {/* Status tabs */}
          <div className="flex flex-wrap gap-1.5">
            {([
              ['all',                  'All',             diagnostics.total],
              ['pending_verification', 'Pending',         diagnostics.pendingVerification],
              ['verified',             'Verified',        diagnostics.verified],
              ['approved',             'Approved',        diagnostics.approved],
              ['rejected',             'Rejected',        diagnostics.rejected],
              ['resubmission',         'Resubmission',    diagnostics.resubmissionRequested],
            ] as [FilterStatus, string, number][]).map(([f, label, count]) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  filter === f
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {label}
                <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${filter === f ? 'bg-white/20' : 'bg-gray-200 text-gray-700'}`}>
                  {count}
                </span>
              </button>
            ))}
          </div>

          {/* Search + folder/type filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[160px]">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[13px] text-gray-400">search</span>
              <input
                type="text" value={searchTerm} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search staff or document…"
                className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <select value={folderFilter} onChange={(e) => setFolder(e.target.value)}
              className="text-xs rounded-lg border border-gray-300 px-2 py-1.5 bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">All folders</option>
              {uniqueFolders.map((f) => (
                <option key={f.slug} value={f.slug}>{f.name}</option>
              ))}
            </select>
            <select value={typeFilter} onChange={(e) => setType(e.target.value)}
              className="text-xs rounded-lg border border-gray-300 px-2 py-1.5 bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">All types</option>
              {uniqueTypes.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Queue table */}
        <div className="bg-surface-container-lowest rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="border-b border-gray-100 px-4 py-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-gray-500 text-[18px]">fact_check</span>
            <h2 className="text-sm font-semibold text-gray-700">
              Verification queue
              <span className="ml-2 text-xs font-normal text-gray-400">({filtered.length} documents)</span>
            </h2>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <span className="material-symbols-outlined text-[36px] text-gray-300">done_all</span>
              <p className="text-sm font-medium text-gray-500">No documents match your filter</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Document','Staff','Source','Status','Expiry','Uploaded','Actions'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <QueueRow key={item.id} item={item} onAction={openDrawer} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <VerificationDrawer
        open={drawerOpen}
        onClose={() => setOpen(false)}
        mode={drawerMode}
        doc={drawerDoc}
        onSuccess={handleSuccess}
      />
    </>
  )
}
