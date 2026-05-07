'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DropdownOption { id: string; label: string }

interface DropdownData {
  clients: DropdownOption[]
  staff:   DropdownOption[]
}

const INCIDENT_TYPES = [
  { value: 'fall',             label: 'Fall' },
  { value: 'medication_error', label: 'Medication error' },
  { value: 'safeguarding',     label: 'Safeguarding' },
  { value: 'injury',           label: 'Injury' },
  { value: 'behaviour',        label: 'Behaviour' },
  { value: 'missed_visit',     label: 'Missed visit' },
  { value: 'property_damage',  label: 'Property damage' },
  { value: 'complaint',        label: 'Complaint' },
  { value: 'other',            label: 'Other' },
] as const

const SEVERITIES = [
  { value: 'low',      label: 'Low' },
  { value: 'medium',   label: 'Medium' },
  { value: 'high',     label: 'High' },
  { value: 'critical', label: 'Critical' },
] as const

const INPUT = 'w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
const LABEL = 'block text-xs font-medium text-gray-600 mb-1'

// ── Component ─────────────────────────────────────────────────────────────────

export default function CreateIncidentForm({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState<string | null>(null)
  const [dropdown, setDropdown] = useState<DropdownData>({ clients: [], staff: [] })

  // Form state
  const [clientId,        setClientId]        = useState('')
  const [staffProfileId,  setStaffProfileId]  = useState('')
  const [incidentType,    setIncidentType]    = useState('other')
  const [severity,        setSeverity]        = useState('medium')
  const [occurredAt,      setOccurredAt]      = useState('')
  const [description,     setDescription]     = useState('')
  const [actionTaken,     setActionTaken]     = useState('')
  const [escReq,          setEscReq]          = useState(false)
  const [escTo,           setEscTo]           = useState('')
  const [followReq,       setFollowReq]       = useState(false)
  const [followNotes,     setFollowNotes]     = useState('')

  // Load dropdown data
  useEffect(() => {
    if (!open) return

    async function loadOptions() {
      try {
        const [clientsRes, staffRes] = await Promise.all([
          fetch('/api/admin/clients?pageSize=100'),
          fetch('/api/admin/staff?pageSize=100'),
        ])

        const clientsJson = await clientsRes.json() as { data?: Array<{ id: string; first_name: string; last_name: string }> }
        const staffJson   = await staffRes.json()   as { data?: Array<{ id: string; first_name: string; last_name: string }> }

        const clients = (clientsJson.data ?? []).map((c) => ({
          id:    c.id,
          label: `${c.first_name} ${c.last_name}`,
        }))

        const staff = (staffJson.data ?? []).map((s) => ({
          id:    s.id,
          label: [s.first_name, s.last_name].filter(Boolean).join(' ') || s.id.slice(0, 8),
        }))

        setDropdown({ clients, staff })
      } catch {
        // Non-critical — dropdowns will be empty
      }
    }

    void loadOptions()
  }, [open])

  function resetForm() {
    setClientId('')
    setStaffProfileId('')
    setIncidentType('other')
    setSeverity('medium')
    setOccurredAt('')
    setDescription('')
    setActionTaken('')
    setEscReq(false)
    setEscTo('')
    setFollowReq(false)
    setFollowNotes('')
    setError(null)
    setSuccess(null)
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/admin/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id:              clientId || null,
          staff_profile_id:       staffProfileId || null,
          incident_type:          incidentType,
          severity,
          occurred_at:            occurredAt || null,
          description,
          immediate_action_taken: actionTaken || null,
          escalation_required:    escReq,
          escalated_to:           escTo || null,
          follow_up_required:     followReq,
          follow_up_notes:        followNotes || null,
        }),
      })

      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string }
        throw new Error(j.error ?? `HTTP ${res.status}`)
      }

      const incident = await res.json() as { id: string }
      setSuccess(incident.id)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create incident')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px]" onClick={handleClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl border border-gray-200 shadow-xl w-full max-w-xl max-h-[80vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between rounded-t-xl z-10">
          <h2 className="text-base font-semibold text-gray-900">Create Incident</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Success state */}
        {success ? (
          <div data-testid="create-incident-success" className="p-6 space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-md px-4 py-3">
              <p className="text-sm font-medium text-green-800">Incident created successfully</p>
            </div>
            <div className="flex items-center gap-3">
              <a
                href={`/admin/incidents/${success}`}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
              >
                View incident →
              </a>
              <button
                onClick={handleClose}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-5">

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            {/* Client + Staff */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Client</label>
                <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={INPUT}>
                  <option value="">— Select client —</option>
                  {dropdown.clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL}>Staff member</label>
                <select value={staffProfileId} onChange={(e) => setStaffProfileId(e.target.value)} className={INPUT}>
                  <option value="">— Select staff —</option>
                  {dropdown.staff.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Type + Severity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>Incident type *</label>
                <select value={incidentType} onChange={(e) => setIncidentType(e.target.value)} className={INPUT}>
                  {INCIDENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL}>Severity</label>
                <select value={severity} onChange={(e) => setSeverity(e.target.value)} className={INPUT}>
                  {SEVERITIES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Date/time */}
            <div>
              <label className={LABEL}>Occurred at</label>
              <input
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                className={INPUT}
              />
            </div>

            {/* Description */}
            <div>
              <label className={LABEL}>Description *</label>
              <textarea
                rows={3}
                data-testid="create-incident-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                className={INPUT}
                placeholder="Describe what happened…"
              />
            </div>

            {/* Immediate action */}
            <div>
              <label className={LABEL}>Immediate action taken</label>
              <textarea
                rows={2}
                value={actionTaken}
                onChange={(e) => setActionTaken(e.target.value)}
                className={INPUT}
                placeholder="Describe the immediate action taken…"
              />
            </div>

            {/* Escalation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="create-esc-req"
                  checked={escReq}
                  onChange={(e) => setEscReq(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="create-esc-req" className="text-xs font-medium text-gray-700">
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
                    placeholder="e.g. Safeguarding lead…"
                  />
                </div>
              )}
            </div>

            {/* Follow-up */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="create-follow-req"
                  checked={followReq}
                  onChange={(e) => setFollowReq(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="create-follow-req" className="text-xs font-medium text-gray-700">
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

            {/* Submit */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                data-testid="create-incident-submit"
                disabled={loading || !description.trim()}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Creating…' : 'Create Incident'}
              </button>
            </div>

          </form>
        )}
      </div>
    </div>
  )
}
