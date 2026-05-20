'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Notification {
  id:         string
  title:      string
  message:    string | null
  action_url: string | null
  event_type: string
  read_at:    string | null
  created_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const EVENT_ICON: Record<string, string> = {
  shift_offer:         '📅',
  shift_accepted:      '✅',
  shift_declined:      '❌',
  running_late:        '⏰',
  document_rejected:   '📋',
  compliance_expiring: '⚠️',
  onboarding_reminder: '🔔',
  visit_note:          '📝',
  info:                '💬',
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Inner page (needs useSearchParams) ────────────────────────────────────────

function NotificationsInner() {
  const params = useSearchParams()
  const token  = params.get('token') ?? ''

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    if (!token) { setLoading(false); setError('Portal token missing from URL.'); return }
    setLoading(true)
    fetch(`/api/worker/notifications?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json() as Notification[] | { error: string }
        if (!res.ok) { setError((data as { error: string }).error ?? 'Failed to load'); return }
        setNotifications(data as Notification[])
        // Mark all as read
        void fetch(`/api/worker/notifications?token=${encodeURIComponent(token)}`, { method: 'PATCH' })
      })
      .catch(() => setError('Network error — please try again.'))
      .finally(() => setLoading(false))
  }, [token])

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center gap-3">
        <Link href="/worker/dashboard" className="text-sm text-gray-500 hover:text-gray-900">
          ← Dashboard
        </Link>
      </div>

      <h1 className="text-xl font-bold text-gray-900">Notifications</h1>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface-container-lowest rounded-xl border border-gray-200 p-4 flex gap-3 animate-pulse">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-100 rounded w-3/5" />
                <div className="h-3 bg-gray-100 rounded w-2/5" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
          <p className="font-medium mb-2">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-xs text-red-600 underline"
          >
            Retry
          </button>
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl border border-gray-200 p-12 flex flex-col items-center text-center space-y-3">
          <span className="text-4xl">🔔</span>
          <p className="text-sm font-medium text-gray-700">You&apos;re all caught up</p>
          <p className="text-xs text-gray-400">New shift offers, document updates, and reminders will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const icon = EVENT_ICON[n.event_type] ?? EVENT_ICON.info
            const inner = (
              <div
                className={[
                  'flex gap-3 items-start p-4 bg-surface-container-lowest rounded-xl border transition-colors',
                  !n.read_at ? 'border-indigo-200 bg-indigo-50/30' : 'border-gray-200 hover:bg-gray-50',
                ].join(' ')}
              >
                <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${!n.read_at ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                    {n.title}
                    {!n.read_at && (
                      <span className="ml-2 inline-block w-2 h-2 bg-indigo-500 rounded-full align-middle" />
                    )}
                  </p>
                  {n.message && (
                    <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1">{formatDateTime(n.created_at)}</p>
                </div>
                {n.action_url && (
                  <span className="text-indigo-600 text-xs font-medium flex-shrink-0">View →</span>
                )}
              </div>
            )
            return n.action_url ? (
              <Link key={n.id} href={n.action_url}>{inner}</Link>
            ) : (
              <div key={n.id}>{inner}</div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Page export (wrapped in Suspense for useSearchParams) ─────────────────────

export default function WorkerNotificationsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-3 pt-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    }>
      <NotificationsInner />
    </Suspense>
  )
}
