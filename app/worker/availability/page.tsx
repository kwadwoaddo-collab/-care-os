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
  { value: '',              label: '— Select —' },
  { value: 'days',          label: 'Days' },
  { value: 'nights',        label: 'Nights' },
  { value: 'mixed',         label: 'Mixed' },
  { value: 'weekends_only', label: 'Weekends only' },
  { value: 'flexible',      label: 'Flexible' },
]

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

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>
  if (error)   return <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">My Availability</h1>

      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-6">

        {/* Weekly day table */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Weekly availability</p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border border-gray-200 rounded-md overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-28">Day</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-24">Available</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-28">Start</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-28">End</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {DAY_KEYS.map((day) => (
                  <tr key={day} className={days[day].available ? 'bg-green-50/40' : ''}>
                    <td className="px-3 py-2 text-xs font-medium text-gray-700">{DAY_LABELS[day]}</td>
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={days[day].available}
                        onChange={(e) => updateDay(day, 'available', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input type="time" value={days[day].start_time}
                        onChange={(e) => updateDay(day, 'start_time', e.target.value)}
                        disabled={!days[day].available}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-40"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input type="time" value={days[day].end_time}
                        onChange={(e) => updateDay(day, 'end_time', e.target.value)}
                        disabled={!days[day].available}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-40"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" value={days[day].notes}
                        onChange={(e) => updateDay(day, 'notes', e.target.value)}
                        disabled={!days[day].available}
                        placeholder="Optional note"
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-40"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Preferences */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Max weekly hours</label>
            <input type="number" min={0} max={168} value={maxHours}
              onChange={(e) => setMaxHours(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Preferred shift type</label>
            <select value={shiftType} onChange={(e) => setShiftType(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {SHIFT_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          {[
            { label: 'Can work nights',    val: canWorkNights,   set: setCanWorkNights },
            { label: 'Can work weekends',  val: canWorkWeekends, set: setCanWorkWeekends },
            { label: 'Driver',             val: isDriver,        set: setIsDriver },
            { label: 'Has own car',        val: hasOwnCar,       set: setHasOwnCar },
          ].map(({ label, val, set }) => (
            <label key={label} className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-700">
              <input type="checkbox" checked={val} onChange={(e) => set(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              {label}
            </label>
          ))}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Work areas <span className="font-normal text-gray-400">(comma separated)</span>
          </label>
          <input type="text" value={workAreas} onChange={(e) => setWorkAreas(e.target.value)}
            placeholder="e.g. North London, Hackney, Islington"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {saveErr && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{saveErr}</div>
        )}
        {saved && (
          <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">Availability saved.</div>
        )}

        <button type="button" onClick={handleSave} disabled={saving}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save availability'}
        </button>
      </div>
    </div>
  )
}
