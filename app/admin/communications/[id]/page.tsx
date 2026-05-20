'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface Message {
  id: string; sender_name: string; subject: string; body: string
  message_type: string; priority: string; channel: string
  audience_type: string; status: string; sent_at: string | null
  recipient_count: number; auto_generated: boolean; created_at: string
  entity_url: string | null; trigger_type: string | null
}

interface Recipient {
  id: string; recipient_name: string | null; recipient_email: string | null
  delivery_channel: string; status: string; sent_at: string | null
  read_at: string | null; acknowledged_at: string | null
  error_message: string | null
}

interface Reply {
  id: string; sender_name: string; body: string; created_at: string
}

interface Stats {
  total: number; sent: number; read: number; acknowledged: number; failed: number
}

const STATUS_COLOURS: Record<string, string> = {
  sent:         'text-emerald-600',
  read:         'text-blue-600',
  acknowledged: 'text-indigo-600',
  failed:       'text-red-600',
  pending:      'text-slate-400',
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function MessageDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [message,    setMessage]    = useState<Message | null>(null)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [replies,    setReplies]    = useState<Reply[]>([])
  const [stats,      setStats]      = useState<Stats | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [replyText,  setReplyText]  = useState('')
  const [replying,   setReplying]   = useState(false)
  const [tab,        setTab]        = useState<'recipients' | 'thread'>('recipients')

  useEffect(() => {
    fetch(`/api/admin/communications/${id}`)
      .then(r => r.json())
      .then(d => {
        setMessage(d.message)
        setRecipients(d.recipients ?? [])
        setReplies(d.replies ?? [])
        setStats(d.stats)
      })
      .finally(() => setLoading(false))
  }, [id])

  async function sendReply() {
    if (!replyText.trim()) return
    setReplying(true)
    const res = await fetch(`/api/admin/communications/${id}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: replyText }),
    })
    const d = await res.json()
    if (d.reply) {
      setReplies(prev => [...prev, d.reply])
      setReplyText('')
      setTab('thread')
    }
    setReplying(false)
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><span className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
  }

  if (!message) {
    return <div className="text-center py-24"><p className="text-slate-500">Message not found.</p><Link href="/admin/communications" className="text-indigo-600 text-sm mt-2 inline-block">Back</Link></div>
  }

  const deliveryPct = stats && stats.total > 0 ? Math.round((stats.read / stats.total) * 100) : 0

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/admin/communications" className="hover:text-indigo-600">Communications</Link>
        <span>/</span>
        <span className="text-slate-800 truncate max-w-xs">{message.subject}</span>
      </div>

      {/* Message card */}
      <div className="bg-surface-container-lowest border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{message.subject}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-slate-500">
              <span>From: <strong>{message.sender_name}</strong></span>
              <span>&bull;</span>
              <span className="capitalize">{message.message_type.replace(/_/g, ' ')}</span>
              <span>&bull;</span>
              <span className={`font-semibold capitalize ${message.priority === 'critical' ? 'text-red-600' : message.priority === 'urgent' ? 'text-amber-600' : 'text-slate-500'}`}>{message.priority}</span>
              {message.auto_generated && <span className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-medium">auto-generated</span>}
            </div>
          </div>
          <div className="text-right text-xs text-slate-400">
            <p>Sent {fmtDate(message.sent_at)}</p>
            <p className="mt-0.5">{message.channel} &bull; {message.audience_type.replace(/_/g, ' ')}</p>
          </div>
        </div>

        <div className="bg-slate-50 rounded-lg p-4">
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{message.body}</p>
        </div>

        {message.entity_url && (
          <a href={message.entity_url} className="text-sm text-indigo-600 hover:underline">View linked record →</a>
        )}
      </div>

      {/* Delivery stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Recipients', value: stats.total },
            { label: 'Sent',       value: stats.sent,         colour: 'text-emerald-600' },
            { label: 'Read',       value: stats.read,          colour: 'text-blue-600' },
            { label: 'Ack\'d',     value: stats.acknowledged,  colour: 'text-indigo-600' },
            { label: 'Failed',     value: stats.failed,        colour: stats.failed > 0 ? 'text-red-600' : undefined },
          ].map(({ label, value, colour }) => (
            <div key={label} className="bg-surface-container-lowest border border-slate-200 rounded-xl p-4">
              <p className={`text-2xl font-bold ${colour ?? 'text-slate-900'}`}>{value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {stats && stats.total > 0 && (
        <div className="bg-surface-container-lowest border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-600">Read rate</span>
            <span className="text-xs font-bold text-slate-800">{deliveryPct}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${deliveryPct}%` }} />
          </div>
        </div>
      )}

      {/* Tabs: Recipients | Thread */}
      <div className="bg-surface-container-lowest border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex border-b border-slate-100">
          <button
            onClick={() => setTab('recipients')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === 'recipients' ? 'text-indigo-700 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Recipients ({recipients.length})
          </button>
          <button
            onClick={() => setTab('thread')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === 'thread' ? 'text-indigo-700 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Thread ({replies.length})
          </button>
        </div>

        {tab === 'recipients' && (
          <div className="overflow-x-auto">
            {recipients.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No recipients recorded yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">
                    <th className="px-4 py-2.5">Recipient</th>
                    <th className="px-4 py-2.5">Channel</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Sent</th>
                    <th className="px-4 py-2.5">Read</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recipients.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{r.recipient_name ?? 'Unknown'}</p>
                        {r.recipient_email && <p className="text-xs text-slate-400">{r.recipient_email}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 capitalize">{r.delivery_channel}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold capitalize ${STATUS_COLOURS[r.status] ?? 'text-slate-400'}`}>
                          {r.status}
                        </span>
                        {r.error_message && <p className="text-xs text-red-500 mt-0.5 truncate max-w-xs">{r.error_message}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{fmtDate(r.sent_at)}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">{fmtDate(r.read_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'thread' && (
          <div className="p-4 space-y-4">
            {replies.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No replies yet. Add a follow-up below.</p>
            ) : (
              <div className="space-y-3">
                {replies.map(r => (
                  <div key={r.id} className="bg-slate-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-slate-700">{r.sender_name}</p>
                      <p className="text-xs text-slate-400">{fmtDate(r.created_at)}</p>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{r.body}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Reply form */}
            <div className="border-t border-slate-100 pt-4 space-y-2">
              <textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="Add a follow-up or escalation comment…"
                rows={3}
                className="input resize-none"
              />
              <div className="flex justify-end">
                <button
                  onClick={sendReply}
                  disabled={replying || !replyText.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2"
                >
                  {replying && <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />}
                  Post Reply
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Link href="/admin/communications" className="text-sm text-slate-500 hover:text-slate-700 inline-block">
        &larr; Back to Communications
      </Link>
    </div>
  )
}
