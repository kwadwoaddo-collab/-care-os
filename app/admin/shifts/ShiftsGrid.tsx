'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter }   from 'next/navigation'
import AssignShiftModal, { type AssignableShift } from './AssignShiftModal'
import { fmtDateDisplay, fmtTime } from '@/lib/utils/formatters'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Shift {
  id:                string
  title:             string
  shift_date:        string
  start_time:        string
  end_time:          string
  location:          string | null
  client_name:       string | null
  client_id:         string | null
  shift_type:        string | null
  status:            string
  notes:             string | null
  assigned_staff_id:  string | null
  timesheet_status:   string | null
  worker_ack_status:  string | null
  staff_profiles:    {
    id:         string
    first_name: string | null
    last_name:  string | null
    email:      string | null
  } | null
  clients: {
    id:         string
    first_name: string
    last_name:  string
  } | null
  care_package_id: string | null
  care_packages: {
    id:    string
    title: string
  } | null
}

type FilterKey = 'all' | 'today' | 'upcoming' | 'completed' | 'cancelled'

// ── Helpers ───────────────────────────────────────────────────────────────────

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().slice(0, 10)
}

function isUpcoming(dateStr: string): boolean {
  return dateStr > new Date().toISOString().slice(0, 10)
}

function staffName(shift: Shift): string {
  if (!shift.staff_profiles) return '—'
  return (
    [shift.staff_profiles.first_name, shift.staff_profiles.last_name].filter(Boolean).join(' ') ||
    shift.staff_profiles.email ||
    '—'
  )
}

// ── Status badge config ───────────────────────────────────────────────────────

interface BadgeCfg {
  label:       string
  pillCls:     string    // pill background + text
  headerBg:    string    // card header band
  leftBorder:  string    // left accent border
  urgent:      boolean
}

function getBadge(shift: Shift): BadgeCfg {
  const unassigned  = !shift.assigned_staff_id
  const today       = isToday(shift.shift_date)

  if (shift.status === 'in_progress') {
    return {
      label:      'IN PROGRESS',
      pillCls:    'bg-sky-100 text-sky-700',
      headerBg:   'bg-sky-50',
      leftBorder: 'border-l-4 border-sky-500',
      urgent:     false,
    }
  }
  if (shift.status === 'completed') {
    return {
      label:      'COMPLETED',
      pillCls:    'bg-gray-100 text-gray-500',
      headerBg:   'bg-gray-50',
      leftBorder: 'border-l-4 border-gray-400',
      urgent:     false,
    }
  }
  if (shift.status === 'cancelled') {
    return {
      label:      'CANCELLED',
      pillCls:    'bg-red-100 text-red-600',
      headerBg:   'bg-red-50',
      leftBorder: 'border-l-4 border-red-400',
      urgent:     false,
    }
  }
  if (shift.status === 'missed') {
    return {
      label:      'MISSED',
      pillCls:    'bg-orange-100 text-orange-700',
      headerBg:   'bg-orange-50',
      leftBorder: 'border-l-4 border-orange-500',
      urgent:     false,
    }
  }
  if (unassigned && today) {
    return {
      label:      'URGENT',
      pillCls:    'bg-red-600 text-white',
      headerBg:   'bg-red-50',
      leftBorder: 'border-l-4 border-red-600',
      urgent:     true,
    }
  }
  if (unassigned) {
    return {
      label:      'UNASSIGNED',
      pillCls:    'bg-amber-100 text-amber-700',
      headerBg:   'bg-amber-50',
      leftBorder: 'border-l-4 border-amber-500',
      urgent:     false,
    }
  }
  // Assigned (accepted / offered / open with staff)
  return {
    label:      'ASSIGNED',
    pillCls:    'bg-emerald-100 text-emerald-700',
    headerBg:   'bg-emerald-50',
    leftBorder: 'border-l-4 border-emerald-500',
    urgent:     false,
  }
}

// ── Delete Button ─────────────────────────────────────────────────────────────

