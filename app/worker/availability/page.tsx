'use client'

import { useEffect, useState } from 'react'
import {
  DAY_KEYS,
  DEFAULT_DAY,
  type DayAvailability,
  type DayKey,
  type StaffAvailability,
  parseAvailabilityRecord,
} from '@/lib/staff/types'

const DAY_LABELS: Record<DayKey, string> = {
  monday:    'Monday',
  tuesday:   'Tuesday',
  wednesday: 'Wednesday',
  thursday:  'Thursday',
  friday:    'Friday',
  saturday:  'Saturday',
  sunday:    'Sunday',
}

const SHIFT_TYPES = [
  { value: '',               label: '— Select —' },
  { value: 'days',           label: 'Days' },
  { value: 'nights',         label: 'Nights' },
  { value: 'mixed',          label: 'Mixed' },
  { value: 'weekends_only',  label: 'Weekends only' },
  { value: 'flexible',       label: 'Flexible' },
]

function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-gray-100 rounded w-40" />
      <div className="space-y-2">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-xl" />
        ))}
      </div>
      <div className="h-12 bg-gray-100 rounded-xl" />
    </div>
  )
}

function DayCard({
  day, availability, onChange, disabled,
}: {
  day:          DayKey
  availability: DayAvailability
  onChange:     (field: keyof DayAvailability, value: unknown) => void
  disabled:     boolean
}) {
  return (
    <div className={`rounded-xl border p-4 transition-colors ${availability.available ? 'bg-surface-container-lowest border-gray-200' : 'bg-gray-50 border-gray-200'}`}>
      {/* Day toggle row */}
      <label className="flex items-center justify-between cursor-pointer gap-3">
        <span className="text-sm font-semibold text-gray-900">{DAY_LABELS[day]}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs font-medium ${availability.available ? 'text-green-600' : 'text-gray-400'}`}>
            {availability.available ? 'Available' : 'Not available'}
          </span>
          {/* Toggle switch */}
          <div
            role="checkbox"
            aria-checked={availability.available}
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') onChange('available', !availability.available) }}
            onClick={() => onChange('available', !availability.available)}
            className={`relative w-11 h-6 rounded-full cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${availability.available ? 'bg-indigo-600' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-surface-container-lowest shadow transition-transform ${availability.available ? 'translate-x-5' : 'translate-x-0'}`} />
          </div>
        </div>
      </label>

      {/* Time pickers — only shown when available */}
      {availability.available && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${day}-start`} className="block text-xs font-medium text-gray-500 mb-1">
                Start time
              </label>
              <input
                id={`${day}-start`}
                type="time"
                value={availability.start_time}
                onChange={(e) => onChange('start_time', e.target.value)}
                disabled={disabled}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-40"
              />
            </div>
            <div>
              <label htmlFor={`${day}-end`} className="block text-xs font-medium text-gray-500 mb-1">
                End time
              </label>
              <input
                id={`${day}-end`}
                type="time"
                value={availability.end_time}
                onChange={(e) => onChange('end_time', e.target.value)}
                disabled={disabled}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-40"
              />
            </div>
          </div>
          <div>
            <input
              type="text"
              value={availability.notes}
              onChange={(e) => onChange('notes', e.target.value)}
              disabled={disabled}
              placeholder="Notes for this day (optional)"
              className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-40 placeholder:text-gray-400"
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default function WorkerAvailabilityPage() {
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [saved,    setSaved]    = useState(false)
  const [saveErr,  setSaveErr]  = useState<string | null>(null)
  const [token,    setToken]    = useState('')

  const [days, setDays] = useState<Record<DayKey, DayAvailability>>(
    () => Object.fromEntries(DAY_KEYS.map((d) => [d, { ...DEFAULT_DAY }])) as Record<DayKey, DayAvailability>
  )
  const [maxHours,        setMaxHours]        = useState('')
  const [shiftType,       setShiftType]       = useState('')
  const [canWorkNights,   setCanWorkNights]   = useState(false)
  const [canWorkWeekends, setCanWorkWeekends] = useState(false)
  const [isDriver,        setIsDriver]        = useState(false)
  const [hasOwnCar,       setHasOwnCar]       = useState(false)
  const [workAreas,       setWorkAreas]       = useState('')
  const [notes,           setNotes]           = useState('')

  useEffect(() => {
    const t = sessionStorage.getItem('worker_token')
    if (!t) {
      setError('Session expired. Please use your portal link again.')
      setLoading(false)
      return
    }
    setToken(t)

    fetch(`/api/worker/availability?token=${encodeURIComponent(t)}`)
      .then(async (res) => {
        const data = await res.json() as Record<string, unknown>
        if (!res.ok) {
          setError((data as { error?: string }).error ?? 'Failed to load availability.')
          return
        }
        const parsed = parseAvailabilityRecord('', data)
        setDays(
          Object.fromEntries(DAY_KEYS.map((d) => [d, parsed[d] ?? { ...DEFAULT_DAY }])) as Record<DayKey, DayAvailability>
        )
        setMaxHours(parsed.max_weekly_hours?.toString() ?? '')
        setShiftType(parsed.preferred_shift_type ?? '')
        setCanWorkNights(parsed.can_work_nights)
        setCanWorkWeekends(parsed.can_work_weekends)
        setIsDriver(parsed.is_driver)
        setHasOwnCar(parsed.has_own_car)
        setWorkAreas(parsed.work_areas.join(', '))
        setNotes(parsed.notes ?? '')
      })
      .catch(() => setError('Network error — please try again.'))
      .finally(() => setLoading(false))
  }, [])

  function updateDay(day: DayKey, field: keyof DayAvailability, value: unknown) {
    setDays((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }))
  }

  async function handleSave() {
    setSaving(true)
    setSaveErr(null)
    setSaved(false)

    const payload: Partial<StaffAvailability> & { token: string } = {
      token,
      ...days,
      max_weekly_hours:     maxHours ? parseInt(maxHours, 10) : null,
      preferred_shift_type: shiftType || null,
      can_work_nights:      canWorkNights,
      can_work_weekends:    canWorkWeekends,
      is_driver:            isDriver,
      has_own_car:          hasOwnCar,
      work_areas:           workAreas.split(',').map((s) => s.trim()).filter(Boolean),
      unavailable_dates:    [],
      notes:                notes || null,
    }

    try {
      const res = await fetch('/api/worker/availability', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(json.error ?? 'Save failed')
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Skeleton />

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>
    )
  }

  const availableCount = DAY_KEYS.filter((d) => days[d].available).length

  return (
    <div className="space-y-5 pb-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">My Availability</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {availableCount} of 7 days available
        </p>
      </div>

      {/* Day cards */}
      <section>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Weekly schedule</p>
        <div className="space-y-2">
          {DAY_KEYS.map((day) => (
            <DayCard
              key={day}
              day={day}
              availability={days[day]}
              onChange={(field, value) => updateDay(day, field, value)}
              disabled={saving}
            />
          ))}
        </div>
      </section>

      {/* Preferences */}
      <section className="bg-surface-container-lowest rounded-2xl border border-gray-200 p-4 space-y-4">
        <p className="text-sm font-semibold text-gray-700">Preferences</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="max-hours" className="block text-sm font-medium text-gray-700 mb-1.5">
              Max weekly hours
            </label>
            <input
              id="max-hours"
              type="number"
              min={0}
              max={168}
              value={maxHours}
              onChange={(e) => setMaxHours(e.target.value)}
              placeholder="e.g. 40"
              className="block w-full rounded-xl border border-gray-300 px-3 py-3 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div>
            <label htmlFor="shift-type" className="block text-sm font-medium text-gray-700 mb-1.5">
              Preferred shifts
            </label>
            <select
              id="shift-type"
              value={shiftType}
              onChange={(e) => setShiftType(e.target.value)}
              className="block w-full rounded-xl border border-gray-300 px-3 py-3 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              {SHIFT_TYPES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Toggles */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Can work nights',   state: canWorkNights,   set: setCanWorkNights },
            { label: 'Can work weekends', state: canWorkWeekends, set: setCanWorkWeekends },
            { label: 'Driver',            state: isDriver,        set: setIsDriver },
            { label: 'Has own car',       state: hasOwnCar,       set: setHasOwnCar },
          ].map(({ label, state, set }) => (
            <label
              key={label}
              className="flex items-center gap-3 cursor-pointer rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 select-none"
            >
              <input
                type="checkbox"
                checked={state}
                onChange={(e) => set(e.target.checked)}
                className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
        </div>

        <div>
          <label htmlFor="work-areas" className="block text-sm font-medium text-gray-700 mb-1.5">
            Work areas <span className="font-normal text-gray-400">(comma separated)</span>
          </label>
          <input
            id="work-areas"
            type="text"
            value={workAreas}
            onChange={(e) => setWorkAreas(e.target.value)}
            placeholder="e.g. North London, Hackney, Islington"
            className="block w-full rounded-xl border border-gray-300 px-3 py-3 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1.5">
            Additional notes
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Any additional information for your manager…"
            className="block w-full rounded-xl border border-gray-300 px-3 py-3 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </section>

      {/* Feedback */}
      {saveErr && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{saveErr}</div>
      )}
      {saved && (
        <div data-testid="availability-save-ok" className="rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-700 font-medium">
          ✓ Availability saved.
        </div>
      )}

      <button
        data-testid="save-availability-btn"
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-xl bg-indigo-600 py-3.5 text-base font-semibold text-white hover:bg-indigo-500 active:scale-95 transition-all disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save Availability'}
      </button>
    </div>
  )
}
