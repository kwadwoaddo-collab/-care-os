'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  MetricCard,
  MetricGrid,
  Card,
  PageHeader,
  SectionHeader,
  OperationalBanner,
  SeverityBadge,
  EmptyState,
  Skeleton,
  Button,
} from '@/components/ui'

interface Message {
  id:              string
  sender_name:     string
  subject:         string
  message_type:    string
  priority:        string
  channel:         string
  audience_type:   string
  status:          string
  sent_at:         string | null
  recipient_count: number
  auto_generated:  boolean
  created_at:      string
  reply_count:     number
}

const TYPE_COLOURS: Record<string, string> = {
  announcement:           'bg-blue-50 text-blue-700',
  compliance_reminder:    'bg-amber-50 text-amber-700',
  staffing_alert:         'bg-orange-50 text-orange-700',
  onboarding_reminder:    'bg-purple-50 text-purple-700',
  safeguarding_escalation:'bg-red-50 text-red-700',
  shift_communication:    'bg-indigo-50 text-indigo-700',
  broadcast:              'bg-slate-50 text-slate-700',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function CommunicationsPage() {
  const [messages,     setMessages]     = useState<Message[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [typeFilter,   setTypeFilter]   = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [triggering,   setTriggering]   = useState(false)
  const [triggerResult, setTriggerResult] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (typeFilter)   params.set('type', typeFilter)
    if (statusFilter) params.set('status', statusFilter)
    fetch(`/api/admin/communications?${params}`)
      .then(r => r.json())
      .then(d => setMessages(d.messages ?? []))
      .catch(() => setError('Failed to load messages'))
      .finally(() => setLoading(false))
  }, [typeFilter, statusFilter])

  useEffect(() => { load() }, [load])

  async function runTriggers(dry = false) {
    setTriggering(true)
    setTriggerResult(null)
    try {
      const res = await fetch('/api/admin/communications/triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dry_run: dry }),
      })
      const d = await res.json()
      setTriggerResult(
        `Compliance: ${d.compliance_expiry} · Onboarding: ${d.onboarding_stall} · Shifts: ${d.uncovered_shifts} · Safeguarding: ${d.safeguarding_alerts} · Skipped: ${d.skipped}`
      )
      if (!dry) load()
    } catch {
      setTriggerResult('Trigger failed')
    } finally { setTriggering(false) }
  }

  const counts = {
    total:    messages.length,
    sent:     messages.filter(m => m.status === 'sent').length,
    draft:    messages.filter(m => m.status === 'draft').length,
    critical: messages.filter(m => m.priority === 'critical').length,
    auto:     messages.filter(m => m.auto_generated).length,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Communications"
        subtitle="Operational messaging, broadcasts, and compliance reminders."
        actions={
          <>
            <Link href="/admin/communications/templates" className="px-3 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">
              Templates
            </Link>
            <Link href="/admin/communications/broadcast" className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
              + New Message
            </Link>
          </>
        }
      />

      <MetricGrid cols={5}>
        <MetricCard label="Total"    value={counts.total} />
        <MetricCard label="Sent"     value={counts.sent}    colour="emerald" />
        <MetricCard label="Drafts"   value={counts.draft} />
        <MetricCard label="Critical" value={counts.critical} colour={counts.critical > 0 ? 'red' : 'slate'} />
        <MetricCard label="Auto-gen" value={counts.auto}    colour="indigo" />
      </MetricGrid>

      {/* Smart trigger panel */}
      <Card>
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <SectionHeader title="Smart Triggers" className="mb-1" />
            <p className="text-xs text-slate-500">
              Scan for compliance expiries, onboarding stalls, uncovered shifts, and safeguarding alerts — then auto-generate messages.
            </p>
            {triggerResult && (
              <p className="text-xs text-indigo-700 mt-2 font-medium">{triggerResult}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="secondary" size="sm" onClick={() => runTriggers(true)} loading={triggering}>
              Dry Run
            </Button>
            <Button variant="warning" size="sm" onClick={() => runTriggers(false)} loading={triggering}>
              Run Triggers
            </Button>
          </div>
        </div>
      </Card>

      {error && (
        <OperationalBanner type="warning" message={error} dismissible />
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:border-indigo-400 bg-surface-container-lowest"
        >
          <option value="">All types</option>
          {['announcement','compliance_reminder','staffing_alert','onboarding_reminder','safeguarding_escalation','shift_communication','broadcast'].map(t => (
            <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:border-indigo-400 bg-surface-container-lowest"
        >
          <option value="">All statuses</option>
          {['draft','sent','failed','scheduled'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {(typeFilter || statusFilter) && (
          <button onClick={() => { setTypeFilter(''); setStatusFilter('') }} className="text-xs text-indigo-600 hover:underline">
            Clear
          </button>
        )}
      </div>

      {/* Messages list */}
      {loading ? (
        <Skeleton rows={4} />
      ) : messages.length === 0 ? (
        <Card>
          <EmptyState
            message="No messages yet."
            submessage="Send your first broadcast or run smart triggers to auto-generate compliance reminders."
            action={{ label: '+ New Message', href: '/admin/communications/broadcast' }}
            icon="📬"
          />
        </Card>
      ) : (
        <Card padding="none">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3 hidden md:table-cell">Type</th>
                <th className="px-4 py-3 hidden lg:table-cell">Priority</th>
                <th className="px-4 py-3 hidden md:table-cell">Status</th>
                <th className="px-4 py-3 hidden lg:table-cell">Recipients</th>
                <th className="px-4 py-3 hidden lg:table-cell">Sent</th>
                <th className="px-4 py-3 sr-only">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {messages.map(m => (
                <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-900 truncate max-w-xs">{m.subject}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-slate-400">{m.sender_name}</p>
                        {m.auto_generated && (
                          <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-medium">auto</span>
                        )}
                        {m.reply_count > 0 && (
                          <span className="text-[10px] text-slate-400">{m.reply_count} repl{m.reply_count === 1 ? 'y' : 'ies'}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${TYPE_COLOURS[m.message_type] ?? 'bg-slate-50 text-slate-600'}`}>
                      {m.message_type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <SeverityBadge
                      level={m.priority === 'critical' ? 'critical' : m.priority === 'urgent' ? 'urgent' : 'neutral'}
                      label={m.priority}
                    />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <SeverityBadge
                      level={m.status === 'sent' ? 'success' : m.status === 'failed' ? 'critical' : m.status === 'draft' ? 'neutral' : 'info'}
                      label={m.status}
                    />
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-slate-600 text-xs">{m.recipient_count}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-slate-400 text-xs">
                    {m.sent_at ? fmtDate(m.sent_at) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/communications/${m.id}`} className="text-indigo-600 hover:text-indigo-800 text-xs font-medium">
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
