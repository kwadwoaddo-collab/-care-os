'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  visitNoteId:      string
  shiftId:          string | null
  clientId:         string | null
  staffProfileId:   string | null
  incidentNotes:    string | null
  generalNotes:     string | null
  shiftDate:        string | null
  startTime:        string | null
}

export default function CreateIncidentFromNoteButton({
  visitNoteId,
  shiftId,
  clientId,
  staffProfileId,
  incidentNotes,
  generalNotes,
  shiftDate,
  startTime,
}: Props) {
  const router   = useRouter()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [result,  setResult]  = useState<{ id: string } | null>(null)

  async function handleCreate() {
    setLoading(true)
    setError(null)

    // Derive occurred_at from shift if available
    let occurredAt: string | null = null
    if (shiftDate && startTime) {
      occurredAt = `${shiftDate}T${startTime}`
    }

    try {
      const res = await fetch('/api/admin/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visit_note_id:    visitNoteId,
          shift_id:         shiftId,
          client_id:        clientId,
          staff_profile_id: staffProfileId,
          incident_type:    'other',
          severity:         'medium',
          occurred_at:      occurredAt,
          description:      incidentNotes || generalNotes || 'Incident reported via visit note',
        }),
      })

      if (res.status === 409) {
        const j = await res.json() as { existing_incident_id?: string }
        if (j.existing_incident_id) {
          setResult({ id: j.existing_incident_id })
          return
        }
      }

      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string }
        throw new Error(j.error ?? `HTTP ${res.status}`)
      }

      const incident = await res.json() as { id: string }
      setResult(incident)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create incident')
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center justify-between">
        <p className="text-sm text-green-800 font-medium">Incident created</p>
        <a
          href={`/admin/incidents/${result.id}`}
          className="text-sm text-indigo-600 hover:underline font-medium"
        >
          View incident →
        </a>
      </div>
    )
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-amber-800">No linked incident</p>
          <p className="text-xs text-amber-600 mt-0.5">
            Create an incident record from this visit note
          </p>
        </div>
        <button
          onClick={handleCreate}
          disabled={loading}
          className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {loading ? 'Creating…' : 'Create Incident'}
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-600 mt-2">{error}</p>
      )}
    </div>
  )
}
