'use client'

import { useState } from 'react'
import {
  DAY_KEYS,
  DEFAULT_DAY,
  type DayAvailability,
  type DayKey,
  type StaffAvailability,
} from '@/lib/staff/types'

// ── Day label map ─────────────────────────────────────────────────────────────

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
  { value: '',              label: '— Select —' },
  { value: 'days',          label: 'Days' },
  { value: 'nights',        label: 'Nights' },
  { value: 'mixed',         label: 'Mixed' },
  { value: 'weekends_only', label: 'Weekends only' },
  { value: 'flexible',      label: 'Flexible' },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
      />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  staffProfileId: string
  initial:        StaffAvailability
}

export default function StaffAvailabilitySection({ staffProfileId, initial }: Props) {
  const [days, setDays] = useState<Record<DayKey, DayAvailability>>(
    () => Object.fromEntries(
      DAY_KEYS.map((d) => [d, initial[d] ?? { ...DEFAULT_DAY }])
    ) as Record<DayKey, DayAvailability>
  )

  const [maxHours,        setMaxHours]        = useState(initial.max_weekly_hours?.toString() ?? '')
  const [shiftType,       setShiftType]       = useState(initial.preferred_shift_type ?? '')
  const [canWorkNights,   setCanWorkNights]   = useState(initial.can_work_nights)
  const [canWorkWeekends, setCanWorkWeekends] = useState(initial.can_work_weekends)
  const [isDriver,        setIsDriver]        = useState(initial.is_driver)
  const [hasOwnCar,       setHasOwnCar]       = useState(initial.has_own_car)
  const [workAreas,       setWorkAreas]       = useState(initial.work_areas.join(', '))
  const [unavailDates,    setUnavailDates]    = useState(initial.unavailable_dates.join('\n'))
  const [notes,           setNotes]           = useState(initial.notes ?? '')

  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)

  function updateDay(day: DayKey, field: keyof DayAvailability, value: unknown) {
    setDays((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }))
  }

  async function handleSave() {
    setSaving(true)
    setSaveErr(null)
    setSaved(false)

    try {
      const res = await fetch(`/api/admin/staff/${staffProfileId}/availability`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...days,
          max_weekly_hours:     maxHours ? parseInt(maxHours, 10) : null,
          preferred_shift_type: shiftType || null,
          can_work_nights:      canWorkNights,
          can_work_weekends:    canWorkWeekends,
          is_driver:            isDriver,
          has_own_car:          hasOwnCar,
          work_areas:           workAreas.split(',').map((s) => s.trim()).filter(Boolean),
          unavailable_dates:    unavailDates.split('\n').map((s) => s.trim()).filter(Boolean),
          notes:                notes || null,
        }),
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

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-gray-700">Availability &amp; Shift Readiness</h2>
      </div>

      <div className="p-4 space-y-6">

        {/* ── Day-by-day availability ────────────────────────────────────── */}
        <div>
          <p className="text-xs font-medium text-on-surface-variant mb-2">Weekly availability</p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border border-gray-200 rounded-md overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-on-surface-variant w-28">Day</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-on-surface-variant w-24">Available</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-on-surface-variant w-28">Start</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-on-surface-variant w-28">End</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-on-surface-variant">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {DAY_KEYS.map((day) => (
                  <tr key={day} className={days[day].available ? 'bg-green-50/40' : ''}>
                    <td className="px-3 py-2 text-xs font-medium text-gray-700 whitespace-nowrap">
                      {DAY_LABELS[day]}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={days[day].available}
                        onChange={(e) => updateDay(day, 'available', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="time"
                        value={days[day].start_time}
                        onChange={(e) => updateDay(day, 'start_time', e.target.value)}
                        disabled={!days[day].available}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-40 disabled:bg-gray-50"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="time"
                        value={days[day].end_time}
                        onChange={(e) => updateDay(day, 'end_time', e.target.value)}
                        disabled={!days[day].available}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-40 disabled:bg-gray-50"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={days[day].notes}
                        onChange={(e) => updateDay(day, 'notes', e.target.value)}
                        disabled={!days[day].available}
                        placeholder="Optional"
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-40 disabled:bg-gray-50"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Shift preferences ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Max weekly hours
            </label>
            <input
              type="number"
              min={0}
              max={168}
              value={maxHours}
              onChange={(e) => setMaxHours(e.target.value)}
              placeholder="e.g. 40"
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Preferred shift type
            </label>
            <select
              value={shiftType}
              onChange={(e) => setShiftType(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-surface-container-lowest"
            >
              {SHIFT_TYPES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Work areas <span className="text-gray-400 font-normal">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={workAreas}
              onChange={(e) => setWorkAreas(e.target.value)}
              placeholder="e.g. North, East, Central"
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

        </div>

        {/* ── Boolean flags ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Checkbox label="Can work nights"   checked={canWorkNights}   onChange={setCanWorkNights} />
          <Checkbox label="Can work weekends" checked={canWorkWeekends} onChange={setCanWorkWeekends} />
          <Checkbox label="Driver"            checked={isDriver}        onChange={setIsDriver} />
          <Checkbox label="Own car"           checked={hasOwnCar}       onChange={setHasOwnCar} />
        </div>

        {/* ── Unavailable dates + notes ──────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Unavailable dates <span className="text-gray-400 font-normal">(one per line, YYYY-MM-DD)</span>
            </label>
            <textarea
              value={unavailDates}
              onChange={(e) => setUnavailDates(e.target.value)}
              rows={4}
              placeholder={'2026-06-01\n2026-06-02'}
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Any additional availability notes"
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* ── Save ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save availability'}
          </button>
          {saved   && <span className="text-sm text-green-600">Saved.</span>}
          {saveErr && <span className="text-sm text-red-600">{saveErr}</span>}
        </div>

      </div>
    </div>
  )
}
