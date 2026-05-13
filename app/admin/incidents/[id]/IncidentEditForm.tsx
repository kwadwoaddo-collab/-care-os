'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  incidentId: string
  initial: {
    severity:               string
    status:                 string
    immediate_action_taken: string | null
    escalation_required:    boolean
    escalated_to:           string | null
    follow_up_required:     boolean
    follow_up_notes:        string | null
    resolution_notes:       string | null
  }
}

const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const
const STATUSES   = ['open', 'investigating', 'resolved', 'closed'] as const

const SEVERITY_CLS: Record<string, string> = {
  low:      'bg-gray-50    text-gray-600',
  medium:   'bg-yellow-50  text-yellow-700',
  high:     'bg-orange-50  text-orange-700',
  critical: 'bg-red-50     text-red-700',
}

const STATUS_CLS: Record<string, string> = {
  open:          'bg-red-50     text-red-700',
  investigating: 'bg-blue-50    text-blue-700',
  resolved:      'bg-green-50   text-green-700',
  closed:        'bg-gray-50    text-on-surface-variant',
}

const INPUT = 'w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
const LABEL = 'block text-xs font-medium text-gray-600 mb-1'

export default function IncidentEditForm({ incidentId, initial }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const [severity,   setSeverity]   = useState(initial.severity)
  const [status,     setStatus]     = useState(initial.status)
  const [action,     setAction]     = useState(initial.immediate_action_taken ?? '')
  const [escReq,     setEscReq]     = useState(initial.escalation_required)
  const [escTo,      setEscTo]      = useState(initial.escalated_to ?? '')
  const [followReq,  setFollowReq]  = useState(initial.follow_up_required)
  const [followNotes, setFollowNotes] = useState(initial.follow_up_notes ?? '')
  const [resNotes,   setResNotes]   = useState(initial.resolution_notes ?? '')

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/incidents/${incidentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          severity,
          status,
          immediate_action_taken: action || null,
          escalation_required:    escReq,
          escalated_to:           escTo || null,
          follow_up_required:     followReq,
          follow_up_notes:        followNotes || null,
          resolution_notes:       resNotes || null,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string }
        throw new Error(j.error ?? `HTTP ${res.status}`)
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-5 space-y-5">
      <h2 className="text-sm font-semibold text-gray-800">Update Incident</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Severity */}
        <div>
          <label className={LABEL}>Severity</label>
          <div className="flex gap-1.5 flex-wrap">
            {SEVERITIES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSeverity(s)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ring-1 ring-inset ${
                  severity === s
                    ? `${SEVERITY_CLS[s]} ring-current`
                    : 'bg-white text-gray-400 ring-gray-200 hover:bg-gray-50'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Status */}
        <div>
          <label className={LABEL}>Status</label>
          <div className="flex gap-1.5 flex-wrap">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ring-1 ring-inset ${
                  status === s
                    ? `${STATUS_CLS[s]} ring-current`
                    : 'bg-white text-gray-400 ring-gray-200 hover:bg-gray-50'
                }`}
              >
                {s.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Immediate action */}
      <div>
        <label className={LABEL}>Immediate action taken</label>
        <textarea
          rows={2}
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className={INPUT}
          placeholder="Describe the immediate action taken…"
        />
      </div>

      {/* Escalation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="esc-req"
            checked={escReq}
            onChange={(e) => setEscReq(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="esc-req" className="text-xs font-medium text-gray-700">
            Escalation required
          </label>
        </div>
        {escReq && (
          <div>
            <label className={LABEL}>Escalated to</label>
            <input
              type="text"
              value={escTo}
              onChange={(e) => setEscTo(e.target.value)}
              className={INPUT}
              placeholder="e.g. Safeguarding lead, CQC…"
            />
          </div>
        )}
      </div>

      {/* Follow up */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="follow-req"
            checked={followReq}
            onChange={(e) => setFollowReq(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <label htmlFor="follow-req" className="text-xs font-medium text-gray-700">
            Follow-up required
          </label>
        </div>
        {followReq && (
          <div>
            <label className={LABEL}>Follow-up notes</label>
            <textarea
              rows={2}
              value={followNotes}
              onChange={(e) => setFollowNotes(e.target.value)}
              className={INPUT}
              placeholder="What needs to happen next…"
            />
          </div>
        )}
      </div>

      {/* Resolution */}
      <div>
        <label className={LABEL}>Resolution notes</label>
        <textarea
          rows={2}
          value={resNotes}
          onChange={(e) => setResNotes(e.target.value)}
          className={INPUT}
          placeholder="How was this incident resolved…"
        />
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
