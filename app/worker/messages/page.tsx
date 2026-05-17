'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface WorkerMessage {
  id:              string
  subject:         string
  body:            string
  message_type:    string
  priority:        string
  sent_at:         string | null
  created_at:      string
  read_at:         string | null
  acknowledged_at: string | null
  delivery_status: string
  entity_url:      string | null
  source:          'operational' | 'in_app'
}

const TYPE_ICON: Record<string, string> = {
  compliance_reminder:    '⚠️',
  onboarding_reminder:    '📋',
  staffing_alert:         '📅',
  safeguarding_escalation:'🚨',
  shift_communication:    '🔄',
  announcement:           '📣',
  broadcast:              '📢',
  onboarding_completed:   '✅',
  compliance_expiring:    '⏰',
  compliance_alert:       '⚠️',
  shift_assigned:         '📅',
  document_rejected:      '📄',
  shift_offer:            '🤝',
  info:                   '💬',
}

const PRIORITY_CLASSES: Record<string, string> = {
  critical: 'border-l-4 border-red-500',
  urgent:   'border-l-4 border-amber-500',
  normal:   '',
}

function formatDate(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffH  = diffMs / 3_600_000

  if (diffH < 1)     return 'Just now'
  if (diffH < 24)    return `${Math.floor(diffH)}h ago`
  if (diffH < 48)    return 'Yesterday'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function MessagesInner() {
  const params  = useSearchParams()
  const token   = params.get('token') ?? ''

  const [messages,  setMessages]  = useState<WorkerMessage[]>([])
  const [unread,    setUnread]    = useState(0)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [expanded,  setExpanded]  = useState<string | null>(null)
  const [filter,    setFilter]    = useState<'all' | 'unread' | 'compliance' | 'shifts'>('all')

  useEffect(() => {
    if (!token) { setLoading(false); setError('Portal token missing.'); return }
    fetch(`/api/worker/messages?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(d => {
        setMessages(d.messages ?? [])
        setUnread(d.unread_count ?? 0)
      })
      .catch(() => setError('Failed to load messages.'))
      .finally(() => setLoading(false))
  }, [token])

  async function markRead(msg: WorkerMessage) {
    if (msg.read_at) return
    await fetch(`/api/worker/messages?token=${encodeURIComponent(token)}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ message_id: msg.id, source: msg.source }),
    })
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, read_at: new Date().toISOString() } : m))
    setUnread(prev => Math.max(0, prev - 1))
  }

  function toggleExpand(msg: WorkerMessage) {
    setExpanded(prev => prev === msg.id ? null : msg.id)
    markRead(msg)
  }

  const urgentMessages = messages.filter(m => m.priority === 'critical' && !m.acknowledged_at)

  const filtered = messages.filter(m => {
    if (filter === 'unread')     return !m.read_at
    if (filter === 'compliance') return m.message_type.includes('compliance') || m.message_type.includes('onboarding')
    if (filter === 'shifts')     return m.message_type.includes('shift')
    return true
  })

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/worker/dashboard" className="text-sm text-gray-500 hover:text-gray-900">
          ← Dashboard
        </Link>
      </div>

      {/* Urgent broadcast banners */}
      {urgentMessages.map(msg => (
        <div key={msg.id} className="bg-red-600 rounded-xl p-4 space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-xl shrink-0">🚨</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">{msg.subject}</p>
              <p className="text-xs text-red-100 mt-0.5 line-clamp-2">{msg.body}</p>
            </div>
          </div>
          <button
            onClick={async () => {
              await fetch(`/api/worker/messages?token=${encodeURIComponent(token)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message_id: msg.id, source: msg.source }),
              })
              setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, acknowledged_at: new Date().toISOString(), read_at: m.read_at ?? new Date().toISOString() } : m))
              setUnread(prev => Math.max(0, prev - 1))
            }}
            className="w-full py-2 bg-white text-red-700 text-xs font-bold rounded-lg hover:bg-red-50 transition-colors"
          >
            Acknowledge — I have read this
          </button>
        </div>
      ))}

      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Messages</h1>
          {unread > 0 && (
            <p className="text-sm text-indigo-600 font-medium mt-0.5">{unread} unread message{unread !== 1 ? 's' : ''}</p>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          { key: 'all',        label: 'All' },
          { key: 'unread',     label: 'Unread' },
          { key: 'compliance', label: 'Compliance' },
          { key: 'shifts',     label: 'Shifts' },
        ] as { key: typeof filter; label: string }[]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === tab.key
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 flex flex-col items-center text-center space-y-3">
          <span className="text-4xl">📬</span>
          <p className="text-sm font-medium text-gray-700">
            {filter === 'all' ? "You're all caught up" : `No ${filter} messages`}
          </p>
          <p className="text-xs text-gray-400">
            Compliance reminders, shift updates, and notices will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(msg => {
            const icon    = TYPE_ICON[msg.message_type] ?? TYPE_ICON.info
            const isOpen  = expanded === msg.id
            const isUnread = !msg.read_at

            return (
              <div
                key={msg.id}
                className={[
                  'bg-white rounded-xl border transition-all overflow-hidden',
                  isUnread ? 'border-indigo-200 shadow-sm' : 'border-gray-200',
                  PRIORITY_CLASSES[msg.priority] ?? '',
                ].join(' ')}
              >
                {/* Header row — always visible */}
                <button
                  onClick={() => toggleExpand(msg)}
                  className="w-full text-left flex items-start gap-3 p-4"
                >
                  <span className="text-xl shrink-0 mt-0.5">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm leading-snug truncate pr-2 ${isUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {msg.subject}
                        {isUnread && <span className="ml-1.5 inline-block w-2 h-2 bg-indigo-500 rounded-full align-middle" />}
                      </p>
                      <span className="text-[11px] text-gray-400 shrink-0">{formatDate(msg.sent_at ?? msg.created_at)}</span>
                    </div>
                    {!isOpen && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{msg.body.slice(0, 80)}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {msg.priority !== 'normal' && (
                        <span className={`text-[10px] font-semibold uppercase ${msg.priority === 'critical' ? 'text-red-600' : 'text-amber-600'}`}>
                          {msg.priority}
                        </span>
                      )}
                      {msg.acknowledged_at && (
                        <span className="text-[10px] text-emerald-600 font-medium">Acknowledged</span>
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded body */}
                {isOpen && (
                  <div className="px-4 pb-4 pt-0 space-y-3">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {msg.entity_url && (
                        <Link
                          href={msg.entity_url}
                          className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700"
                        >
                          View Details
                        </Link>
                      )}
                      {!msg.acknowledged_at && msg.source === 'operational' && (
                        <button
                          onClick={async () => {
                            await fetch(`/api/admin/communications/${msg.id}/recipients`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({}),
                            })
                            setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, acknowledged_at: new Date().toISOString() } : m))
                          }}
                          className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50"
                        >
                          Acknowledge
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function WorkerMessagesPage() {
  return (
    <Suspense fallback={
      <div className="space-y-3 pt-4">
        {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    }>
      <MessagesInner />
    </Suspense>
  )
}
