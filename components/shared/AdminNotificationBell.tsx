'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminNotification {
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
  shift_accepted:      '✅',
  shift_declined:      '❌',
  running_late:        '⏰',
  shift_completed:     '🏁',
  visit_note:          '📝',
  incident_created:    '🚨',
  compliance_alert:    '⚠️',
  onboarding_completed:'🎉',
  info:                '💬',
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
  /** Polling interval in ms (default: 30 000) */
  pollMs?: number
}

export default function AdminNotificationBell({ pollMs = 30_000 }: Props) {
  const [open,          setOpen]          = useState(false)
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [loading,       setLoading]       = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const unread = notifications.filter((n) => !n.read_at).length

  const fetchNotifications = useCallback(async () => {
    try {
      const res  = await fetch('/api/admin/notifications/in-app?limit=30')
      if (!res.ok) return
      const data = await res.json() as AdminNotification[]
      setNotifications(data)
    } catch { /* silent — bell must never crash the admin panel */ }
  }, [])

  // Initial fetch + polling
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
        await fetch('/api/admin/notifications/in-app', { method: 'PATCH' })
      } catch { /* silent */ } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        id="admin-notification-bell-btn"
        type="button"
        onClick={() => { void handleOpen() }}
        aria-label={`Admin notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
        style={{
          position: 'relative',
          padding: '6px',
          borderRadius: '50%',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          color: '#6b7280',
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unread > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '-2px',
              right: '-2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: '#ef4444',
              color: '#fff',
              fontSize: '10px',
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          id="admin-notification-panel"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: '320px',
            background: '#fff',
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
            border: '1px solid #e5e7eb',
            overflow: 'hidden',
            zIndex: 50,
          }}
        >
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>Notifications</span>
            {loading && <span style={{ fontSize: '12px', color: '#9ca3af' }}>Updating…</span>}
          </div>

          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <p style={{ padding: '32px 16px', textAlign: 'center', fontSize: '13px', color: '#9ca3af' }}>
                All caught up ✓
              </p>
            ) : (
              notifications.map((n) => {
                const icon = EVENT_ICON[n.event_type] ?? EVENT_ICON.info
                const inner = (
                  <div
                    style={{
                      padding: '12px 16px',
                      display: 'flex',
                      gap: '12px',
                      background: !n.read_at ? '#eff6ff' : 'transparent',
                      borderBottom: '1px solid #f9fafb',
                      cursor: n.action_url ? 'pointer' : 'default',
                    }}
                  >
                    <span style={{ fontSize: '18px', flexShrink: 0, lineHeight: 1, marginTop: '2px' }}>{icon}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontSize: '13px', fontWeight: !n.read_at ? 600 : 500, color: !n.read_at ? '#111827' : '#374151', margin: 0, lineHeight: 1.4 }}>
                        {n.title}
                      </p>
                      {n.message && (
                        <p style={{ fontSize: '12px', color: '#6b7280', margin: '3px 0 0', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {n.message}
                        </p>
                      )}
                      <p style={{ fontSize: '10px', color: '#9ca3af', margin: '4px 0 0' }}>{formatRelative(n.created_at)}</p>
                    </div>
                  </div>
                )
                return n.action_url ? (
                  <Link key={n.id} href={n.action_url} onClick={() => setOpen(false)} style={{ display: 'block', textDecoration: 'none' }}>
                    {inner}
                  </Link>
                ) : (
                  <div key={n.id}>{inner}</div>
                )
              })
            )}
          </div>

          <div style={{ padding: '10px 16px', borderTop: '1px solid #f3f4f6' }}>
            <Link
              href="/admin/notifications"
              onClick={() => setOpen(false)}
              style={{ fontSize: '12px', color: '#4f46e5', fontWeight: 500, textDecoration: 'none' }}
            >
              View all notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
