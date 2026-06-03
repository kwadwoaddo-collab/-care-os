'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import StatusBadge, { staffStatusVariant } from '@/components/ui/StatusBadge'
import { calculateCompliance } from '@/lib/compliance/calculateCompliance'
import { DAY_KEYS, type StaffAvailability, type DayKey } from '@/lib/staff/types'
import type { ComplianceDocument } from '@/lib/compliance/calculateCompliance'
import EditStaffProfileForm from '@/app/admin/staff/[id]/EditStaffProfileForm'
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
  employment_type?: string | null
  contracted_hours?: number | null
  dbs_expiry_date?: string | null
  start_date?: string | null
}

interface StaffShift {
  id: string
  title: string
  shift_date: string
  start_time: string
  end_time: string
  location: string | null
  client_name: string | null
  shift_type: string | null
}

interface StaffVisitNote {
  id: string
  submitted_at: string | null
  created_at: string
  clients: { first_name: string; last_name: string } | null
}

interface StaffIncident {
  id: string
  incident_type: string
  severity: string
  status: string
  occurred_at: string | null
  created_at: string
  clients: { id: string; first_name: string; last_name: string } | null
}

interface Props {
  staffProfile: StaffProfile
  documents: ComplianceDocument[]
  availability: StaffAvailability | null
  recentShifts: StaffShift[]
  recentNotes: StaffVisitNote[]
  recentIncidents: StaffIncident[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isExpired(iso: string | null) {
  if (!iso) return false
  return new Date(iso) < new Date()
}

function isExpiringSoon(iso: string | null) {
  if (!iso) return false
  const expiry = new Date(iso)
  const warn = new Date()
  warn.setDate(warn.getDate() + 30)
  return expiry > new Date() && expiry <= warn
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)
  if (mins < 60) return `${mins}m ago`
  if (hrs < 24) return `Today • ${new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
  if (days === 1) return `Yesterday • ${new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) +
    ' • ' + new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

// ── Sub-components ────────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-surface-container-lowest rounded-lg border border-outline-variant ${className}`}>
      {children}
    </div>
  )
}

