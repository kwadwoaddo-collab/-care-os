'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'

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
  shift_offer:           '📅',
  shift_accepted:        '✅',
  shift_declined:        '❌',
  running_late:          '⏰',
  document_rejected:     '📋',
  compliance_expiring:   '⚠️',
  onboarding_reminder:   '🔔',
  visit_note:            '📝',
  info:                  '💬',
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  /** Worker portal token (from URL query param) */
  token: string
  /** Polling interval in ms (default: 30 000) */
  pollMs?: number
}

export default function NotificationBell({ token, pollMs = 30_000 }: Props) {
  const [open,          setOpen]          = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading,       setLoading]       = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const unread = notifications.filter((n) => !n.read_at).length

  const fetchNotifications = useCallback(async () => {
    if (!token) return
    try {
      const res  = await fetch(`/api/worker/notifications?token=${encodeURIComponent(token)}`)
      if (!res.ok) return
      const data = await res.json() as Notification[]
      setNotifications(data)
    } catch { /* silent — bell should never crash the portal */ }
  }, [token])

  // Initial fetch + polling
  useEffect(() => {
    void fetchNotifications()
    const id = setInterval(() => { void fetchNotifications() }, pollMs)
    return () => clearInterval(id)
  }, [fetchNotifications, pollMs])

  // Click-outside to close
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  async function handleOpen() {
    setOpen((o) => !o)
    if (!open && unread > 0) {
      // Mark all as read optimistically
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
      setLoading(true)
      try {
        await fetch(`/api/worker/notifications?token=${encodeURIComponent(token)}`, { method: 'PATCH' })
      } catch { /* silent */ } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        id="notification-bell-btn"
        type="button"
        onClick={() => { void handleOpen() }}
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
        className="relative p-1.5 rounded-full text-gray-300 hover:text-white transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          id="notification-panel"
          className="absolute right-0 top-full mt-2 w-80 bg-surface-container-lowest rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50"
        >
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Notifications</h2>
            {loading && <span className="text-xs text-gray-400">Updating…</span>}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">You&apos;re all caught up ✓</p>
            ) : (
              notifications.map((n) => {
                const icon = EVENT_ICON[n.event_type] ?? EVENT_ICON.info
                const inner = (
                  <div className={`px-4 py-3 flex gap-3 hover:bg-gray-50 transition-colors ${!n.read_at ? 'bg-indigo-50/40' : ''}`}>
                    <span className="text-lg flex-shrink-0 leading-none mt-0.5">{icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm leading-snug ${!n.read_at ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {n.title}
                      </p>
                      {n.message && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1">{formatRelative(n.created_at)}</p>
                    </div>
                  </div>
                )
                return n.action_url ? (
                  <Link key={n.id} href={n.action_url} onClick={() => setOpen(false)}>
                    {inner}
                  </Link>
                ) : (
                  <div key={n.id}>{inner}</div>
                )
              })
            )}
          </div>

          <div className="px-4 py-2.5 border-t border-gray-100">
            <Link
              href="/worker/notifications"
              onClick={() => setOpen(false)}
              className="text-xs text-indigo-600 font-medium hover:underline"
            >
              View all notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
