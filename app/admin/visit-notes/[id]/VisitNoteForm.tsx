'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VisitNote {
  id:                   string
  status:               string
  submitted_at:         string | null
  wellbeing_notes:      string | null
  care_tasks_completed: unknown
  medication_prompted:  boolean
  medication_notes:     string | null
  food_fluid_notes:     string | null
  incident_reported:    boolean
  incident_notes:       string | null
  missed_tasks:         string | null
  general_notes:        string | null
  client_signature:     string | null
  staff_signature:      string | null
  shifts: {
    title:      string
    shift_date: string
    start_time: string
    end_time:   string
  } | null
  clients: {
    id:         string
    first_name: string
    last_name:  string
  } | null
  staff_profiles: {
    id:         string
    first_name: string | null
    last_name:  string | null
  } | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CARE_TASKS = [
  { value: 'personal_care',      label: 'Personal care' },
  { value: 'medication_support', label: 'Medication support' },
  { value: 'meal_preparation',   label: 'Meal preparation' },
  { value: 'mobility_support',   label: 'Mobility support' },
  { value: 'companionship',      label: 'Companionship' },
  { value: 'domestic_tasks',     label: 'Domestic tasks' },
  { value: 'other',              label: 'Other' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatTime(t: string) { return t.slice(0, 5) }

function parseTasks(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((v) => typeof v === 'string') as string[]
  return []
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  )
}

function Textarea({
  label, value, onChange, disabled, rows = 3, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void
  disabled: boolean; rows?: number; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={rows}
        placeholder={placeholder}
        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500 resize-y"
      />
    </div>
  )
}

function TextInput({
  label, value, onChange, disabled, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void
  disabled: boolean; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-500"
      />
    </div>
  )
}

function Toggle({
  label, value, onChange, disabled,
}: {
  label: string; value: boolean; onChange: (v: boolean) => void; disabled: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-700">{label}</span>
      <div className="flex items-center gap-3">
        {(['Yes', 'No'] as const).map((opt) => {
          const isYes   = opt === 'Yes'
          const checked = value === isYes
          return (
            <label key={opt} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                checked={checked}
                onChange={() => onChange(isYes)}
                disabled={disabled}
                className="accent-indigo-600"
              />
              <span className="text-sm text-gray-700">{opt}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function VisitNoteForm({ note }: { note: VisitNote }) {
  const router   = useRouter()
  const isLocked = note.status === 'submitted' || note.status === 'locked'

  const [form, setForm] = useState({
    wellbeing_notes:      note.wellbeing_notes      ?? '',
    care_tasks_completed: parseTasks(note.care_tasks_completed),
    medication_prompted:  note.medication_prompted,
    medication_notes:     note.medication_notes     ?? '',
    food_fluid_notes:     note.food_fluid_notes     ?? '',
    incident_reported:    note.incident_reported,
    incident_notes:       note.incident_notes       ?? '',
    missed_tasks:         note.missed_tasks         ?? '',
    general_notes:        note.general_notes        ?? '',
    client_signature:     note.client_signature     ?? '',
    staff_signature:      note.staff_signature      ?? '',
  })

  const [saving,     setSaving]     = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [savedAt,    setSavedAt]    = useState<string | null>(null)

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSavedAt(null)
  }

  function toggleTask(task: string) {
    setForm((prev) => ({
      ...prev,
      care_tasks_completed: prev.care_tasks_completed.includes(task)
        ? prev.care_tasks_completed.filter((t) => t !== task)
        : [...prev.care_tasks_completed, task],
    }))
    setSavedAt(null)
  }

  async function save(): Promise<boolean> {
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/admin/visit-notes/${note.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(form),
    })
    setSaving(false)
    if (res.ok) {
      setSavedAt(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
      return true
    }
    const data = await res.json() as { error?: string }
    setError(data.error ?? 'Failed to save')
    return false
  }

  async function handleSave() {
    await save()
  }

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    const saved = await save()
    if (!saved) { setSubmitting(false); return }

    const res = await fetch(`/api/admin/visit-notes/${note.id}/submit`, { method: 'POST' })
    if (res.ok) {
      router.refresh()
    } else {
      const data = await res.json() as { error?: string }
      setError(data.error ?? 'Failed to submit')
    }
    setSubmitting(false)
  }

  const clientFullName = note.clients
    ? `${note.clients.first_name} ${note.clients.last_name}`
    : null

  const staffFullName = note.staff_profiles
    ? [note.staff_profiles.first_name, note.staff_profiles.last_name].filter(Boolean).join(' ')
    : null

  return (
    <div className="space-y-5">

      {/* Submitted banner */}
      {isLocked && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-5 py-4 flex items-center gap-3">
          <span className="text-green-600 text-lg">✓</span>
          <div>
            <p className="text-sm font-semibold text-green-800">Visit note submitted</p>
            {note.submitted_at && (
              <p className="text-xs text-green-600 mt-0.5">
                Submitted {formatDateTime(note.submitted_at)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Shift context */}
      <div className="bg-white rounded-lg border border-gray-200 px-5 py-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            {note.shifts && (
              <>
                <p className="text-sm font-semibold text-gray-900">{note.shifts.title}</p>
                <p className="text-xs text-gray-500">
                  {note.shifts.shift_date} · {formatTime(note.shifts.start_time)}–{formatTime(note.shifts.end_time)}
                </p>
              </>
            )}
            {clientFullName && (
              <a
                href={`/admin/clients/${note.clients!.id}`}
                className="text-xs text-indigo-600 hover:underline"
              >
                Client: {clientFullName}
              </a>
            )}
            {staffFullName && (
              <p className="text-xs text-gray-500">Staff: {staffFullName}</p>
            )}
          </div>
          <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
            note.status === 'submitted' ? 'bg-green-50 text-green-700 ring-green-600/20' :
            note.status === 'locked'    ? 'bg-indigo-50 text-indigo-700 ring-indigo-600/20' :
            'bg-gray-50 text-gray-600 ring-gray-400/20'
          }`}>
            {note.status}
          </span>
        </div>
      </div>

      {/* Wellbeing */}
      <Section title="Wellbeing">
        <Textarea
          label="Wellbeing notes"
          value={form.wellbeing_notes}
          onChange={(v) => set('wellbeing_notes', v)}
          disabled={isLocked}
          rows={4}
          placeholder="Describe the client's mood, wellbeing, and any concerns…"
        />
      </Section>

      {/* Care tasks */}
      <Section title="Care tasks completed">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4">
          {CARE_TASKS.map((task) => (
            <label
              key={task.value}
              className={`flex items-center gap-2.5 cursor-pointer ${isLocked ? 'pointer-events-none opacity-60' : ''}`}
            >
              <input
                type="checkbox"
                checked={form.care_tasks_completed.includes(task.value)}
                onChange={() => toggleTask(task.value)}
                disabled={isLocked}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 accent-indigo-600"
              />
              <span className="text-sm text-gray-700">{task.label}</span>
            </label>
          ))}
        </div>
      </Section>

      {/* Medication */}
      <Section title="Medication">
        <Toggle
          label="Medication prompted?"
          value={form.medication_prompted}
          onChange={(v) => set('medication_prompted', v)}
          disabled={isLocked}
        />
        {form.medication_prompted && (
          <Textarea
            label="Medication notes"
            value={form.medication_notes}
            onChange={(v) => set('medication_notes', v)}
            disabled={isLocked}
            placeholder="Record medication given, dosage, and any concerns…"
          />
        )}
      </Section>

      {/* Food & fluid */}
      <Section title="Food &amp; fluid intake">
        <Textarea
          label="Food and fluid notes"
          value={form.food_fluid_notes}
          onChange={(v) => set('food_fluid_notes', v)}
          disabled={isLocked}
          placeholder="Meals eaten, drinks consumed, appetite notes…"
        />
      </Section>

      {/* Incidents */}
      <Section title="Incidents">
        <Toggle
          label="Incident reported?"
          value={form.incident_reported}
          onChange={(v) => set('incident_reported', v)}
          disabled={isLocked}
        />
        {form.incident_reported && (
          <Textarea
            label="Incident notes"
            value={form.incident_notes}
            onChange={(v) => set('incident_notes', v)}
            disabled={isLocked}
            rows={4}
            placeholder="Describe the incident, time, actions taken, who was informed…"
          />
        )}
      </Section>

      {/* Missed tasks */}
      <Section title="Missed tasks">
        <Textarea
          label="Tasks not completed"
          value={form.missed_tasks}
          onChange={(v) => set('missed_tasks', v)}
          disabled={isLocked}
          placeholder="List any care tasks that were not completed and the reason…"
        />
      </Section>

      {/* General notes */}
      <Section title="General notes">
        <Textarea
          label="Additional notes"
          value={form.general_notes}
          onChange={(v) => set('general_notes', v)}
          disabled={isLocked}
          rows={4}
          placeholder="Any other observations or information…"
        />
      </Section>

      {/* Signatures */}
      <Section title="Signatures">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextInput
            label="Staff signature (type name)"
            value={form.staff_signature}
            onChange={(v) => set('staff_signature', v)}
            disabled={isLocked}
            placeholder={staffFullName ?? 'Full name'}
          />
          <TextInput
            label="Client signature (type name)"
            value={form.client_signature}
            onChange={(v) => set('client_signature', v)}
            disabled={isLocked}
            placeholder={clientFullName ?? 'Full name'}
          />
        </div>
      </Section>

      {/* Action bar */}
      {!isLocked && (
        <div className="flex items-center justify-between gap-4 pt-2">
          <div className="text-xs text-gray-400">
            {error && <span className="text-red-600">{error}</span>}
            {savedAt && !error && <span className="text-green-600">Saved at {savedAt}</span>}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || submitting}
              className="px-4 py-2 text-sm rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving…' : 'Save draft'}
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || submitting}
              className="px-4 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Submitting…' : 'Submit note'}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
