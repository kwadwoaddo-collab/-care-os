'use client'

import { useState, useCallback } from 'react'
import DocumentApprovalButton from './DocumentApprovalButton'
import ComplianceActionDrawer, {
  type DrawerAction,
  type DrawerDoc,
} from '@/components/admin/ComplianceActionDrawer'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ApplicantDocForHub {
  id: string
  document_type: string
  file_name: string
  file_path: string | null
  file_size: number | null
  mime_type: string | null
  expiry_date: string | null
  issue_date: string | null
  created_at: string
  reviewed_status: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  staff_profile_id: string | null
  applicant_id: string | null
  signed_url: string | null
}

export interface StaffDocForHub {
  id: string
  applicant_id?: string | null
  file_name: string
  file_path: string | null
  file_url?: string | null
  document_type: string
  expiry_date?: string | null
  created_at: string
  reviewed_status?: string | null
  reviewed_by?: string | null
  reviewed_at?: string | null
}

interface Props {
  staffProfileId: string
  applicantDocs: ApplicantDocForHub[]
  staffDocs: StaffDocForHub[]
}

// ── Document type grouping ────────────────────────────────────────────────────

const GROUP_ORDER = [
  'DBS',
  'Right to Work',
  'Passport',
  'Training Certificate',
  'Manual Handling',
  'Safeguarding',
  'Other',
] as const

type GroupName = (typeof GROUP_ORDER)[number]

const TYPE_TO_GROUP: Record<string, GroupName> = {
  dbs_certificate:          'DBS',
  dbs:                      'DBS',
  right_to_work:            'Right to Work',
  share_code:               'Right to Work',
  right_to_work_share_code: 'Right to Work',
  passport:                 'Passport',
  training_certificate:     'Training Certificate',
  training:                 'Training Certificate',
  manual_handling:          'Manual Handling',
  safeguarding:             'Safeguarding',
}

function typeToGroup(docType: string): GroupName {
  return TYPE_TO_GROUP[docType.toLowerCase()] ?? 'Other'
}

// ── Unified document shape ────────────────────────────────────────────────────

