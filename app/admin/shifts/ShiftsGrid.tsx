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
  const today = new Date().toISOString().slice(0, 10)
  return dateStr === today
}

function isUpcoming(dateStr: string): boolean {
  const today = new Date().toISOString().slice(0, 10)
  return dateStr > today
}

// ── Status config ─────────────────────────────────────────────────────────────

interface StatusConfig {
  badge: string
  dot: string
  border: string
  cardGlow: string
  label: string
  pulse: boolean
}

function getStatusConfig(shift: Shift): StatusConfig {
  const isUnassigned = !shift.assigned_staff_id
  const shiftIsToday = isToday(shift.shift_date)

  if (shift.status === 'in_progress') {
    return {
      badge: 'bg-blue-500/10 text-blue-400',
      dot: 'bg-blue-400',
      border: 'border-blue-500/30 hover:border-blue-400',
      cardGlow: 'before:absolute before:-top-10 before:-right-10 before:w-32 before:h-32 before:bg-primary/5 before:blur-3xl before:pointer-events-none',
      label: 'In Progress',
      pulse: true,
    }
  }
  if (shift.status === 'completed') {
    return {
      badge: 'bg-gray-500/10 text-gray-400',
      dot: 'bg-gray-400',
      border: 'border-white/10 hover:border-white/20',
      cardGlow: '',
      label: 'Completed',
      pulse: false,
    }
  }
  if (shift.status === 'cancelled' || shift.status === 'missed') {
    return {
      badge: 'bg-red-500/10 text-red-400',
      dot: 'bg-red-400',
      border: 'border-red-500/20 hover:border-red-400/40',
      cardGlow: '',
      label: shift.status === 'cancelled' ? 'Cancelled' : 'Missed',
      pulse: false,
    }
  }
  if (isUnassigned && shiftIsToday) {
    return {
      badge: 'bg-red-500/10 text-red-400',
      dot: 'bg-red-400',
      border: 'border-red-500/30 hover:border-red-400',
      cardGlow: '',
      label: 'Urgent Unassigned',
      pulse: true,
    }
  }
  if (isUnassigned) {
    return {
      badge: 'bg-orange-500/10 text-orange-400',
      dot: 'bg-orange-400',
      border: 'border-white/10 hover:border-orange-400/40',
      cardGlow: '',
      label: 'Unassigned',
      pulse: false,
    }
  }
  // Assigned
  return {
    badge: 'bg-emerald-500/10 text-emerald-400',
    dot: 'bg-emerald-400',
    border: 'border-white/10 hover:border-primary/40',
    cardGlow: '',
    label: 'Assigned',
    pulse: false,
  }
}

// ── Delete Button ─────────────────────────────────────────────────────────────