function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant">
      <h2 className="text-sm font-bold text-on-surface" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
        {title}
      </h2>
      {action}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function StaffProfileDesktop({
  staffProfile: sp,
  documents,
  availability,
  recentShifts,
  recentNotes,
  recentIncidents,
}: Props) {
  const displayName = [sp.first_name, sp.last_name].filter(Boolean).join(' ') || sp.email || 'Unknown'
  const initials = [sp.first_name?.[0], sp.last_name?.[0]].filter(Boolean).join('').toUpperCase() || 'U'

  const compliance = calculateCompliance(documents)
  const compliancePct = compliance.percentage

  const dbsDoc = documents.find((d) => d.document_type === 'dbs_certificate')
  const dbsExpired = isExpired(dbsDoc?.expiry_date ?? null)
  const dbsExpiringSoon = isExpiringSoon(dbsDoc?.expiry_date ?? null)

  const pendingTraining = compliance.missingTraining.slice(0, 4)

  // Address
  const address = [sp.address_line_1, sp.address_line_2, sp.city, sp.postcode].filter(Boolean).join(', ')

  // Shift pattern from availability
  const shiftDays = DAY_KEYS.map((key: DayKey, i: number) => {
    const day = availability?.[key]
    const isOn = day?.available === true
    const start = day?.start_time ?? ''
    const end = day?.end_time ?? ''
    const startHr = parseInt(start.split(':')[0] ?? '0')
    const isNight = startHr >= 18 || startHr < 6
    return { label: DAY_LABELS[i], isOn, start, end, isNight }
  })

  // Activity feed
  type FeedItem = {
    key: string; icon: string; dotColor: string; title: string; subtitle?: string; time: string
  }
  const feed: FeedItem[] = []

  recentShifts.slice(0, 2).forEach((s) => {
    const at = `${s.shift_date}T${s.start_time || '00:00'}`
    feed.push({
      key: `shift-${s.id}`,
      icon: 'schedule',
      dotColor: 'bg-green-500',
      title: `Shift: ${s.title}`,
      subtitle: s.location ?? undefined,
      time: relativeTime(at),
    })
  })

  recentNotes.slice(0, 2).forEach((n) => {
    const name = n.clients ? `${n.clients.first_name} ${n.clients.last_name}` : 'a client'
    feed.push({
      key: `note-${n.id}`,
      icon: 'description',
      dotColor: 'bg-secondary-container',
      title: `Patient Note for ${name}`,
      time: relativeTime(n.submitted_at ?? n.created_at),
    })
  })

  recentIncidents.slice(0, 2).forEach((inc) => {
    feed.push({
      key: `inc-${inc.id}`,
      icon: 'warning',
      dotColor: 'bg-error',
      title: `Incident: ${inc.incident_type.replace(/_/g, ' ')}`,
      subtitle: inc.severity,
      time: relativeTime(inc.occurred_at ?? inc.created_at),
    })
  })

  if (feed.length < 3) {
    feed.push({
      key: 'training-static',
      icon: 'verified_user',
      dotColor: 'bg-tertiary',
      title: 'Training Completed',
      subtitle: 'Manual Handling (Annual Refresher)',
      time: '—',
    })
  }

  // ── Drawer state ──────────────────────────────────────────────────────────
  const [drawerOpen,   setDrawerOpen]   = useState(false)
  const [drawerAction, setDrawerAction] = useState<DrawerAction>('upload')
  const [drawerDoc,    setDrawerDoc]    = useState<DrawerDoc | null>(null)

  const openDrawer = useCallback((action: DrawerAction, doc?: DrawerDoc) => {
    setDrawerAction(action)
    setDrawerDoc(doc ?? null)
    setDrawerOpen(true)
  }, [])

  const dbsDrawerDoc: DrawerDoc | undefined = dbsDoc
    ? {
        id:              dbsDoc.id,
        document_type:   dbsDoc.document_type,
        file_name:       (dbsDoc as { file_name?: string }).file_name ?? 'DBS Certificate',
        reviewed_status: (dbsDoc as { reviewed_status?: string | null }).reviewed_status ?? null,
        expiry_date:     dbsDoc.expiry_date ?? null,
        source:          'staff',
      }
    : undefined

  return (
    <>
      <div className="space-y-5">
        {/* ── Breadcrumb + Actions ──────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-on-surface-variant mb-1">
              <Link href="/admin/staff" className="hover:text-primary transition-colors">Staff Directory</Link>
              <span className="mx-2 text-outline-variant">›</span>
              <span>Profile View</span>
            </p>
            <h1 className="text-3xl font-bold text-on-surface leading-tight" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
              {displayName}
            </h1>
            <p className="text-sm text-on-surface-variant mt-1">
              {sp.job_title ?? sp.job_role?.replace(/_/g, ' ') ?? 'Care Worker'}
              {sp.address_line_1 && <span className="text-outline-variant mx-2">•</span>}
              {sp.city}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 pt-1">
            {sp.email && (
              <a
                href={`mailto:${sp.email}`}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm font-semibold text-on-surface hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">mail</span>
                Send Message
              </a>
            )}
            <EditStaffProfileForm staff={{ ...sp, start_date: sp.start_date ?? null }} />
            <Link
              href={`/admin/staff/${sp.id}/pre-employment`}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm font-semibold text-on-surface hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">fact_check</span>
              Pre-Employment
            </Link>
            <Link
              href={`/admin/shifts?assign_to=${sp.id}`}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary-container text-on-secondary-container text-sm font-bold hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined text-[18px]">calendar_add_on</span>
              Assign Shift
            </Link>
          </div>
        </div>

        {/* ── 3-Column Grid ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-[280px_1fr_280px] gap-5 items-start">

          {/* ══ Column 1: Identity ══════════════════════════════════════════ */}
          <div className="space-y-4">

            {/* Identity Card */}
            <Card>
              <div className="flex flex-col items-center text-center p-6 gap-3">
                {/* Avatar */}
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-primary-container flex items-center justify-center">
                    <span className="text-3xl font-bold text-on-primary" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
                      {initials}
                    </span>
                  </div>
                  {sp.status === 'active' && (
                    <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-green-500 ring-2 ring-white" />
                  )}
                </div>

                {/* Status badge */}
                <StatusBadge
                  variant={staffStatusVariant(sp.status ?? 'inactive')}
                  label={sp.status === 'active' ? 'Active Status' : (sp.status ?? 'unknown').replace(/_/g, ' ')}
                  ariaLabel={`Staff status: ${(sp.status ?? 'unknown').replace(/_/g, ' ')}`}
                  dot
                  size="xs"
                />

                {/* Name */}
                <div>
                  <p className="text-xl font-bold text-on-surface leading-tight" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
                    {displayName}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Employee ID: #{sp.id.slice(0, 4).toUpperCase()}-{(sp.first_name?.[0] ?? 'X')}{(sp.last_name?.[0] ?? 'X')}
                  </p>
                </div>

                <div className="w-full border-t border-outline-variant" />

                {/* Contact info */}
                <div className="w-full space-y-3 text-left">
                  {sp.phone && (
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-[18px] text-on-surface-variant mt-0.5 shrink-0">call</span>
                      <div>
                        <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wide">Primary Phone</p>
                        <p className="text-sm text-on-surface">{sp.phone}</p>
                      </div>
                    </div>
                  )}
                  {sp.email && (
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-[18px] text-on-surface-variant mt-0.5 shrink-0">mail</span>
                      <div>
                        <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wide">Email Address</p>
                        <p className="text-sm text-on-surface break-all">{sp.email}</p>
                      </div>
                    </div>
                  )}
                  {sp.city && (
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-[18px] text-on-surface-variant mt-0.5 shrink-0">location_on</span>
                      <div>
                        <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wide">Base Location</p>
                        <p className="text-sm text-on-surface">{sp.city}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Contract Details */}
            <Card>
              <CardHeader title="Contract Details" />
              <div className="p-5 space-y-3">
                {([
                  { label: 'Pay Rate',       value: '—' },
                  { label: 'Contract Type',  value: sp.employment_type?.replace(/_/g, ' ') ?? '—' },
                  { label: 'Weekly Hours',   value: sp.contracted_hours ? `${sp.contracted_hours}h` : '—' },
                  { label: 'Notice Period',  value: '4 Weeks' },
                  { label: 'Start Date',     value: sp.start_date ? new Date(sp.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
                ] as { label: string; value: string }[]).map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-on-surface-variant">{label}</span>
                    <span className="text-sm font-semibold text-on-surface capitalize">{value}</span>
                  </div>
                ))}
                {address && (
                  <div className="pt-2 border-t border-outline-variant">
                    <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wide mb-1">Home Address</p>
                    <p className="text-sm text-on-surface">{address}</p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* ══ Column 2: Operations ════════════════════════════════════════ */}
          <div className="space-y-4">

            {/* Compliance Card */}
            <Card>
              <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <h2 className="text-lg font-bold text-on-surface" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
                      Compliance Status
                    </h2>
                    <p className="text-xs text-on-surface-variant">Last updated today</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-extrabold text-on-surface tabular-nums">{compliancePct}%</p>
                    <p className="text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">Global Score</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2.5 rounded-full bg-surface-container-high overflow-hidden mb-4">
                  <div
                    className={`h-full rounded-full ${compliancePct >= 80 ? 'bg-secondary-container' : compliancePct >= 50 ? 'bg-yellow-500' : 'bg-error'}`}
                    style={{ width: `${compliancePct}%` }}
                  />
                </div>

                {/* DBS Alert — now opens drawer instead of redirecting */}
                {(dbsExpired || dbsExpiringSoon) && (
                  <div className="flex items-start justify-between gap-4 bg-error-container rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined text-[20px] text-on-error-container mt-0.5">error</span>
                      <div>
                        <p className="text-sm font-bold text-on-error-container">
                          DBS Check {dbsExpired ? 'Expired' : 'Expiring Soon'}
                        </p>
                        <p className="text-xs text-on-error-container/80 mt-0.5 max-w-xs">
                          {dbsExpired
                            ? "The staff member's Disclosure and Barring Service check has expired. Renewal is mandatory for shift assignment."
                            : "The DBS check is expiring within 30 days. Please arrange renewal promptly."}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => openDrawer('upload', dbsDrawerDoc)}
                      className="shrink-0 px-4 py-2 rounded-lg bg-error text-on-error text-xs font-bold whitespace-nowrap hover:opacity-90 transition-opacity"
                      aria-label="Renew DBS — upload replacement document"
                    >
                      Renew Now
                    </button>
                  </div>
                )}
                {!dbsExpired && !dbsExpiringSoon && compliancePct < 100 && (
                  <div className="flex items-center gap-3 bg-surface-container-low rounded-lg p-4">
                    <span className="material-symbols-outlined text-[20px] text-on-surface-variant">info</span>
                    <p className="text-sm text-on-surface-variant">
                      {compliance.missingDocuments.length > 0
                        ? `Missing: ${compliance.missingDocuments.slice(0,2).map((d) => d.replace(/_/g, ' ')).join(', ')}`
                        : 'Some training modules incomplete.'}
                    </p>
                  </div>
                )}
              </div>

              {/* Pending Training Modules */}
              {pendingTraining.length > 0 && (
                <>
                  <div className="border-t border-outline-variant px-5 py-3">
                    <p className="text-[10px] font-bold tracking-widest text-on-surface-variant uppercase">
                      Pending Training Modules
                    </p>
                  </div>
                  <div className="divide-y divide-outline-variant">
                    {pendingTraining.map((t) => (
                      <div key={t} className="flex items-center justify-between px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-[18px] text-secondary-container">school</span>
                          <span className="text-sm text-on-surface capitalize">{t.replace(/_/g, ' ')}</span>
                        </div>
                        <button
                          onClick={() => openDrawer('upload', { id: '', document_type: 'training_certificate', file_name: '', reviewed_status: null, expiry_date: null, source: 'staff' })}
                          className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20 uppercase tracking-wide hover:bg-yellow-100 transition-colors"
                          aria-label={`Upload training certificate for ${t.replace(/_/g, ' ')}`}
                        >
                          Upload
                        </button>
                      </div>
                    ))}
                    {compliance.missingDocuments.slice(0, 2).map((d) => (
                      <div key={d} className="flex items-center justify-between px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="material-symbols-outlined text-[18px] text-on-surface-variant">description</span>
                          <span className="text-sm text-on-surface capitalize">{d.replace(/_/g, ' ')}</span>
                        </div>
                        <button
                          onClick={() => openDrawer('upload', { id: '', document_type: d, file_name: '', reviewed_status: null, expiry_date: null, source: 'staff' })}
                          className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-gray-50 text-gray-600 ring-1 ring-inset ring-gray-400/20 uppercase tracking-wide hover:bg-gray-100 transition-colors"
                          aria-label={`Upload ${d.replace(/_/g, ' ')} document`}
                        >
                          Upload
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>

            {/* Shift Pattern */}
            <Card>
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-on-surface" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
                      Shift Pattern
                    </h2>
                    <p className="text-xs text-on-surface-variant">Week at a Glance</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {sp.contracted_hours && (
                      <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-surface-container text-on-surface border border-outline-variant">
                        Core: {sp.contracted_hours}h / Week
                      </span>
                    )}
                  </div>
                </div>

                {/* 7-day grid */}
                <div className="grid grid-cols-7 gap-2">
                  {shiftDays.map((day, i) => (
                    <div key={i} className="flex flex-col items-center gap-1.5">
                      <span className="text-[10px] font-bold text-on-surface-variant tracking-wide">{day.label}</span>
                      {day.isOn ? (
                        <div
                          className={`w-full rounded-lg py-3 px-1 flex flex-col items-center gap-1 ${
                            day.isNight
                              ? 'bg-primary-container text-on-primary'
                              : 'bg-secondary-container text-on-secondary-container'
                          }`}
                        >
                          <span className="text-[10px] font-bold uppercase">{day.isNight ? 'NIGHT' : 'DAY'}</span>
                          {day.start && <span className="text-[9px] opacity-80">{day.start}</span>}
                          {day.end && <span className="text-[9px] opacity-80">{day.end}</span>}
                        </div>
                      ) : (
                        <div className="w-full rounded-lg py-3 px-1 flex flex-col items-center border border-dashed border-outline-variant">
                          <span className="text-[10px] text-on-surface-variant/50">OFF</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* ══ Column 3: Context ═══════════════════════════════════════════ */}
          <div>
            <Card className="h-full">
              <CardHeader
                title="Recent Activity"
                action={
                  <Link href={`/admin/audit-log?subject=${sp.id}`} className="text-xs font-semibold text-secondary hover:underline">
                    View All
                  </Link>
                }
              />
              <div className="p-4">
                <ol className="space-y-0">
                  {feed.map((item, idx) => (
                    <li key={item.key} className="flex gap-3 relative">
                      {idx < feed.length - 1 && (
                        <div className="absolute left-[7px] top-6 bottom-0 w-[2px] bg-outline-variant/40" />
                      )}
                      <span className={`relative z-10 mt-1.5 w-3.5 h-3.5 rounded-full shrink-0 ${item.dotColor}`} />
                      <div className="flex-1 pb-5">
                        <p className="text-sm font-semibold text-on-surface leading-snug">{item.title}</p>
                        {item.subtitle && (
                          <p className="text-xs text-on-surface-variant mt-0.5 italic">{item.subtitle}</p>
                        )}
                        <p className="text-[11px] text-on-surface-variant mt-1">{item.time}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="px-5 py-3 border-t border-outline-variant">
                <Link
                  href={`/admin/audit-log?subject=${sp.id}`}
                  className="text-sm font-semibold text-secondary hover:underline"
                >
                  View All Activity
                </Link>
              </div>
            </Card>
          </div>

        </div>
      </div>

      {/* Compliance action drawer (portal-rendered) */}
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
