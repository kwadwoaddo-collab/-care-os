'use client'

import { useState }    from 'react'
import { useRouter }   from 'next/navigation'

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

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function formatTime(t: string): string {
  return t.slice(0, 5)
}

function isToday(dateStr: string): boolean {
  const today = new Date().toISOString().slice(0, 10)
  return dateStr === today
}

function isUpcoming(dateStr: string): boolean {
  const today = new Date().toISOString().slice(0, 10)
  return dateStr > today
}

const STATUS_CLS: Record<string, string> = {
  scheduled: 'bg-blue-50   text-blue-700   ring-blue-600/20',
  confirmed: 'bg-green-50  text-green-700  ring-green-600/20',
  completed: 'bg-gray-50   text-gray-600   ring-gray-500/20',
  cancelled: 'bg-red-50    text-red-700    ring-red-600/20',
  no_show:   'bg-orange-50 text-orange-700 ring-orange-600/20',
}

const TIMESHEET_STATUS_CLS: Record<string, string> = {
  pending:    'bg-gray-50   text-on-surface-variant   ring-gray-400/20',
  clocked_in: 'bg-blue-50   text-blue-700   ring-blue-600/20',
  completed:  'bg-green-50  text-green-700  ring-green-600/20',
  missed:     'bg-red-50    text-red-700    ring-red-600/20',
  adjusted:   'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
}

const TYPE_CLS: Record<string, string> = {
  day:       'bg-sky-50    text-sky-700    ring-sky-600/20',
  night:     'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  sleep_in:  'bg-purple-50 text-purple-700 ring-purple-600/20',
  live_in:   'bg-pink-50   text-pink-700   ring-pink-600/20',
  emergency: 'bg-red-50    text-red-700    ring-red-600/20',
}

const ACK_CLS: Record<string, string> = {
  accepted:     'bg-green-50  text-green-700  ring-green-600/20',
  declined:     'bg-red-50    text-red-700    ring-red-600/20',
  running_late: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
}

function Badge({ value, map }: { value: string; map: Record<string, string> }) {
  const cls = map[value] ?? 'bg-gray-50 text-gray-600 ring-gray-500/20'
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {value.replace(/_/g, ' ')}
    </span>
  )
}

// ── Unassign button ───────────────────────────────────────────────────────────