function DeleteButton({ shiftId, shiftTitle }: { shiftId: string; shiftTitle: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!showConfirm) return
    function handler(e: MouseEvent) {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        setShowConfirm(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showConfirm])

  async function handleDelete() {
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/shifts/${shiftId}`, { method: 'DELETE' })
      if (res.ok) {
        setShowConfirm(false)
        router.refresh()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setShowConfirm(true) }}
        className="text-on-surface-variant hover:text-error transition-colors p-1 rounded"
        title="Delete shift"
        aria-label="Delete shift"
      >
        <span className="material-symbols-outlined text-[18px]">delete</span>
      </button>

      {showConfirm && (
        <div
          ref={dialogRef}
          className="absolute right-0 top-8 z-50 w-56 rounded-xl border border-error/30 bg-[rgba(39,39,42,0.97)] backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.6)] p-4 flex flex-col gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-error text-[18px] mt-0.5 shrink-0">warning</span>
            <p className="text-[12px] text-on-surface-variant leading-relaxed">
              Delete <span className="font-semibold text-on-surface">"{shiftTitle}"</span>? This cannot be undone.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowConfirm(false)}
              className="flex-1 py-1.5 text-[12px] font-semibold rounded-lg bg-white/5 border border-white/10 text-on-surface-variant hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={busy}
              className="flex-1 py-1.5 text-[12px] font-semibold rounded-lg bg-error text-on-error hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {busy ? '…' : 'Delete'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Unassign button ───────────────────────────────────────────────────────────

function UnassignButton({ shiftId, staffName }: { shiftId: string; staffName: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleUnassign() {
    if (!window.confirm(`Remove ${staffName} from this shift?`)) return
    setBusy(true)
    try {
      await fetch(`/api/admin/shifts/${shiftId}/unassign`, { method: 'PATCH' })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={handleUnassign}
      disabled={busy}
      className="flex-1 py-2 text-label-md font-label-md rounded-lg bg-surface-container border border-white/10 text-error hover:bg-error/10 transition-colors disabled:opacity-40"
    >
      {busy ? '…' : 'Unassign'}
    </button>
  )
}

// ── Visit Note button ─────────────────────────────────────────────────────────

function VisitNoteButton({ shiftId }: { shiftId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    const res = await fetch('/api/admin/visit-notes', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ shift_id: shiftId }),
    })
    const data = await res.json() as { id?: string; note_id?: string }
    const noteId = res.status === 201 ? data.id : data.note_id
    if (noteId) {
      router.push(`/admin/visit-notes/${noteId}`)
    } else {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex-1 py-2 text-label-md font-label-md rounded-lg bg-surface-container border border-white/10 text-on-surface-variant hover:bg-white/5 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
    >
      <span className="material-symbols-outlined text-[14px]">note_alt</span>
      {loading ? '…' : 'Note'}
    </button>
  )
}

// ── Context note ──────────────────────────────────────────────────────────────

function ContextNote({ shift }: { shift: Shift }) {
  const isUnassigned = !shift.assigned_staff_id
  const shiftIsToday = isToday(shift.shift_date)

  if (shift.status === 'in_progress') {
    return (
      <div className="mt-4 p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider">Live</span>
        </div>
        <p className="text-[12px] text-on-surface-variant leading-relaxed">Shift currently active</p>
      </div>
    )
  }
  if (isUnassigned && shiftIsToday) {
    return (
      <div className="mt-4 p-3 rounded-lg bg-error/5 border border-error/10">
        <p className="text-[12px] text-error leading-relaxed">
          <span className="font-semibold">Alert:</span> Today's shift needs coverage now.
        </p>
      </div>
    )
  }
  if (isUnassigned) {
    return (
      <div className="mt-4 p-3 rounded-lg bg-surface-container-high/50 border border-white/5">
        <p className="text-[12px] text-on-surface-variant leading-relaxed">
          <span className="font-semibold text-primary/70">Starts:</span>{' '}
          {fmtDateDisplay(shift.shift_date + 'T00:00:00')}
        </p>
      </div>
    )
  }
  return (
    <div className="mt-4 p-3 rounded-lg bg-surface-container-high/50 border border-white/5">
      <p className="text-[12px] text-on-surface-variant leading-relaxed">
        <span className="font-semibold text-primary/70">Status:</span>{' '}
        {shift.status.replace(/_/g, ' ')}
      </p>
    </div>
  )
}

// ── Shift Card ────────────────────────────────────────────────────────────────

function ShiftCard({
  shift,
  onAssign,
}: {
  shift: Shift
  onAssign: (s: AssignableShift) => void
}) {
  const isUnassigned = !shift.assigned_staff_id
  const cfg = getStatusConfig(shift)
  const shiftIdTruncated = `SH-${shift.id.slice(0, 4).toUpperCase()}`

  const staffName = shift.staff_profiles
    ? [shift.staff_profiles.first_name, shift.staff_profiles.last_name].filter(Boolean).join(' ') ||
      shift.staff_profiles.email ||
      '—'
    : '—'

  const clientName = shift.clients
    ? `${shift.clients.first_name} ${shift.clients.last_name}`
    : (shift.client_name ?? null)

  const assignableShift: AssignableShift = {
    id:         shift.id,
    title:      shift.title,
    shift_date: shift.shift_date,
    start_time: shift.start_time,
    end_time:   shift.end_time,
    client_name: clientName ?? '—',
    shift_type: shift.shift_type,
  }

  return (
    <div
      className={[
        'relative flex flex-col rounded-xl overflow-visible',
        'border transition-all duration-300',
        'bg-[rgba(24,24,27,0.8)] backdrop-blur-xl',
        cfg.border,
        cfg.cardGlow,
      ].join(' ')}
    >
      {/* Card body */}
      <div className="p-5 flex-1 relative overflow-hidden">
        {/* Header row */}
        <div className="flex justify-between items-start mb-4">
          {/* Status badge */}
          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${cfg.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${cfg.pulse ? 'animate-ping' : ''}`} />
            {cfg.label}
          </span>
          {/* ID + Delete */}
          <div className="flex items-center gap-2">
            <span className="text-on-surface-variant font-label-md text-[11px]">#{shiftIdTruncated}</span>
            <DeleteButton shiftId={shift.id} shiftTitle={shift.title} />
          </div>
        </div>

        {/* Title */}
        <h4 className="text-[18px] font-semibold leading-snug mb-4 text-on-surface truncate">{shift.title}</h4>

        {/* Details */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-3 text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px] shrink-0">location_on</span>
            <span className="text-[14px] truncate">{shift.location || 'No location'}</span>
          </div>
          <div className="flex items-center gap-3 text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px] shrink-0">schedule</span>
            <span className="text-[14px]">
              {fmtTime(shift.start_time)} – {fmtTime(shift.end_time)}
              {isToday(shift.shift_date) && (
                <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full">Today</span>
              )}
            </span>
          </div>
          {isUnassigned ? (
            <div className="flex items-center gap-3 text-primary-fixed-dim">
              <span className="material-symbols-outlined text-[18px] shrink-0">medical_information</span>
              <span className="text-[14px]">Role Required: {shift.shift_type ?? 'Any'}</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[18px] text-emerald-400 shrink-0">person_check</span>
              <span className="text-[14px] text-on-surface truncate">{staffName}</span>
            </div>
          )}
          {clientName && (
            <div className="flex items-center gap-3 text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px] shrink-0">person</span>
              <span className="text-[14px] truncate">{clientName}</span>
            </div>
          )}
        </div>

        {/* Context note */}
        <ContextNote shift={shift} />
      </div>

      {/* Footer actions */}
      <div className="p-4 border-t border-white/5 bg-white/[0.02]">
        {isUnassigned ? (
          <button
            onClick={() => onAssign(assignableShift)}
            className={[
              'w-full py-2.5 rounded-lg font-semibold text-[13px] transition-all',
              (shift.status === 'open' || shift.status === 'declined') && isToday(shift.shift_date)
                ? 'bg-error text-white hover:opacity-90 shadow-lg shadow-error/20'
                : 'bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white hover:opacity-90 shadow-lg shadow-indigo-500/20',
            ].join(' ')}
          >
            Assign Professional
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => onAssign(assignableShift)}
              className="w-full py-2 rounded-lg text-[13px] font-semibold bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors"
            >
              Edit Assignment
            </button>
            <div className="flex gap-2">
              <VisitNoteButton shiftId={shift.id} />
              {shift.status !== 'completed' && shift.status !== 'cancelled' && (
                <UnassignButton shiftId={shift.id} staffName={staffName} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ShiftsGrid({ shifts }: { shifts: Shift[] }) {
  const [filter, setFilter] = useState<FilterKey>('all')
  const [selectedShift, setSelectedShift] = useState<AssignableShift | null>(null)

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
              'rounded-full px-3.5 py-1.5 text-[12px] font-semibold tracking-wide transition-all cursor-pointer',
              filter === f.key
                ? 'bg-primary/20 text-primary border border-primary/30 shadow-sm shadow-primary/10'
                : 'bg-white/5 text-on-surface-variant border border-white/10 hover:bg-white/10 hover:text-on-surface',
            ].join(' ')}
          >
            {f.label}
          </button>
        ))}
      </div>

      {selectedShift && (
        <AssignShiftModal
          shift={selectedShift}
          onClose={() => setSelectedShift(null)}
          onAssigned={() => setSelectedShift(null)}
        />
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-[rgba(24,24,27,0.8)] backdrop-blur-xl p-10 text-center space-y-3">
          <span className="material-symbols-outlined text-[40px] text-on-surface-variant block">calendar_today</span>
          <p className="text-[15px] font-semibold text-on-surface">
            {filter === 'all' ? 'No shifts yet' : 'No shifts match this filter'}
          </p>
          <p className="text-[13px] text-on-surface-variant max-w-xs mx-auto">
            {filter === 'all'
              ? 'Create shifts manually or generate them from a care package.'
              : 'Try a different filter or clear the current one to see all shifts.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((shift) => (
            <ShiftCard
              key={shift.id}
              shift={shift}
              onAssign={setSelectedShift}
            />
          ))}
        </div>
      )}
    </div>
  )
}
