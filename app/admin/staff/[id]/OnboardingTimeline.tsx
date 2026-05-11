'use client'

/**
 * OnboardingTimeline
 *
 * Lazy-loads and displays a chronological activity feed for a staff profile.
 * Embedded in the staff detail page near the onboarding checklist.
 */

import { useEffect, useState } from 'react'
import type { TimelineEvent } from '@/app/api/admin/staff/[id]/timeline/route'

const KIND_CLS: Record<string, string> = {
  invite:     'bg-indigo-100 text-indigo-700',
  document:   'bg-purple-100 text-purple-700',
  status:     'bg-blue-100   text-blue-700',
  policy:     'bg-green-100  text-green-700',
  reminder:   'bg-amber-100  text-amber-700',
  compliance: 'bg-teal-100   text-teal-700',
  other:      'bg-gray-100   text-gray-600',
}

function fmtTs(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7)  return `${diffDays} days ago`
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function OnboardingTimeline({ staffProfileId }: { staffProfileId: string }) {
  const [events,   setEvents]   = useState<TimelineEvent[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    fetch(`/api/admin/staff/${staffProfileId}/timeline`)
      .then(async (res) => {
        const json = await res.json() as { events: TimelineEvent[] } | { error: string }
        if (!res.ok) { setError('Could not load activity'); return }
        setEvents((json as { events: TimelineEvent[] }).events)
      })
      .catch(() => setError('Could not load activity'))
      .finally(() => setLoading(false))
  }, [staffProfileId])

  const visible = expanded ? events : events.slice(0, 5)

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Onboarding Activity</h2>
        {events.length > 0 && (
          <span className="text-xs text-gray-400">{events.length} event{events.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      <div className="p-4">
        {loading && (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-gray-100 flex-shrink-0" />
                <div className="flex-1 space-y-1.5 pt-0.5">
                  <div className="h-3 bg-gray-100 rounded w-3/4" />
                  <div className="h-2.5 bg-gray-100 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <p className="text-xs text-gray-400">{error}</p>
        )}

        {!loading && !error && events.length === 0 && (
          <p className="text-xs text-gray-400">No activity recorded yet.</p>
        )}

        {!loading && !error && events.length > 0 && (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gray-100" aria-hidden />

            <ol className="space-y-4 relative">
              {visible.map((ev) => (
                <li key={ev.id} className="flex gap-3">
                  {/* Icon dot */}
                  <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm z-10 ${KIND_CLS[ev.kind] ?? KIND_CLS.other}`}>
                    {ev.icon}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-sm text-gray-800 font-medium leading-tight">{ev.label}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">{fmtTs(ev.timestamp)}</span>
                      {ev.detail && (
                        <>
                          <span className="text-gray-200">·</span>
                          <span className="text-xs text-gray-400">{ev.detail}</span>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            {events.length > 5 && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="mt-4 w-full text-xs text-indigo-600 hover:text-indigo-800 font-medium text-center"
              >
                {expanded ? 'Show less' : `Show ${events.length - 5} more events`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
