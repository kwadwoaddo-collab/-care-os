'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ClientOption {
  id:         string
  first_name: string
  last_name:  string
}

interface VisitRow {
  day_of_week:        number
  start_time:         string
  end_time:           string
  shift_type:         string
  requires_driver:    boolean
  requires_double_up: boolean
  notes:              string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

const SHIFT_TYPES = [
  { value: 'day',       label: 'Day' },
  { value: 'night',     label: 'Night' },
  { value: 'sleep_in',  label: 'Sleep-in' },
  { value: 'live_in',   label: 'Live-in' },
  { value: 'emergency', label: 'Emergency' },
]

const FUNDING_TYPES = [
  { value: 'private',         label: 'Private' },
  { value: 'local_authority', label: 'Local authority' },
  { value: 'nhs',             label: 'NHS' },
  { value: 'direct_payment',  label: 'Direct payment' },
  { value: 'other',           label: 'Other' },
]

const PKG_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'draft',  label: 'Draft' },
  { value: 'paused', label: 'Paused' },
  { value: 'ended',  label: 'Ended' },
]

const emptyVisit = (): VisitRow => ({
  day_of_week:        1,
  start_time:         '',
  end_time:           '',
  shift_type:         '',
  requires_driver:    false,
  requires_double_up: false,
  notes:              '',
})

const emptyForm = {
  client_id:    '',
  title:        '',
  description:  '',
  start_date:   '',
  end_date:     '',
  status:       'active',
  funding_type: '',
  weekly_hours: '',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CreateCarePackageForm({ clients }: { clients: ClientOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [visits, setVisits] = useState<VisitRow[]>([])

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function addVisit() {
    setVisits((prev) => [...prev, emptyVisit()])
  }

  function removeVisit(idx: number) {
    setVisits((prev) => prev.filter((_, i) => i !== idx))
  }

  function setVisit(idx: number, field: keyof VisitRow, value: string | boolean | number) {
    setVisits((prev) => prev.map((v, i) => i === idx ? { ...v, [field]: value } : v))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/care-packages', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id:    form.client_id,
            title:        form.title,
            description:  form.description  || null,
            start_date:   form.start_date,
            end_date:     form.end_date      || null,
            status:       form.status,
            funding_type: form.funding_type  || null,
            weekly_hours: form.weekly_hours  ? parseFloat(form.weekly_hours) : null,
            visits: visits.map((v) => ({
              day_of_week:        v.day_of_week,
              start_time:         v.start_time,
              end_time:           v.end_time,
              shift_type:         v.shift_type         || null,
              requires_driver:    v.requires_driver,
              requires_double_up: v.requires_double_up,
              notes:              v.notes              || null,
            })),
          }),
        })

        const json = await res.json() as { error?: string }
        if (!res.ok) {
          setError(json.error ?? 'Failed to create care package.')
          return
        }

        setOpen(false)
        setForm(emptyForm)
        setVisits([])
        router.refresh()
      } catch {
        setError('Network error — please try again.')
      }
    })
  }

  const inputCls = 'w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors"
      >
        + Create Care Package
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-xl overflow-hidden">

            <div className="bg-gray-50 border-b border-gray-200 px-5 py-3.5 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">Create care package</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-5 overflow-y-auto max-h-[80vh]">

              {/* Package details */}
              <fieldset className="space-y-3">
                <legend className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Package details</legend>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Client *</label>
                  <select required value={form.client_id} onChange={(e) => set('client_id', e.target.value)} className={inputCls}>
                    <option value="">— Select client —</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
                  <input required type="text" value={form.title} onChange={(e) => set('title', e.target.value)}
                    placeholder="e.g. Morning and evening care" className={inputCls} />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                  <textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)}
                    className={`${inputCls} resize-none`} />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                    <select value={form.status} onChange={(e) => set('status', e.target.value)} className={inputCls}>
                      {PKG_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Funding type</label>
                    <select value={form.funding_type} onChange={(e) => set('funding_type', e.target.value)} className={inputCls}>
                      <option value="">— Select —</option>
                      {FUNDING_TYPES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Weekly hours</label>
                    <input type="number" min="0" step="0.5" value={form.weekly_hours}
                      onChange={(e) => set('weekly_hours', e.target.value)} className={inputCls} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Start date *</label>
                    <input required type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">End date</label>
                    <input type="date" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} className={inputCls} />
                  </div>
                </div>
              </fieldset>

              {/* Visit builder */}
              <fieldset className="space-y-3">
                <div className="flex items-center justify-between">
                  <legend className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                    Recurring visits{visits.length > 0 && ` (${visits.length})`}
                  </legend>
                  <button
                    type="button"
                    onClick={addVisit}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    + Add visit
                  </button>
                </div>

                {visits.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-3 border border-dashed border-gray-200 rounded-md">
                    No visits added. Click + Add visit to define the recurring schedule.
                  </p>
                )}

                {visits.map((v, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-3 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600">Visit {idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeVisit(idx)}
                        className="text-xs text-red-500 hover:text-red-700 transition-colors"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Day *</label>
                        <select
                          required
                          value={v.day_of_week}
                          onChange={(e) => setVisit(idx, 'day_of_week', parseInt(e.target.value))}
                          className={inputCls}
                        >
                          {DAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Start *</label>
                        <input
                          required
                          type="time"
                          value={v.start_time}
                          onChange={(e) => setVisit(idx, 'start_time', e.target.value)}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">End *</label>
                        <input
                          required
                          type="time"
                          value={v.end_time}
                          onChange={(e) => setVisit(idx, 'end_time', e.target.value)}
                          className={inputCls}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Shift type</label>
                        <select
                          value={v.shift_type}
                          onChange={(e) => setVisit(idx, 'shift_type', e.target.value)}
                          className={inputCls}
                        >
                          <option value="">— Any —</option>
                          {SHIFT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-col justify-end gap-1.5 pb-0.5">
                        <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={v.requires_driver}
                            onChange={(e) => setVisit(idx, 'requires_driver', e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          Requires driver
                        </label>
                        <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={v.requires_double_up}
                            onChange={(e) => setVisit(idx, 'requires_double_up', e.target.checked)}
                            className="rounded border-gray-300"
                          />
                          Requires double-up
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                      <input
                        type="text"
                        value={v.notes}
                        onChange={(e) => setVisit(idx, 'notes', e.target.value)}
                        placeholder="Optional visit notes"
                        className={inputCls}
                      />
                    </div>
                  </div>
                ))}
              </fieldset>

              {error && (
                <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}

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
                  disabled={isPending}
                  className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isPending ? 'Creating…' : 'Create package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
