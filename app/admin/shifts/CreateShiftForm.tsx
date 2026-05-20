'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReadyStaff {
  id:         string
  first_name: string | null
  last_name:  string | null
  email:      string | null
  readiness:  { ready: boolean; score: number }
}

export interface ActiveClient {
  id:         string
  first_name: string
  last_name:  string
}

interface CreateShiftFormProps {
  companyId:     string
  readyStaff:    ReadyStaff[]
  activeClients: ActiveClient[]
}

const SHIFT_TYPES = [
  { value: 'day',       label: 'Day' },
  { value: 'night',     label: 'Night' },
  { value: 'sleep_in',  label: 'Sleep-in' },
  { value: 'live_in',   label: 'Live-in' },
  { value: 'emergency', label: 'Emergency' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function CreateShiftForm({ companyId, readyStaff, activeClients }: CreateShiftFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [blockers, setBlockers] = useState<string[]>([])

  const [form, setForm] = useState({
    title:             '',
    shift_date:        '',
    start_time:        '',
    end_time:          '',
    location:          '',
    client_name:       '',
    client_id:         '',
    shift_type:        '',
    assigned_staff_id: '',
    notes:             '',
  })

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setError(null)
    setBlockers([])
  }

  const isOvernight =
    form.start_time !== '' &&
    form.end_time   !== '' &&
    form.end_time <= form.start_time

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBlockers([])

    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/shifts', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            company_id:        companyId,
            title:             form.title,
            shift_date:        form.shift_date,
            start_time:        form.start_time,
            end_time:          form.end_time,
            location:          form.location              || null,
            client_name:       form.client_name           || null,
            client_id:         form.client_id             || null,
            shift_type:        form.shift_type            || null,
            assigned_staff_id: form.assigned_staff_id     || null,
            notes:             form.notes                 || null,
          }),
        })

        const json = await res.json() as {
          error?:    string
          blockers?: string[]
        }

        if (!res.ok) {
          setError(json.error ?? 'Failed to create shift.')
          if (json.blockers) setBlockers(json.blockers)
          return
        }

        setOpen(false)
        setForm({
          title: '', shift_date: '', start_time: '', end_time: '',
          location: '', client_name: '', client_id: '', shift_type: '',
          assigned_staff_id: '', notes: '',
        })
        router.refresh()
      } catch {
        setError('Network error — please try again.')
      }
    })
  }

  const staffDisplayName = (s: ReadyStaff) =>
    [s.first_name, s.last_name].filter(Boolean).join(' ') || s.email || s.id

  return (
    <>
      <button
        type="button"
        data-testid="create-shift-btn"
        onClick={() => setOpen(true)}
        className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
      >
        + Create Shift
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg bg-surface-container-lowest rounded-xl shadow-xl overflow-hidden">

            {/* Header */}
            <div className="bg-gray-50 border-b border-gray-200 px-5 py-3.5 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">Create shift</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto max-h-[80vh]">

              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
                <input
                  required
                  type="text"
                  data-testid="create-shift-title"
                  value={form.title}
                  onChange={(e) => set('title', e.target.value)}
                  placeholder="e.g. Morning care visit"
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Date *</label>
                <input
                  required
                  type="date"
                  data-testid="create-shift-date"
                  value={form.shift_date}
                  onChange={(e) => set('shift_date', e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Times */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Start time *</label>
                  <input
                    required
                    type="time"
                    data-testid="create-shift-start"
                    value={form.start_time}
                    onChange={(e) => set('start_time', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">End time *</label>
                  <input
                    required
                    type="time"
                    data-testid="create-shift-end"
                    value={form.end_time}
                    onChange={(e) => set('end_time', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Overnight notice */}
              {isOvernight && (
                <p className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-md px-3 py-2">
                  The end time is earlier than the start time — this shift will be treated as ending the next day.
                </p>
              )}

              {/* Shift type */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Shift type</label>
                <select
                  value={form.shift_type}
                  onChange={(e) => set('shift_type', e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">— Select type —</option>
                  {SHIFT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Assigned staff */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Assign staff
                  <span className="ml-1 font-normal text-gray-400">(only ready staff shown)</span>
                </label>
                <select
                  value={form.assigned_staff_id}
                  onChange={(e) => set('assigned_staff_id', e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">— Unassigned —</option>
                  {readyStaff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {staffDisplayName(s)} ({s.readiness.score}%)
                    </option>
                  ))}
                </select>
                {readyStaff.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600">
                    No staff are currently ready to be assigned.
                  </p>
                )}
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => set('location', e.target.value)}
                  placeholder="e.g. 12 Oak Street, Birmingham"
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Client */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Client
                  <span className="ml-1 font-normal text-gray-400">(optional)</span>
                </label>
                {activeClients.length > 0 ? (
                  <select
                    value={form.client_id}
                    onChange={(e) => set('client_id', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">— No client —</option>
                    {activeClients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.first_name} {c.last_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={form.client_name}
                    onChange={(e) => set('client_name', e.target.value)}
                    placeholder="e.g. Mr. Smith"
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                  <p className="font-medium">{error}</p>
                  {blockers.length > 0 && (
                    <ul className="mt-1 space-y-0.5 list-disc list-inside">
                      {blockers.map((b) => <li key={b}>{b}</li>)}
                    </ul>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="create-shift-submit"
                  disabled={isPending}
                  className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isPending ? 'Creating…' : 'Create shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