interface UnifiedDoc {
  id: string
  document_type: string
  file_name: string
  file_size: number | null
  expiry_date: string | null
  created_at: string
  reviewed_status: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  signed_url: string | null
  source: 'applicant' | 'staff'
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function fileSize(bytes: number | null | undefined): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function docTypeLabel(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function isExpired(iso: string | null): boolean {
  if (!iso) return false
  return new Date(iso) < new Date()
}

function isExpiringSoon(iso: string | null): boolean {
  if (!iso) return false
  const expiry = new Date(iso)
  const warn = new Date()
  warn.setDate(warn.getDate() + 30)
  return expiry > new Date() && expiry <= warn
}

// ── Accessible status badge ───────────────────────────────────────────────────

const REVIEW_STATUS_CLS: Record<string, string> = {
  approved:     'bg-green-100 text-green-800 ring-green-700/20',
  rejected:     'bg-red-100 text-red-800 ring-red-700/20',
  pending:      'bg-yellow-100 text-yellow-900 ring-yellow-700/20',
  under_review: 'bg-blue-100 text-blue-800 ring-blue-700/20',
  superseded:   'bg-gray-100 text-gray-600 ring-gray-500/20',
}

function ReviewStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null
  const cls = REVIEW_STATUS_CLS[status] ?? 'bg-gray-100 text-gray-800 ring-gray-500/20'
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide ring-1 ring-inset uppercase ${cls}`}
      aria-label={`Document status: ${label}`}
    >
      {label}
    </span>
  )
}

// ── Expiry badge ──────────────────────────────────────────────────────────────

function ExpiryBadge({ expiryDate }: { expiryDate: string | null | undefined }) {
  if (!expiryDate) return <span className="text-xs text-gray-400">No expiry</span>
  if (isExpired(expiryDate)) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700" aria-label={`Expired on ${fmt(expiryDate)}`}>
        <span className="material-symbols-outlined text-[13px]" aria-hidden="true">warning</span>
        Expired {fmt(expiryDate)}
      </span>
    )
  }
  if (isExpiringSoon(expiryDate)) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-yellow-700" aria-label={`Expiring soon: ${fmt(expiryDate)}`}>
        <span className="material-symbols-outlined text-[13px]" aria-hidden="true">schedule</span>
        Exp: {fmt(expiryDate)}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-green-700" aria-label={`Expires ${fmt(expiryDate)}`}>
      <span className="material-symbols-outlined text-[13px]" aria-hidden="true">check_circle</span>
      Exp: {fmt(expiryDate)}
    </span>
  )
}

// ── Source badge ──────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: 'applicant' | 'staff' }) {
  if (source === 'applicant') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-600/20 uppercase tracking-wide"
        aria-label="Source: Applicant upload"
      >
        <span className="material-symbols-outlined text-[10px]" aria-hidden="true">person</span>
        Applicant upload
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600 ring-1 ring-inset ring-gray-400/20 uppercase tracking-wide"
      aria-label="Source: Staff upload"
    >
      <span className="material-symbols-outlined text-[10px]" aria-hidden="true">badge</span>
      Staff upload
    </span>
  )
}

// ── Group header icons ────────────────────────────────────────────────────────

const GROUP_ICON: Record<GroupName, string> = {
  'DBS':                  'fingerprint',
  'Right to Work':        'work',
  'Passport':             'travel_explore',
  'Training Certificate': 'school',
  'Manual Handling':      'health_and_safety',
  'Safeguarding':         'shield_person',
  'Other':                'folder',
}

const GROUP_COLOUR: Record<GroupName, { header: string; border: string; icon: string }> = {
  'DBS':                  { header: 'bg-violet-50 border-violet-200', border: 'border-violet-100', icon: 'text-violet-600' },
  'Right to Work':        { header: 'bg-emerald-50 border-emerald-200', border: 'border-emerald-100', icon: 'text-emerald-600' },
  'Passport':             { header: 'bg-sky-50 border-sky-200', border: 'border-sky-100', icon: 'text-sky-600' },
  'Training Certificate': { header: 'bg-amber-50 border-amber-200', border: 'border-amber-100', icon: 'text-amber-600' },
  'Manual Handling':      { header: 'bg-teal-50 border-teal-200', border: 'border-teal-100', icon: 'text-teal-600' },
  'Safeguarding':         { header: 'bg-rose-50 border-rose-200', border: 'border-rose-100', icon: 'text-rose-600' },
  'Other':                { header: 'bg-gray-50 border-gray-200', border: 'border-gray-100', icon: 'text-gray-500' },
}

// ── Document row ──────────────────────────────────────────────────────────────

function DocumentRow({
  doc,
  staffProfileId,
  onDrawerOpen,
}: {
  doc: UnifiedDoc
  staffProfileId: string
  onDrawerOpen: (action: DrawerAction, doc: DrawerDoc) => void
}) {
  const viewAriaLabel = `View document: ${doc.file_name} (${docTypeLabel(doc.document_type)})`
  const dlAriaLabel   = `Download document: ${doc.file_name} (${docTypeLabel(doc.document_type)})`

  const drawerDoc: DrawerDoc = {
    id:              doc.id,
    document_type:   doc.document_type,
    file_name:       doc.file_name,
    reviewed_status: doc.reviewed_status,
    expiry_date:     doc.expiry_date,
    source:          doc.source,
  }

  const needsAttention = isExpired(doc.expiry_date) || isExpiringSoon(doc.expiry_date)
    || doc.reviewed_status === 'rejected' || doc.reviewed_status === null

  return (
    <li className={`flex flex-col gap-2.5 p-3.5 rounded-lg border bg-white hover:shadow-sm transition-all ${needsAttention ? 'border-amber-200' : 'border-gray-100 hover:border-gray-200'}`}>
      {/* Top row: file name + action buttons */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <span className="material-symbols-outlined text-[16px] text-gray-400 shrink-0 mt-0.5" aria-hidden="true">description</span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-primary leading-tight truncate" title={doc.file_name}>
              {doc.file_name}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {docTypeLabel(doc.document_type)}
              {doc.file_size ? ` · ${fileSize(doc.file_size)}` : ''}
            </p>
          </div>
        </div>

        {/* View + Download */}
        {doc.signed_url && (
          <div className="flex items-center gap-1 shrink-0">
            <a
              href={doc.signed_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={viewAriaLabel}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors"
            >
              <span className="material-symbols-outlined text-[13px]" aria-hidden="true">visibility</span>
              View
            </a>
            <a
              href={doc.signed_url}
              download={doc.file_name}
              aria-label={dlAriaLabel}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors"
            >
              <span className="material-symbols-outlined text-[13px]" aria-hidden="true">download</span>
              Download
            </a>
          </div>
        )}
      </div>

      {/* Second row: source + dates + status */}
      <div className="flex flex-wrap items-center gap-2">
        <SourceBadge source={doc.source} />
        <span className="text-gray-300" aria-hidden="true">·</span>
        <span className="flex items-center gap-1 text-xs text-gray-500">
          <span className="material-symbols-outlined text-[12px]" aria-hidden="true">upload</span>
          {fmt(doc.created_at)}
        </span>
        <ExpiryBadge expiryDate={doc.expiry_date} />
        {doc.reviewed_status && <ReviewStatusBadge status={doc.reviewed_status} />}
      </div>

      {/* In-context action buttons */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-gray-100">
        <button
          onClick={() => onDrawerOpen('upload', drawerDoc)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors"
          aria-label={`Upload replacement for ${doc.file_name}`}
        >
          <span className="material-symbols-outlined text-[12px]" aria-hidden="true">upload_file</span>
          Replace
        </button>
        <button
          onClick={() => onDrawerOpen('set_expiry', drawerDoc)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors"
          aria-label={`Set expiry date for ${doc.file_name}`}
        >
          <span className="material-symbols-outlined text-[12px]" aria-hidden="true">event</span>
          Set expiry
        </button>
        {doc.reviewed_status !== 'approved' && (
          <button
            onClick={() => onDrawerOpen('approve', drawerDoc)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 transition-colors"
            aria-label={`Approve ${doc.file_name}`}
          >
            <span className="material-symbols-outlined text-[12px]" aria-hidden="true">check_circle</span>
            Approve
          </button>
        )}
        {doc.reviewed_status !== 'rejected' && (
          <button
            onClick={() => onDrawerOpen('reject', drawerDoc)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors"
            aria-label={`Reject ${doc.file_name}`}
          >
            <span className="material-symbols-outlined text-[12px]" aria-hidden="true">cancel</span>
            Reject
          </button>
        )}
      </div>

      {/* Legacy approval button (still rendered for full feature parity) */}
      <DocumentApprovalButton
        staffProfileId={staffProfileId}
        docId={doc.id}
        docType={doc.document_type}
        initialStatus={doc.reviewed_status ?? null}
        reviewedBy={doc.reviewed_by ?? null}
        reviewedAt={doc.reviewed_at ?? null}
      />
    </li>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DocumentComplianceHub({
  staffProfileId,
  applicantDocs,
  staffDocs,
}: Props) {
  const [drawerOpen,   setDrawerOpen]   = useState(false)
  const [drawerAction, setDrawerAction] = useState<DrawerAction>('upload')
  const [drawerDoc,    setDrawerDoc]    = useState<DrawerDoc | null>(null)

  const openDrawer = useCallback((action: DrawerAction, doc?: DrawerDoc) => {
    setDrawerAction(action)
    setDrawerDoc(doc ?? null)
    setDrawerOpen(true)
  }, [])

  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  // Normalise applicant docs → UnifiedDoc
  const fromApplicant: UnifiedDoc[] = applicantDocs.map((d) => ({
    id:              d.id,
    document_type:   d.document_type,
    file_name:       d.file_name,
    file_size:       d.file_size,
    expiry_date:     d.expiry_date,
    created_at:      d.created_at,
    reviewed_status: d.reviewed_status,
    reviewed_at:     d.reviewed_at,
    reviewed_by:     d.reviewed_by,
    signed_url:      d.signed_url,
    source:          'applicant',
  }))

  // Normalise staff docs → UnifiedDoc
  const fromStaff: UnifiedDoc[] = staffDocs.map((d) => ({
    id:              d.id,
    document_type:   d.document_type,
    file_name:       d.file_name,
    file_size:       null,
    expiry_date:     d.expiry_date ?? null,
    created_at:      d.created_at,
    reviewed_status: d.reviewed_status ?? null,
    reviewed_at:     d.reviewed_at ?? null,
    reviewed_by:     d.reviewed_by ?? null,
    signed_url:      d.file_url ?? null,
    source:          'staff',
  }))

  const allDocs: UnifiedDoc[] = [...fromApplicant, ...fromStaff]
  const totalCount = allDocs.length

  // Group documents
  const grouped = new Map<GroupName, UnifiedDoc[]>(GROUP_ORDER.map((g) => [g, []]))
  for (const doc of allDocs) {
    const group = typeToGroup(doc.document_type)
    grouped.get(group)!.push(doc)
  }

  // Sort each group most-recent first
  for (const docs of grouped.values()) {
    docs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }

  const activeGroups = GROUP_ORDER.filter((g) => (grouped.get(g)?.length ?? 0) > 0)

  return (
    <>
      <section aria-labelledby="compliance-hub-heading">
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
          {/* Section header */}
          <div className="bg-gray-50 border-b border-gray-200 px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-gray-600 text-[20px]" aria-hidden="true">folder_special</span>
              <div>
                <h2 id="compliance-hub-heading" className="text-sm font-semibold text-gray-800">
                  Document Compliance Hub
                </h2>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  All compliance documents — applicant &amp; staff stage
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="bg-gray-200 text-gray-700 text-xs font-semibold px-2.5 py-0.5 rounded-full"
                aria-label={`${totalCount} total documents`}
              >
                {totalCount}
              </span>
              {/* Quick actions */}
              <button
                onClick={() => openDrawer('upload')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                aria-label="Upload a new document"
              >
                <span className="material-symbols-outlined text-[14px]" aria-hidden="true">upload_file</span>
                Upload
              </button>
              <button
                onClick={() => openDrawer('review_notes')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-gray-600 bg-white hover:bg-gray-50 border border-gray-200 transition-colors"
                aria-label="Add compliance review notes"
              >
                <span className="material-symbols-outlined text-[14px]" aria-hidden="true">rate_review</span>
                Add review
              </button>
            </div>
          </div>

          <div className="p-5">
            {totalCount === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center" role="status" aria-live="polite">
                <span className="material-symbols-outlined text-[40px] text-gray-300" aria-hidden="true">folder_off</span>
                <div>
                  <p className="text-sm font-medium text-gray-600">No documents found for this staff member.</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Documents uploaded during the application stage or via the staff portal will appear here.
                  </p>
                </div>
                <button
                  onClick={() => openDrawer('upload')}
                  className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">upload_file</span>
                  Upload first document
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {activeGroups.map((groupName) => {
                  const docs    = grouped.get(groupName)!
                  const colours = GROUP_COLOUR[groupName]
                  const icon    = GROUP_ICON[groupName]

                  return (
                    <div key={groupName} className={`rounded-lg border overflow-hidden ${colours.border}`}>
                      {/* Group header */}
                      <div className={`px-4 py-2.5 border-b flex items-center justify-between ${colours.header}`}>
                        <div className="flex items-center gap-2">
                          <span className={`material-symbols-outlined text-[16px] ${colours.icon}`} aria-hidden="true">
                            {icon}
                          </span>
                          <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                            {groupName}
                          </h3>
                        </div>
                        <span className="text-[11px] font-medium text-gray-500">
                          {docs.length} {docs.length === 1 ? 'document' : 'documents'}
                        </span>
                      </div>

                      {/* Document rows */}
                      <ul className="divide-y divide-gray-50 p-3 space-y-2" aria-label={`${groupName} documents`}>
                        {docs.map((doc) => (
                          <DocumentRow
                            key={`${doc.source}-${doc.id}`}
                            doc={doc}
                            staffProfileId={staffProfileId}
                            onDrawerOpen={openDrawer}
                          />
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Compliance action drawer */}
      <ComplianceActionDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        onSuccess={closeDrawer}
        staffProfileId={staffProfileId}
        action={drawerAction}
        doc={drawerDoc}
      />
    </>
  )
}
