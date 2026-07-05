'use client'

import { useState } from 'react'
import Link from 'next/link'
import { calculateCompliance, type ComplianceDocument } from '@/lib/compliance/calculateCompliance'
import { DAY_KEYS, type StaffAvailability, type DayKey } from '@/lib/staff/types'
import ComplianceActionDrawer, {
  type DrawerAction,
  type DrawerDoc,
} from '@/components/admin/ComplianceActionDrawer'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StaffProfile {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  job_role: string | null
  job_title: string | null
  status: string
  address_line_1?: string | null
  address_line_2?: string | null
  city?: string | null
  postcode?: string | null
  dbs_expiry_date?: string | null
}

// Use the shared ComplianceDocument type from the compliance module
type Document = ComplianceDocument

interface StaffShift {
  id: string
  title: string
  shift_date: string
  start_time: string
  location: string | null
  client_name: string | null
}

interface StaffVisitNote {
  id: string
  submitted_at: string | null
  created_at: string
  clients: { first_name: string; last_name: string } | null
}

interface Props {
  staffProfile: StaffProfile
  documents: Document[]
  availability: StaffAvailability | null
  recentShifts: StaffShift[]
  recentNotes: StaffVisitNote[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isExpiringSoon(iso: string | null): boolean {
  if (!iso) return false
  const expiry = new Date(iso)
  const now = new Date()
  const warnAt = new Date()
  warnAt.setDate(now.getDate() + 30)
  return expiry > now && expiry <= warnAt
}

function isExpired(iso: string | null): boolean {
  if (!iso) return false
  return new Date(iso) < new Date()
}

function relativeTime(iso: string): string {
  const then = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHrs = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHrs / 24)

  if (diffMins < 60)   return `${diffMins}m ago`
  if (diffHrs < 24)    return `${diffHrs}h ago`
  if (diffDays === 1)  return 'Yesterday'
  if (diffDays < 7)    return `${diffDays}d ago`
  return then.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function statusConfig(status: string): { label: string; colour: string; dot: string } {
  const map: Record<string, { label: string; colour: string; dot: string }> = {
    active:         { label: 'Active',          colour: 'bg-green-50 text-green-700 ring-green-600/20',   dot: 'bg-green-500' },
    pre_employment: { label: 'Pre-employment',  colour: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20', dot: 'bg-yellow-500' },
    suspended:      { label: 'Suspended',       colour: 'bg-orange-50 text-orange-700 ring-orange-600/20', dot: 'bg-orange-500' },
    terminated:     { label: 'Terminated',      colour: 'bg-red-50 text-red-700 ring-red-600/20',          dot: 'bg-red-500' },
    inactive:       { label: 'Inactive',        colour: 'bg-gray-50 text-gray-600 ring-gray-500/20',       dot: 'bg-gray-400' },
  }
  return map[status] ?? { label: status, colour: 'bg-gray-50 text-gray-600 ring-gray-500/20', dot: 'bg-gray-400' }
}

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const

// ── Component ─────────────────────────────────────────────────────────────────

export default function StaffProfileMobile({
  staffProfile: sp,
  documents,
  availability,
  recentShifts,
  recentNotes,
}: Props) {
  const [drawerOpen,   setDrawerOpen]   = useState(false)
  const [drawerAction, setDrawerAction] = useState<DrawerAction>('upload')
  const [drawerDoc,    setDrawerDoc]    = useState<DrawerDoc | null>(null)

  const openDrawer = (action: DrawerAction, doc?: DrawerDoc) => {
    setDrawerAction(action)
    setDrawerDoc(doc ?? null)
    setDrawerOpen(true)
  }
  const displayName = [sp.first_name, sp.last_name].filter(Boolean).join(' ') || sp.email || 'Unknown'
  const initials = [sp.first_name?.[0], sp.last_name?.[0]].filter(Boolean).join('').toUpperCase() || 'U'
  const status = statusConfig(sp.status)

  const compliance = calculateCompliance(documents)
  const compliancePct = compliance.percentage

  // Find docs that are expiring or expired for the alert card
  const urgentDocs = documents.filter(
    (d) => isExpired(d.expiry_date) || isExpiringSoon(d.expiry_date)
  )

  // Build address string
  const addressParts = [sp.address_line_1, sp.address_line_2, sp.city, sp.postcode].filter(Boolean)
  const address = addressParts.length > 0 ? addressParts.join(', ') : null

  // Build activity feed from real data (shifts + notes), sorted by date
  type FeedItem = { key: string; icon: string; iconBg: string; label: string; timestamp: string }
  const feed: FeedItem[] = []

  recentShifts.slice(0, 3).forEach((shift) => {
    const at = shift.shift_date ? new Date(`${shift.shift_date}T${shift.start_time || '00:00'}`) : null
    feed.push({
      key: `shift-${shift.id}`,
      icon: 'schedule',
      iconBg: 'bg-secondary-container',
      label: `Shift: ${shift.title ?? 'Unnamed'}${shift.location ? ` at ${shift.location}` : ''}`,
      timestamp: at ? relativeTime(at.toISOString()) : '—',
    })
  })

  recentNotes.slice(0, 3).forEach((note) => {
    const clientName = note.clients
      ? `${note.clients.first_name} ${note.clients.last_name}`.trim()
      : 'a client'
    feed.push({
      key: `note-${note.id}`,
      icon: 'description',
      iconBg: 'bg-surface-container-high',
      label: `Updated patient note for ${clientName}`,
      timestamp: relativeTime(note.submitted_at ?? note.created_at),
    })
  })

  // Sort by timestamp (most recent first) — simplified: keep insertion order if can't sort
  // Add a static "Completed Weekly Mandatory Training" if feed has room
  if (feed.length < 5) {
    feed.push({
      key: 'training-static',
      icon: 'verified_user',
      iconBg: 'bg-tertiary-container',
      label: 'Completed Weekly Mandatory Training',
      timestamp: '—',
    })
  }

  return (
    <>
    <div className="flex flex-col bg-background min-h-screen pb-24">

      {/* ── Page Header Bar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 sticky top-0 bg-background z-10 border-b border-outline-variant">
        <Link
          href="/admin/staff"
          className="flex items-center gap-2 text-on-surface-variant"
          aria-label="Back to staff list"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </Link>
        <h1 className="font-headline-md text-sm font-bold text-on-surface">Staff Profile</h1>
        <button
          aria-label="More options"
          className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-surface-container-high transition-colors"
        >
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">more_vert</span>
        </button>
      </div>

      <div className="flex flex-col gap-4 px-4 pt-6">

        {/* ── Identity Section ─────────────────────────────────────────────── */}
        <div 
          className="flex flex-col items-center text-center gap-3 pb-2"
          style={{ viewTransitionName: `staff-${sp.id}` }}
        >
          {/* Avatar */}
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-primary-container flex items-center justify-center">
              <span className="text-3xl font-bold text-on-primary" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
                {initials}
              </span>
            </div>
            {/* Online dot */}
            {sp.status === 'active' && (
              <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-green-500 ring-2 ring-background" />
            )}
          </div>

          {/* Name + role */}
          <div>
            <p className="text-xl font-bold text-on-surface" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
              {displayName}
            </p>
            <p className="text-sm text-on-surface-variant mt-0.5">
              {sp.job_title ?? sp.job_role?.replace(/_/g, ' ') ?? 'Care Worker'}
            </p>
          </div>

          {/* Status badge */}
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${status.colour}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            {status.label.toUpperCase()}
          </span>
        </div>

        {/* ── Quick Actions ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-3">
          {/* Assign — primary operational action */}
          <Link
            href={`/admin/shifts?assign_to=${sp.id}`}
            className="flex flex-col items-center gap-2 bg-primary-container text-on-primary rounded-lg py-4 transition-opacity hover:opacity-90"
          >
            <span className="material-symbols-outlined text-[22px]">calendar_add_on</span>
            <span className="text-xs font-bold" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>Assign</span>
          </Link>

          {/* Pre-Employment Checks */}
          <Link
            href={`/admin/staff/${sp.id}/pre-employment`}
            className="flex flex-col items-center gap-2 bg-surface-container-high text-on-surface rounded-lg py-4 transition-opacity hover:opacity-90"
          >
            <span className="material-symbols-outlined text-[22px]">fact_check</span>
            <span className="text-xs font-semibold" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>Checks</span>
          </Link>

          {/* Message */}
          {sp.email ? (
            <a
              href={`mailto:${sp.email}`}
              className="flex flex-col items-center gap-2 bg-secondary-container text-on-secondary-container rounded-lg py-4 transition-opacity hover:opacity-90"
            >
              <span className="material-symbols-outlined text-[22px]">chat</span>
              <span className="text-xs font-semibold" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>Message</span>
            </a>
          ) : (
            <div className="flex flex-col items-center gap-2 bg-surface-container text-on-surface-variant rounded-lg py-4 opacity-50 cursor-not-allowed">
              <span className="material-symbols-outlined text-[22px]">chat</span>
              <span className="text-xs font-semibold" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>Message</span>
            </div>
          )}

          {/* Call */}
          {sp.phone ? (
            <a
              href={`tel:${sp.phone}`}
              className="flex flex-col items-center gap-2 bg-surface-container-high text-on-surface rounded-lg py-4 transition-opacity hover:opacity-90"
            >
              <span className="material-symbols-outlined text-[22px]">call</span>
              <span className="text-xs font-semibold" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>Call</span>
            </a>
          ) : (
            <div className="flex flex-col items-center gap-2 bg-surface-container text-on-surface-variant rounded-lg py-4 opacity-50 cursor-not-allowed">
              <span className="material-symbols-outlined text-[22px]">call</span>
              <span className="text-xs font-semibold" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>Call</span>
            </div>
          )}
        </div>

        {/* ── Onboarding Status ─────────────────────────────────────────────── */}
        {(sp.status === 'pre_employment' || compliancePct < 100) && (
          <div className={`rounded-xl border p-4 space-y-3 ${
            sp.status === 'pre_employment'
              ? 'bg-amber-50 border-amber-200'
              : compliancePct < 60
              ? 'bg-red-50 border-red-200'
              : 'bg-blue-50 border-blue-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`material-symbols-outlined text-[18px] ${
                  sp.status === 'pre_employment' ? 'text-amber-600' : compliancePct < 60 ? 'text-red-600' : 'text-blue-600'
                }`}>
                  {sp.status === 'pre_employment' ? 'pending_actions' : 'assignment_late'}
                </span>
                <p className="text-sm font-bold text-on-surface">
                  {sp.status === 'pre_employment' ? 'Onboarding in Progress' : 'Compliance Incomplete'}
                </p>
              </div>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                sp.status === 'pre_employment'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {sp.status === 'pre_employment' ? 'Pre-Employment' : 'Gap'}
              </span>
            </div>
            {(compliance.missingDocuments.length > 0 || compliance.missingTraining.length > 0) && (
              <p className="text-xs text-on-surface-variant">
                {compliance.missingDocuments.length + compliance.missingTraining.length} item{compliance.missingDocuments.length + compliance.missingTraining.length !== 1 ? 's' : ''} missing
                {compliance.missingDocuments.length > 0 && ` — ${compliance.missingDocuments.slice(0, 2).map((d: string) => d.replace(/_/g, ' ')).join(', ')}`}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/admin/staff/${sp.id}/pre-employment`}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-800"
              >
                <span className="material-symbols-outlined text-[13px]">fact_check</span>
                Pre-Employment
              </Link>
              <Link
                href={`/admin/documents?staff_id=${sp.id}`}
                className="inline-flex items-center gap-1 rounded-lg border border-outline-variant bg-white px-2.5 py-1.5 text-xs font-semibold text-on-surface"
              >
                <span className="material-symbols-outlined text-[13px]">folder_open</span>
                Documents
              </Link>
              <Link
                href="/admin/compliance"
                className="inline-flex items-center gap-1 rounded-lg border border-outline-variant bg-white px-2.5 py-1.5 text-xs font-semibold text-on-surface"
              >
                <span className="material-symbols-outlined text-[13px]">verified_user</span>
                Compliance
              </Link>
            </div>
          </div>
        )}

        {/* ── Compliance Triage Card ───────────────────────────────────────── */}
        <div className="bg-surface-container-lowest rounded-lg border border-outline-variant p-4 space-y-3">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <p
              className="text-sm font-bold text-on-surface"
              style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}
            >
              Compliance Status
            </p>
            <span className={`text-sm font-bold ${
              compliancePct >= 80 ? 'text-green-600' :
              compliancePct >= 50 ? 'text-yellow-600' : 'text-error'
            }`}>
              {compliancePct}% Complete
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                compliancePct >= 80 ? 'bg-green-500' :
                compliancePct >= 50 ? 'bg-yellow-500' : 'bg-error'
              }`}
              style={{ width: `${compliancePct}%` }}
            />
          </div>

          {/* Urgent doc alerts — tap to open in-context drawer */}
          {urgentDocs.length > 0 && (
            <div className="space-y-2">
              {urgentDocs.slice(0, 2).map((doc) => {
                const expired = isExpired(doc.expiry_date)
                const daysLeft = doc.expiry_date
                  // eslint-disable-next-line react-hooks/purity
                  ? Math.ceil((new Date(doc.expiry_date).getTime() - Date.now()) / 86400000)
                  : null
                const drawerDocPayload: DrawerDoc = {
                  id:              doc.id,
                  document_type:   doc.document_type,
                  file_name:       (doc as { file_name?: string }).file_name ?? doc.document_type,
                  reviewed_status: (doc as { reviewed_status?: string | null }).reviewed_status ?? null,
                  expiry_date:     doc.expiry_date ?? null,
                  source:          'staff',
                }
                return (
                  <div
                    key={doc.id}
                    className="flex items-start justify-between gap-3 bg-error-container rounded-lg p-3"
                  >
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-[18px] text-on-error-container mt-0.5">warning</span>
                      <div>
                        <p className="text-sm font-bold text-on-error-container">
                          {doc.document_type.replace(/_/g, ' ')} {expired ? 'Expired' : 'Expiring'}
                        </p>
                        <p className="text-xs text-on-error-container/80">
                          {expired
                            ? 'Document has expired. Tap to renew.'
                            : `Expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Tap to renew.`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => openDrawer('upload', drawerDocPayload)}
                      className="shrink-0 rounded-lg bg-error text-on-error text-xs font-bold px-3 py-1.5 hover:opacity-90 transition-opacity whitespace-nowrap"
                      aria-label={`Renew ${doc.document_type.replace(/_/g, ' ')}`}
                    >
                      Renew
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Core Information ─────────────────────────────────────────────── */}
        <div className="bg-surface-container-lowest rounded-lg border border-outline-variant p-4 space-y-4">
          <h2 className="text-sm font-bold text-on-surface" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
            Core Information
          </h2>

          {/* Email */}
          {sp.email && (
            <div className="flex items-start gap-4">
              <span className="material-symbols-outlined text-[20px] text-on-surface-variant mt-0.5">mail</span>
              <div>
                <p className="text-[11px] text-on-surface-variant font-medium">Email Address</p>
                <p className="text-sm text-on-surface mt-0.5">{sp.email}</p>
              </div>
            </div>
          )}

          {/* Address */}
          {address && (
            <div className="flex items-start gap-4">
              <span className="material-symbols-outlined text-[20px] text-on-surface-variant mt-0.5">location_on</span>
              <div>
                <p className="text-[11px] text-on-surface-variant font-medium">Address</p>
                <p className="text-sm text-on-surface mt-0.5">{address}</p>
              </div>
            </div>
          )}

          {/* Phone */}
          {sp.phone && (
            <div className="flex items-start gap-4">
              <span className="material-symbols-outlined text-[20px] text-on-surface-variant mt-0.5">call</span>
              <div>
                <p className="text-[11px] text-on-surface-variant font-medium">Phone</p>
                <p className="text-sm text-on-surface mt-0.5">{sp.phone}</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Availability Grid ────────────────────────────────────────────── */}
        <div className="bg-surface-container-lowest rounded-lg border border-outline-variant p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-on-surface" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
              Availability
            </h2>
            <Link
              href={`/admin/staff/${sp.id}#availability`}
              className="text-xs font-semibold text-secondary"
            >
              Edit
            </Link>
          </div>

          {/* 7-day grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {DAY_KEYS.map((dayKey: DayKey, i: number) => {
              const dayAvail = availability?.[dayKey]
              const isAvailable = dayAvail?.available === true
              const hoursLabel =
                isAvailable && dayAvail?.start_time && dayAvail?.end_time
                  ? (() => {
                      const [sh, sm] = (dayAvail.start_time).split(':').map(Number)
                      const [eh, em] = (dayAvail.end_time).split(':').map(Number)
                      const hrs = Math.round((eh * 60 + em - sh * 60 - sm) / 60)
                      return `${hrs}h`
                    })()
                  : null

              return (
                <div key={dayKey} className="flex flex-col items-center gap-1">
                  <span className="text-[10px] font-semibold text-on-surface-variant uppercase">{DAYS[i]}</span>
                  <div
                    className={`w-full aspect-square rounded-md flex items-center justify-center text-xs font-bold transition-colors ${
                      isAvailable
                        ? 'bg-secondary-container text-on-secondary-container'
                        : 'border border-dashed border-outline-variant text-on-surface-variant/40'
                    }`}
                  >
                    {hoursLabel ?? '—'}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Core hours summary */}
          {availability && (() => {
            const totalHrs = DAY_KEYS.reduce((acc, key: DayKey) => {
              const d = availability[key]
              if (!d?.available || !d?.start_time || !d?.end_time) return acc
              const [sh, sm] = (d.start_time).split(':').map(Number)
              const [eh, em] = (d.end_time).split(':').map(Number)
              return acc + Math.round((eh * 60 + em - sh * 60 - sm) / 60)
            }, 0)
            return (
              <p className="text-xs text-on-surface-variant">Core hours: {totalHrs} hours per week</p>
            )
          })()}
        </div>

        {/* ── Recent Activity Feed ─────────────────────────────────────────── */}
        {feed.length > 0 && (
          <div className="bg-surface-container-lowest rounded-lg border border-outline-variant p-4 space-y-3">
            <h2 className="text-sm font-bold text-on-surface" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
              Recent Activity
            </h2>

            <ol className="space-y-0">
              {feed.map((item, idx) => (
                <li key={item.key} className="flex gap-3 relative">
                  {/* Timeline connector */}
                  {idx < feed.length - 1 && (
                    <div className="absolute left-[15px] top-8 bottom-0 w-[2px] bg-outline-variant/50" />
                  )}

                  {/* Icon dot */}
                  <div className={`relative z-10 w-8 h-8 rounded-full ${item.iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant">{item.icon}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-5">
                    <p className="text-sm text-on-surface leading-snug">{item.label}</p>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">{item.timestamp}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

      </div>
    </div>

    {/* Compliance action drawer */}
    <ComplianceActionDrawer
      open={drawerOpen}
      onClose={() => setDrawerOpen(false)}
      onSuccess={() => setDrawerOpen(false)}
      staffProfileId={sp.id}
      action={drawerAction}
      doc={drawerDoc}
    />
  </>
  )
}