function UnassignButton({ shiftId, staffName }: { shiftId: string; staffName: string }) {
  const router  = useRouter()
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
      className="text-xs text-red-600 hover:underline disabled:opacity-40 whitespace-nowrap"
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
      className="text-xs text-indigo-600 hover:underline disabled:opacity-40"
    >
      {loading ? '…' : 'Visit Note'}
    </button>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ShiftsGrid({ shifts }: { shifts: Shift[] }) {
  const [filter, setFilter] = useState<FilterKey>('all')

  const today = new Date().toISOString().slice(0, 10)

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

  const staffName = (s: Shift) => {
    if (!s.staff_profiles) return '—'
    return (
      [s.staff_profiles.first_name, s.staff_profiles.last_name].filter(Boolean).join(' ') ||
      s.staff_profiles.email ||
      '—'
    )
  }

  return (
    <div className="space-y-3">

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={[
              'rounded-md px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors cursor-pointer',
              filter === f.key
                ? 'bg-gray-900 text-white ring-gray-900'
                : 'bg-white text-gray-600 ring-gray-300 hover:bg-gray-50',
            ].join(' ')}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-8 text-center text-sm text-gray-400">
          No shifts match this filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map((shift) => {
            const isUnassigned = !shift.assigned_staff_id;
            const shiftIsToday = isToday(shift.shift_date);
            const clientName = shift.clients ? `${shift.clients.first_name} ${shift.clients.last_name}` : (shift.client_name ?? '—');
            const shiftIdTruncated = `SH-${shift.id.slice(0, 4).toUpperCase()}`;
            
            // Determine styling based on state
            let headerBg = 'bg-surface-container-low';
            let headerBorder = 'border-outline-variant/30';
            let pillBg = 'bg-primary';
            let pillText = 'text-on-primary';
            let statusLabel = 'Assigned';
            let contextIcon = 'check_circle';
            let contextIconColor = 'text-primary';
            let contextText = shift.status.replace(/_/g, ' ');
            let contextTextColor = 'text-on-surface-variant';
            
            if (isUnassigned) {
              statusLabel = 'Unassigned';
              if (shiftIsToday) {
                // High Priority Unassigned
                headerBg = 'bg-error/5';
                headerBorder = 'border-error/10';
                pillBg = 'bg-error';
                pillText = 'text-on-error';
                contextIcon = 'warning';
                contextIconColor = 'text-error';
                contextText = 'Urgent Coverage Needed';
                contextTextColor = 'text-error';
              } else {
                // Future Unassigned
                headerBg = 'bg-tertiary-fixed/20';
                headerBorder = 'border-tertiary-fixed/30';
                pillBg = 'bg-tertiary-container';
                pillText = 'text-tertiary-fixed';
                contextIcon = 'history';
                contextIconColor = 'text-tertiary-container';
                contextText = `Starts ${formatDate(shift.shift_date)}`;
                contextTextColor = 'text-on-surface-variant';
              }
            } else if (shift.status === 'completed') {
              pillBg = 'bg-gray-500';
              contextText = 'Completed';
            }

            return (
              <div key={shift.id} className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] flex flex-col group">
                <div className={`${headerBg} p-4 border-b ${headerBorder} flex justify-between items-center`}>
                  <span className={`${pillBg} ${pillText} text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider`}>
                    {statusLabel}
                  </span>
                  <span className="text-on-surface-variant font-label-md text-[11px]">ID: {shiftIdTruncated}</span>
                </div>
                
                <div className="p-card-padding flex flex-col gap-4 flex-grow">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <h4 className="font-headline-md text-headline-md text-primary truncate">{shift.title}</h4>
                      <p className="text-body-md text-on-surface-variant flex items-center gap-1 mt-0.5">
                        <span className="material-symbols-outlined text-[16px] flex-shrink-0">pin_drop</span>
                        <span className="truncate">{shift.location || 'No location'}</span>
                      </p>
                    </div>
                    <div className="w-12 h-12 flex-shrink-0 rounded-xl bg-surface-container-low flex items-center justify-center">
                      <span className="material-symbols-outlined text-on-surface-variant">{isUnassigned ? 'person_search' : 'person'}</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 py-3 border-y border-outline-variant/30">
                    <div>
                      <p className="font-label-md text-[10px] text-on-surface-variant uppercase">Shift Time</p>
                      <p className="font-label-md text-label-md text-primary">
                        {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                      </p>
                      {shiftIsToday && <p className="text-[10px] text-blue-600 font-medium mt-0.5">Today</p>}
                    </div>
                    <div>
                      <p className="font-label-md text-[10px] text-on-surface-variant uppercase">
                        {isUnassigned ? 'Role Required' : 'Assigned To'}
                      </p>
                      <p className="font-label-md text-label-md text-secondary truncate">
                        {isUnassigned ? (shift.shift_type || 'Any') : staffName(shift)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className={`material-symbols-outlined ${contextIconColor}`}>{contextIcon}</span>
                    <p className={`text-body-md font-medium ${contextTextColor}`}>{contextText}</p>
                  </div>
                  
                  <div className="mt-auto pt-4 flex flex-col gap-2">
                    {isUnassigned ? (
                      <a href={`/admin/shifts/${shift.id}`} className="w-full text-center bg-secondary text-on-secondary font-bold py-3 rounded-xl hover:bg-secondary/90 transition-all">
                        Assign Professional
                      </a>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <a href={`/admin/shifts/${shift.id}`} className="w-full text-center border border-outline-variant text-primary font-bold py-2.5 rounded-xl hover:bg-surface-container-low transition-all">
                          Edit Assignment
                        </a>
                        <div className="flex justify-between items-center px-1">
                          <VisitNoteButton shiftId={shift.id} />
                          {shift.status !== 'completed' && shift.status !== 'cancelled' && (
                            <UnassignButton shiftId={shift.id} staffName={staffName(shift)} />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  )
}