function DeleteButton({ shiftId, shiftTitle }: { shiftId: string; shiftTitle: string }) {
  const router = useRouter()
  const [busy, setBusy]           = useState(false)
  const [showConfirm, setShow]    = useState(false)
  const popoverRef                = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showConfirm) return
    function onOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setShow(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [showConfirm])

  async function doDelete() {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/shifts/${shiftId}`, { method: 'DELETE' })
      if (res.ok) { setShow(false); router.refresh() }
    } finally { setBusy(false) }
  }

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        id={`delete-shift-${shiftId}`}
        aria-label="Delete shift"
        title="Delete shift"
        onClick={() => setShow(true)}
        className="flex items-center justify-center w-7 h-7 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 transition-colors border border-red-200"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
      </button>

      {showConfirm && (
        <div
          ref={popoverRef}
          className="absolute right-0 top-9 z-50 w-60 rounded-xl bg-white border border-outline-variant shadow-[0_8px_30px_rgba(0,0,0,0.12)] p-4 space-y-3"
        >
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-error shrink-0 mt-0.5" style={{ fontSize: 18 }}>warning</span>
            <p className="text-[13px] text-on-surface leading-snug">
              Delete <span className="font-semibold">"{shiftTitle}"</span>?{' '}
              <span className="text-on-surface-variant">This cannot be undone.</span>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShow(false)}
              className="flex-1 py-1.5 text-[12px] font-semibold rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={doDelete}
              disabled={busy}
              className="flex-1 py-1.5 text-[12px] font-semibold rounded-lg bg-error text-on-error hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {busy ? '…' : 'Delete'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Unassign Button ───────────────────────────────────────────────────────────

function UnassignButton({ shiftId, name }: { shiftId: string; name: string }) {
  const router  = useRouter()
  const [busy, setBusy] = useState(false)

  async function handle() {
    if (!window.confirm(`Remove ${name} from this shift?`)) return
    setBusy(true)
    try { await fetch(`/api/admin/shifts/${shiftId}/unassign`, { method: 'PATCH' }); router.refresh() }
    finally { setBusy(false) }
  }

  return (
    <button
      onClick={handle}
      disabled={busy}
      className="text-xs text-red-500 hover:text-red-700 hover:underline disabled:opacity-40 font-medium"
    >
      {busy ? '…' : 'Unassign'}
    </button>
  )
}

// ── Visit Note Button ─────────────────────────────────────────────────────────

function VisitNoteButton({ shiftId }: { shiftId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handle() {
    setLoading(true)
    const res  = await fetch('/api/admin/visit-notes', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ shift_id: shiftId }),
    })
    const data = await res.json() as { id?: string; note_id?: string }
    const noteId = res.status === 201 ? data.id : data.note_id
    if (noteId) router.push(`/admin/visit-notes/${noteId}`)
    else setLoading(false)
  }

  return (
    <button
      onClick={handle}
      disabled={loading}
      className="text-xs text-secondary hover:underline disabled:opacity-40 font-medium"
    >
      {loading ? '…' : 'Visit Note'}
    </button>
  )
}

// ── Shift Card ────────────────────────────────────────────────────────────────

function ShiftCard({
  shift,
  onAssign,
}: {
  shift:    Shift
  onAssign: (s: AssignableShift) => void
}) {
  const badge        = getBadge(shift)
  const isUnassigned = !shift.assigned_staff_id
  const shiftIdShort = `SH-${shift.id.slice(0, 4).toUpperCase()}`
  const clientName   = shift.clients
    ? `${shift.clients.first_name} ${shift.clients.last_name}`
    : (shift.client_name ?? null)
  const name = staffName(shift)

  const assignable: AssignableShift = {
    id:          shift.id,
    title:       shift.title,
    shift_date:  shift.shift_date,
    start_time:  shift.start_time,
    end_time:    shift.end_time,
    client_name: clientName ?? '—',
    shift_type:  shift.shift_type,
  }

  return (
    <div
      className={[
        'bg-surface-container-lowest rounded-2xl overflow-visible flex flex-col',
        'shadow-[0_4px_20px_-2px_rgba(0,0,0,0.06)] border border-outline-variant',
        badge.leftBorder,
        'transition-shadow hover:shadow-[0_8px_28px_-2px_rgba(0,0,0,0.10)]',
      ].join(' ')}
    >
      {/* ── Card Header ───────────────────────────────────────── */}
      <div className={`${badge.headerBg} px-4 py-3 flex items-center justify-between gap-2 border-b border-outline-variant/40`}>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase ${badge.pillCls}`}
        >
          {badge.urgent && (
            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping inline-block" />
          )}
          {badge.label}
        </span>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-on-surface-variant">ID: {shiftIdShort}</span>
          {/* Delete button — clearly visible red icon */}
          <DeleteButton shiftId={shift.id} shiftTitle={shift.title} />
        </div>
      </div>

      {/* ── Card Body ─────────────────────────────────────────── */}
      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* Title + person icon */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="font-headline-md text-headline-md text-primary truncate leading-snug">{shift.title}</h4>
            <p className="text-body-md text-on-surface-variant flex items-center gap-1 mt-0.5">
              <span className="material-symbols-outlined text-[15px] shrink-0">pin_drop</span>
              <span className="truncate">{shift.location || 'No location'}</span>
            </p>
          </div>
          <div className="w-10 h-10 shrink-0 rounded-xl bg-surface-container flex items-center justify-center">
            <span className="material-symbols-outlined text-on-surface-variant text-[20px]">
              {isUnassigned ? 'person_search' : 'person'}
            </span>
          </div>
        </div>

        {/* Time + Staff/Role */}
        <div className="grid grid-cols-2 gap-3 py-3 border-y border-outline-variant/30">
          <div>
            <p className="text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider mb-0.5">Shift Time</p>
            <p className="text-[13px] font-semibold text-primary tabular-nums">
              {fmtTime(shift.start_time)} – {fmtTime(shift.end_time)}
            </p>
            {isToday(shift.shift_date) && (
              <span className="inline-block mt-0.5 text-[10px] font-bold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded-full">Today</span>
            )}
          </div>
          <div>
            <p className="text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider mb-0.5">
              {isUnassigned ? 'Role Required' : 'Assigned To'}
            </p>
            <p className="text-[13px] font-semibold text-secondary truncate">
              {isUnassigned ? (shift.shift_type ?? 'Any') : name}
            </p>
          </div>
        </div>

        {/* Client if present */}
        {clientName && (
          <div className="flex items-center gap-2 text-on-surface-variant">
            <span className="material-symbols-outlined text-[15px] shrink-0">person</span>
            <span className="text-[13px] truncate">{clientName}</span>
          </div>
        )}

        {/* Context note */}
        {isUnassigned ? (
          <div className={`flex items-center gap-2 text-[13px] ${badge.urgent ? 'text-red-600' : 'text-on-surface-variant'}`}>
            <span className="material-symbols-outlined text-[16px] shrink-0">{badge.urgent ? 'warning' : 'history'}</span>
            <span>
              {badge.urgent
                ? 'Urgent — shift starts today without coverage'
                : `Starts ${fmtDateDisplay(shift.shift_date + 'T00:00:00')}`}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[13px] text-on-surface-variant">
            <span className="material-symbols-outlined text-[16px] shrink-0">check_circle</span>
            <span className="capitalize">{shift.status.replace(/_/g, ' ')}</span>
          </div>
        )}
      </div>

      {/* ── Card Footer Actions ────────────────────────────────── */}
      <div className="px-5 pb-5 mt-auto flex flex-col gap-2">
        {isUnassigned ? (
          <button
            onClick={() => onAssign(assignable)}
            className={[
              'w-full py-3 rounded-xl font-bold text-[13px] tracking-wide transition-all cursor-pointer',
              badge.urgent
                ? 'bg-error text-on-error hover:bg-red-700'
                : 'bg-secondary text-on-secondary hover:bg-secondary/90',
            ].join(' ')}
          >
            Assign Professional
          </button>
        ) : (
          <>
            <button
              onClick={() => onAssign(assignable)}
              className="w-full py-2.5 rounded-xl font-bold text-[13px] border border-outline-variant text-primary hover:bg-surface-container transition-colors cursor-pointer"
            >
              Edit Assignment
            </button>
            <div className="flex items-center justify-between px-1">
              <VisitNoteButton shiftId={shift.id} />
              {shift.status !== 'completed' && shift.status !== 'cancelled' && (
                <UnassignButton shiftId={shift.id} name={name} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main Grid Component ───────────────────────────────────────────────────────

export default function ShiftsGrid({ shifts }: { shifts: Shift[] }) {
  const [filter, setFilter]           = useState<FilterKey>('all')
  const [selectedShift, setSelected]  = useState<AssignableShift | null>(null)

  const filtered = shifts.filter((s) => {
    if (filter === 'today')     return isToday(s.shift_date)
    if (filter === 'upcoming')  return isUpcoming(s.shift_date)
    if (filter === 'completed') return s.status === 'completed'
    if (filter === 'cancelled') return s.status === 'cancelled'
    return true
  })

  const counts = {
    all:       shifts.length,
    today:     shifts.filter((s) => isToday(s.shift_date)).length,
    upcoming:  shifts.filter((s) => isUpcoming(s.shift_date)).length,
    completed: shifts.filter((s) => s.status === 'completed').length,
    cancelled: shifts.filter((s) => s.status === 'cancelled').length,
  }

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'all',       label: `All (${counts.all})` },
    { key: 'today',     label: `Today (${counts.today})` },
    { key: 'upcoming',  label: `Upcoming (${counts.upcoming})` },
    { key: 'completed', label: `Completed (${counts.completed})` },
    { key: 'cancelled', label: `Cancelled (${counts.cancelled})` },
  ]

  return (
    <div className="space-y-4">

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={[
              'rounded-md px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition-colors cursor-pointer',
              filter === f.key
                ? 'bg-primary text-on-primary ring-primary'
                : 'bg-surface-container-lowest text-on-surface-variant ring-outline-variant hover:bg-surface-container',
            ].join(' ')}
          >
            {f.label}
          </button>
        ))}
      </div>

      {selectedShift && (
        <AssignShiftModal
          shift={selectedShift}
          onClose={() => setSelected(null)}
          onAssigned={() => setSelected(null)}
        />
      )}

      {/* Grid or empty state */}
      {filtered.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-10 text-center space-y-3">
          <span className="material-symbols-outlined text-[40px] text-on-surface-variant block">calendar_today</span>
          <p className="text-sm font-semibold text-primary">
            {filter === 'all' ? 'No shifts yet' : 'No shifts match this filter'}
          </p>
          <p className="text-xs text-on-surface-variant max-w-xs mx-auto">
            {filter === 'all'
              ? 'Create shifts manually or generate them from a care package.'
              : 'Try a different filter or clear the current one to see all shifts.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map((shift) => (
            <ShiftCard
              key={shift.id}
              shift={shift}
              onAssign={setSelected}
            />
          ))}
        </div>
      )}
    </div>
  )
}
