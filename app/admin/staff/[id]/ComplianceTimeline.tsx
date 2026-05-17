'use client'

import { useEffect, useState } from 'react'
import type { ComplianceEvent, ComplianceEventType } from '@/lib/staff/getComplianceTimeline'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  staffProfileId: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTs(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  )
}

const EVENT_DOT_CLS: Record<ComplianceEventType, string> = {
  uploaded:        'bg-blue-400',
  approved:        'bg-green-500',
  rejected:        'bg-red-500',
  superseded:      'bg-gray-400',
  expired:         'bg-orange-500',
  reminder_sent:   'bg-indigo-400',
  renewed:         'bg-teal-500',
  escalated:       'bg-red-600',
  override_granted: 'bg-orange-400',
  override_revoked: 'bg-gray-500',
  shift_blocked:   'bg-red-800',
}

const EVENT_ICON: Record<ComplianceEventType, string> = {
  uploaded:        '📤',
  approved:        '✅',
  rejected:        '❌',
  superseded:      '🔄',
  expired:         '⚠️',
  reminder_sent:   '📧',
  renewed:         '🆕',
  escalated:       '🚨',
  override_granted: '🛡️',
  override_revoked: '🔒',
  shift_blocked:   '🚫',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ComplianceTimeline({ staffProfileId }: Props) {
  const [events,  setEvents]  = useState<ComplianceEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/compliance/timeline?staffProfileId=${staffProfileId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('Failed to load')
        return r.json() as Promise<{ events: ComplianceEvent[] }>
      })
      .then((d) => { if (!cancelled) setEvents(d.events) })
      .catch(() => { if (!cancelled) setError('Could not load compliance history') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [staffProfileId])

  if (loading) {
    return (
      <div className="px-4 py-6 text-center text-sm text-gray-400 animate-pulse">
        Loading compliance history…
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 py-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-100">
        {error}
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-gray-400">
        No compliance events recorded yet.
      </div>
    )
  }

  return (
    <div className="relative">
      {/* vertical line */}
      <div className="absolute left-[19px] top-0 bottom-0 w-px bg-gray-200" aria-hidden />

      <ul className="space-y-0">
        {events.map((event, i) => (
          <li key={event.id} className="flex gap-4 py-3 relative">
            {/* dot */}
            <span
              className={`flex-shrink-0 mt-0.5 w-[10px] h-[10px] rounded-full ring-2 ring-white z-10 ml-[15px] mt-[5px] ${EVENT_DOT_CLS[event.eventType] ?? 'bg-gray-300'}`}
              aria-hidden
            />

            {/* content */}
            <div className="min-w-0 flex-1 pb-3 border-b border-gray-50 last:border-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base leading-none" aria-hidden>{EVENT_ICON[event.eventType]}</span>
                  <p className="text-sm font-medium text-gray-800 truncate">{event.label}</p>
                </div>
                <time className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                  {fmtTs(event.timestamp)}
                </time>
              </div>
              {event.detail && (
                <p className="mt-0.5 text-xs text-on-surface-variant ml-6 truncate">{event.detail}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
