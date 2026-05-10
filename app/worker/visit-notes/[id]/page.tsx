'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface VisitNote {
  id:                   string
  status:               string
  wellbeing_notes:      string | null
  care_tasks_completed: string | null
  medication_prompted:  boolean | null
  medication_notes:     string | null
  food_fluid_notes:     string | null
  incident_reported:    boolean | null
  incident_notes:       string | null
  missed_tasks:         string | null
  general_notes:        string | null
  submitted_at:         string | null
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WorkerVisitNotePage() {
  const params = useParams<{ id: string }>()
  const noteId = params.id

  const [note,    setNote]    = useState<VisitNote | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [token,   setToken]   = useState('')

  // Form fields
  const [wellbeing,     setWellbeing]     = useState('')
  const [careTasks,     setCareTasks]     = useState('')
  const [medPrompted,   setMedPrompted]   = useState(false)
  const [medNotes,      setMedNotes]      = useState('')
  const [foodFluid,     setFoodFluid]     = useState('')
  const [incident,      setIncident]      = useState(false)
  const [incidentNotes, setIncidentNotes] = useState('')
  const [missedTasks,   setMissedTasks]   = useState('')
  const [generalNotes,  setGeneralNotes]  = useState('')

  const [saving,       setSaving]       = useState(false)
  const [saveOk,       setSaveOk]       = useState(false)
  const [saveError,    setSaveError]    = useState<string | null>(null)
  const [submitting,   setSubmitting]   = useState(false)
  const [confirmSubmit, setConfirmSubmit] = useState(false)

  const populate = useCallback((n: VisitNote) => {
    setNote(n)
    setWellbeing(n.wellbeing_notes     ?? '')
    setCareTasks(n.care_tasks_completed ?? '')
    setMedPrompted(n.medication_prompted  ?? false)
    setMedNotes(n.medication_notes     ?? '')
    setFoodFluid(n.food_fluid_notes    ?? '')
    setIncident(n.incident_reported    ?? false)
    setIncidentNotes(n.incident_notes  ?? '')
    setMissedTasks(n.missed_tasks      ?? '')
    setGeneralNotes(n.general_notes    ?? '')
  }, [])

  useEffect(() => {
    const t = sessionStorage.getItem('worker_token')
    if (!t) {
      setError('Session expired. Please use your portal link again.')
      setLoading(false)
      return
    }
    setToken(t)

    fetch(`/api/worker/visit-notes/${noteId}?token=${encodeURIComponent(t)}`)
      .then(async (res) => {
        const data = await res.json() as VisitNote | { error: string }
        if (!res.ok) {
          setError((data as { error: string }).error ?? 'Failed to load visit note.')
          return
        }
        populate(data as VisitNote)
      })
      .catch(() => setError('Failed to load visit note — please try again.'))
      .finally(() => setLoading(false))
  }, [noteId, populate])

  function buildPayload() {
    return {
      token:                token,
      note_id:              noteId,
      wellbeing_notes:      wellbeing      || null,
      care_tasks_completed: careTasks      || null,
      medication_prompted:  medPrompted,
      medication_notes:     medNotes       || null,
      food_fluid_notes:     foodFluid      || null,
      incident_reported:    incident,
      incident_notes:       incidentNotes  || null,
      missed_tasks:         missedTasks    || null,
      general_notes:        generalNotes   || null,
    }
  }

  async function handleSave() {
    setSaving(true)
    setSaveOk(false)
    setSaveError(null)
    try {
      const res = await fetch('/api/worker/visit-notes', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(buildPayload()),
      })
      const json = await res.json() as VisitNote | { error: string }
      if (!res.ok) { setSaveError((json as { error: string }).error ?? 'Save failed'); return }
      populate(json as VisitNote)
      setSaveOk(true)
      setTimeout(() => setSaveOk(false), 3000)
    } catch {
      setSaveError('Network error — please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit() {
    setSubmitting(true)
    setSaveError(null)
    setConfirmSubmit(false)
    try {
      const res = await fetch('/api/worker/visit-notes', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...buildPayload(), status: 'submitted' }),
      })
      const json = await res.json() as VisitNote | { error: string }
      if (!res.ok) { setSaveError((json as { error: string }).error ?? 'Submit failed'); return }
      populate(json as VisitNote)
    } catch {
      setSaveError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
        <p className="font-medium mb-2">{error}</p>
        <Link href="/worker/shifts" className="text-xs text-red-600 underline">← Back to shifts</Link>
      </div>
    )
  }

  if (!note) return null

  const isLocked = note.status === 'submitted' || note.status === 'locked'

  return (
    <div className="space-y-5 pb-8">

      {/* Back */}
      <Link href="/worker/shifts" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 gap-1">
        ← My Shifts
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">Visit Note</h1>
        <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
          isLocked
            ? 'bg-green-50 text-green-700 ring-green-600/20'
            : 'bg-amber-50 text-amber-700 ring-amber-600/20'
        }`}>
          {note.status}
        </span>
      </div>

      {isLocked && (
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          ✓ This visit note has been submitted and is now locked.
        </div>
      )}

      {incident && !isLocked && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 font-medium">
          ⚠ Incident flagged — please provide details in the Incident section below.
        </div>
      )}

      {/* Form */}
      <div className="space-y-4">

        <FormSection label="Client Wellbeing">
          <Textarea value={wellbeing} onChange={setWellbeing}
            placeholder="How did the client appear? Any concerns?"
            disabled={isLocked} />
        </FormSection>

        <FormSection label="Care Tasks Completed">
          <Textarea value={careTasks} onChange={setCareTasks}
            placeholder="List care tasks completed during this visit."
            disabled={isLocked} />
        </FormSection>

        <FormSection label="Medication">
          <Toggle
            checked={medPrompted}
            onChange={setMedPrompted}
            label="Medication prompted / administered"
            disabled={isLocked}
          />
          {medPrompted && (
            <Textarea value={medNotes} onChange={setMedNotes}
              placeholder="Medication details…"
              disabled={isLocked} />
          )}
        </FormSection>

        <FormSection label="Food & Fluid Intake">
          <Textarea value={foodFluid} onChange={setFoodFluid}
            placeholder="What did the client eat and drink?"
            disabled={isLocked} />
        </FormSection>

        <FormSection label="Missed Tasks">
          <Textarea value={missedTasks} onChange={setMissedTasks}
            placeholder="Any care tasks not completed? Give reason."
            disabled={isLocked} />
        </FormSection>

        <FormSection label="Incident">
          <Toggle
            checked={incident}
            onChange={setIncident}
            label="Report an incident"
            labelCls="text-red-700 font-medium"
            disabled={isLocked}
          />
          {incident && (
            <Textarea value={incidentNotes} onChange={setIncidentNotes}
              placeholder="Describe the incident in detail…"
              disabled={isLocked}
              rows={4} />
          )}
        </FormSection>

        <FormSection label="General Notes">
          <Textarea value={generalNotes} onChange={setGeneralNotes}
            placeholder="Any other notes for the care team…"
            disabled={isLocked} />
        </FormSection>

      </div>

      {/* Save / Submit */}
      {!isLocked && (
        <div className="space-y-3">
          {saveError && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">{saveError}</div>
          )}
          {saveOk && (
            <div data-testid="save-draft-ok" className="rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-700">✓ Draft saved.</div>
          )}

          {/* Inline submit confirmation */}
          {confirmSubmit ? (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-3">
              <p className="text-sm font-semibold text-amber-800">Submit this visit note?</p>
              <p className="text-xs text-amber-700">You will not be able to edit it afterwards. Make sure all sections are complete.</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {submitting ? 'Submitting…' : 'Yes, submit'}
                </button>
                <button
                  onClick={() => setConfirmSubmit(false)}
                  disabled={submitting}
                  className="rounded-xl bg-gray-100 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                data-testid="save-draft-btn"
                onClick={handleSave}
                disabled={saving || submitting}
                className="rounded-xl bg-gray-100 py-3.5 text-sm font-semibold text-gray-800 hover:bg-gray-200 active:scale-95 transition-all disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Draft'}
              </button>
              <button
                data-testid="submit-note-btn"
                onClick={() => { setSaveError(null); setConfirmSubmit(true) }}
                disabled={saving || submitting}
                className="rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white hover:bg-indigo-500 active:scale-95 transition-all disabled:opacity-50"
              >
                Submit Note
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function FormSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <p className="text-sm font-semibold text-gray-700">{label}</p>
      {children}
    </div>
  )
}

function Textarea({
  value, onChange, placeholder, disabled, rows = 3,
}: {
  value: string; onChange: (v: string) => void
  placeholder: string; disabled: boolean; rows?: number
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      rows={rows}
      className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-gray-50 disabled:text-gray-500 placeholder:text-gray-400"
    />
  )
}

function Toggle({
  checked, onChange, label, labelCls = 'text-gray-700', disabled,
}: {
  checked: boolean; onChange: (v: boolean) => void
  label: string; labelCls?: string; disabled: boolean
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
      />
      <span className={`text-sm ${labelCls}`}>{label}</span>
    </label>
  )
}
