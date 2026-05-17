'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus'

const ALERT_TYPES = [
  { value: 'emergency',          label: 'Emergency',              description: 'Immediate danger — me or someone else', icon: '🚨' },
  { value: 'unsafe_environment', label: 'Unsafe Environment',     description: 'The environment poses a risk',           icon: '⚠️' },
  { value: 'welfare_check',      label: 'Welfare Check Needed',   description: 'Client needs urgent welfare check',      icon: '❤️' },
  { value: 'request_support',    label: 'Request Support',        description: 'I need immediate help from a manager',   icon: '🙏' },
]

export default function WorkerSafetyPage() {
  const [alertType,    setAlertType]    = useState('emergency')
  const [description,  setDescription]  = useState('')
  const [submitted,    setSubmitted]    = useState(false)
  const [incidentId,   setIncidentId]   = useState<string | null>(null)
  const [busy,         setBusy]         = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  const online = useOnlineStatus()

  async function raise() {
    if (!online) { setError('You are offline. Call 999 if this is an emergency.'); return }
    if (!description.trim()) { setError('Please describe the situation.'); return }

    setBusy(true)
    setError(null)

    const token = sessionStorage.getItem('worker_token') ?? ''

    try {
      const res = await fetch('/api/worker/safety', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, alert_type: alertType, description }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? 'Failed to submit.'); return }
      setIncidentId(d.incident_id)
      setSubmitted(true)
    } catch {
      setError('Network error — if this is a life-threatening emergency call 999.')
    } finally {
      setBusy(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 space-y-5">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center text-4xl">✅</div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Alert raised</h1>
          <p className="text-sm text-gray-500 mt-2">Your coordinator has been notified immediately.</p>
          {incidentId && <p className="text-xs text-gray-400 mt-1">Ref: {incidentId.slice(0, 8)}</p>}
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 text-left">
          <p className="font-semibold mb-1">If you are in immediate danger:</p>
          <p>Call <strong>999</strong> immediately. Do not wait for a callback.</p>
        </div>
        <Link href="/worker/dashboard" className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors">
          Back to Dashboard
        </Link>
      </div>
    )
  }

  const selected = ALERT_TYPES.find(a => a.value === alertType)!

  return (
    <div className="space-y-5 pb-8">
      {/* Back */}
      <Link href="/worker/dashboard" className="text-sm text-gray-500 hover:text-gray-900">
        ← Back
      </Link>

      {/* Heading */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Safety Alert</h1>
        <p className="text-sm text-gray-500 mt-1">
          Your coordinator will be notified immediately. Use this for urgent situations only.
        </p>
      </div>

      {/* Emergency call-out */}
      <div className="bg-red-50 border-2 border-red-400 rounded-xl p-4">
        <p className="text-sm font-bold text-red-800 mb-1">Life-threatening emergency?</p>
        <p className="text-sm text-red-700">Call <strong>999</strong> first, then use this form.</p>
        <a
          href="tel:999"
          className="mt-3 flex items-center justify-center gap-2 w-full py-3 bg-red-600 text-white font-bold text-base rounded-xl hover:bg-red-700 active:scale-95 transition-all"
        >
          📞 Call 999 Now
        </a>
      </div>

      {/* Offline warning */}
      {!online && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3 text-sm text-amber-700">
          <strong>You are offline.</strong> This form requires a connection. For emergencies call 999.
        </div>
      )}

      {/* Alert type */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-2">Type of alert</p>
        <div className="space-y-2">
          {ALERT_TYPES.map(a => (
            <button
              key={a.value}
              onClick={() => setAlertType(a.value)}
              className={[
                'w-full flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all',
                alertType === a.value
                  ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-200'
                  : 'border-gray-200 bg-white hover:border-gray-300',
              ].join(' ')}
            >
              <span className="text-2xl shrink-0">{a.icon}</span>
              <div>
                <p className="text-sm font-semibold text-gray-900">{a.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{a.description}</p>
              </div>
              {alertType === a.value && (
                <span className="ml-auto text-indigo-600 shrink-0">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Describe the situation <span className="text-red-500">*</span>
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={4}
          placeholder={`What is happening? Where are you?\n\nExample: Client has fallen and is unconscious. I am at 12 Oak Street.`}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Selected type confirmation */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600">
        Raising: <strong className="text-gray-900">{selected.label}</strong>
        {' '}— your coordinator will be alerted with high priority.
      </div>

      {/* Submit */}
      <button
        onClick={raise}
        disabled={busy || !online || !description.trim()}
        className="w-full min-h-[56px] bg-red-600 text-white text-base font-bold rounded-xl hover:bg-red-700 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
      >
        {busy
          ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          : '🚨'
        }
        Raise Safety Alert
      </button>
    </div>
  )
}
