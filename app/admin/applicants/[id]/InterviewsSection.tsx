'use client'

import { useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Interview {
  id: string
  applicant_id: string
  scheduled_at: string | null
  interview_type: string | null
  interviewer_name: string | null
  location: string | null
  notes: string | null
  score: number | null
  outcome: string
  created_at: string
  updated_at: string
}

interface Props {
  applicantId: string
  initialInterviews: Interview[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const OUTCOME_META: Record<string, { label: string; cls: string }> = {
  pending:        { label: 'Pending',         cls: 'bg-gray-50 text-gray-600 ring-gray-500/20' },
  recommend_hire: { label: 'Recommend Hire',  cls: 'bg-green-50 text-green-700 ring-green-600/20' },
  hold:           { label: 'Hold',            cls: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20' },
  reject:         { label: 'Reject',          cls: 'bg-red-50 text-red-700 ring-red-600/20' },
}

const OUTCOME_OPTIONS = Object.entries(OUTCOME_META).map(([value, { label }]) => ({ value, label }))

// ── Helpers ───────────────────────────────────────────────────────────────────

function OutcomeBadge({ outcome }: { outcome: string }) {
  const meta = OUTCOME_META[outcome] ?? OUTCOME_META.pending
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${meta.cls}`}>
      {meta.label}
    </span>
  )
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Schedule Form ─────────────────────────────────────────────────────────────

interface ScheduleFormProps {
  applicantId: string
  onCreated: (interview: Interview) => void
  onCancel: () => void
}

function ScheduleForm({ applicantId, onCreated, onCancel }: ScheduleFormProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fields, setFields] = useState({
    scheduled_at:    '',
    interview_type:  '',
    interviewer_name: '',
    location:        '',
  })

  function set(key: keyof typeof fields, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/interviews', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicant_id:     applicantId,
          scheduled_at:     fields.scheduled_at || null,
          interview_type:   fields.interview_type || null,
          interviewer_name: fields.interviewer_name || null,
          location:         fields.location || null,
        }),
      })

      // Always parse the body so we can log and display the real error
      let json: { interview?: Interview; error?: string }
      try {
        json = await res.json() as { interview?: Interview; error?: string }
      } catch {
        // Response body is not JSON (e.g. network-level failure)
        const fallback = `HTTP ${res.status} — non-JSON response`
        console.error('[ScheduleForm] POST /api/admin/interviews failed:', fallback)
        throw new Error(fallback)
      }

      if (!res.ok) {
        // Log full context to the browser console for debugging
        console.error('[ScheduleForm] POST /api/admin/interviews failed:', {
          status: res.status,
          body:   json,
        })
        throw new Error(json.error ?? `Request failed with status ${res.status}`)
      }

      onCreated(json.interview!)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-3 space-y-3">
      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Schedule Interview</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-on-surface-variant mb-1" htmlFor="sched-at">Date &amp; Time</label>
          <input
            id="sched-at"
            type="datetime-local"
            className={inputCls}
            value={fields.scheduled_at}
            onChange={(e) => set('scheduled_at', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-on-surface-variant mb-1" htmlFor="sched-type">Interview Type</label>
          <input
            id="sched-type"
            type="text"
            className={inputCls}
            placeholder="e.g. Phone, In-person, Panel"
            value={fields.interview_type}
            onChange={(e) => set('interview_type', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-on-surface-variant mb-1" htmlFor="sched-interviewer">Interviewer Name</label>
          <input
            id="sched-interviewer"
            type="text"
            className={inputCls}
            value={fields.interviewer_name}
            onChange={(e) => set('interviewer_name', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs text-on-surface-variant mb-1" htmlFor="sched-location">Location</label>
          <input
            id="sched-location"
            type="text"
            className={inputCls}
            placeholder="e.g. Office, Video call"
            value={fields.location}
            onChange={(e) => set('location', e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-600">✕ {error}</p>}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          id="submit-schedule-interview"
          className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {saving ? 'Saving…' : 'Schedule Interview'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium bg-white text-gray-600 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── Interview Card (editable) ─────────────────────────────────────────────────

interface InterviewCardProps {
  interview: Interview
  onUpdated: (updated: Interview) => void
}

function InterviewCard({ interview, onUpdated }: InterviewCardProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [notes, setNotes] = useState(interview.notes ?? '')
  const [score, setScore] = useState(interview.score !== null ? String(interview.score) : '')
  const [outcome, setOutcome] = useState(interview.outcome)

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const res = await fetch(`/api/admin/interviews/${interview.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes:   notes || null,
          score:   score ? Number(score) : null,
          outcome,
        }),
      })
      const json = await res.json() as { interview?: Interview; error?: string; errors?: string[] }
      if (!res.ok) {
        const msg = json.errors ? json.errors.join(', ') : (json.error ?? `Request failed: ${res.status}`)
        throw new Error(msg)
      }
      onUpdated(json.interview!)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'rounded border border-gray-300 px-2.5 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white space-y-3">
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-primary">
            {formatDateTime(interview.scheduled_at)}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
            {interview.interview_type && <span>{interview.interview_type}</span>}
            {interview.interviewer_name && <><span>·</span><span>{interview.interviewer_name}</span></>}
            {interview.location && <><span>·</span><span>{interview.location}</span></>}
          </div>
        </div>
        <OutcomeBadge outcome={outcome} />
      </div>

      {/* Editable fields */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Outcome */}
        <div>
          <label className="block text-xs text-on-surface-variant mb-1" htmlFor={`outcome-${interview.id}`}>Outcome</label>
          <select
            id={`outcome-${interview.id}`}
            className={`${inputCls} w-full`}
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
          >
            {OUTCOME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Score */}
        <div>
          <label className="block text-xs text-on-surface-variant mb-1" htmlFor={`score-${interview.id}`}>Score (1–10)</label>
          <input
            id={`score-${interview.id}`}
            type="number"
            min={1}
            max={10}
            className={`${inputCls} w-full`}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            placeholder="—"
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs text-on-surface-variant mb-1" htmlFor={`notes-${interview.id}`}>Notes</label>
        <textarea
          id={`notes-${interview.id}`}
          rows={3}
          className={`${inputCls} w-full resize-y`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Interview notes…"
        />
      </div>

      {/* Feedback + Save */}
      <div className="flex items-center gap-3">
        <button
          id={`save-interview-${interview.id}`}
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-60 transition-colors"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {success && <p className="text-xs text-green-600">✓ Saved</p>}
        {error   && <p className="text-xs text-red-600">✕ {error}</p>}
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function InterviewsSection({ applicantId, initialInterviews }: Props) {
  const [interviews, setInterviews] = useState<Interview[]>(initialInterviews)
  const [showForm, setShowForm] = useState(false)

  function handleCreated(interview: Interview) {
    setInterviews((prev) => [interview, ...prev])
    setShowForm(false)
  }

  function handleUpdated(updated: Interview) {
    setInterviews((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
      {/* Section header */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">
          Interviews
          {interviews.length > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-400">({interviews.length})</span>
          )}
        </h2>
        {!showForm && (
          <button
            id="btn-schedule-interview"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
          >
            + Schedule Interview
          </button>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Schedule form (inline) */}
        {showForm && (
          <ScheduleForm
            applicantId={applicantId}
            onCreated={handleCreated}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* Interview cards */}
        {interviews.length === 0 && !showForm && (
          <p className="text-sm text-gray-400">No interviews scheduled yet.</p>
        )}
        {interviews.map((interview) => (
          <InterviewCard
            key={interview.id}
            interview={interview}
            onUpdated={handleUpdated}
          />
        ))}
      </div>
    </div>
  )
}
