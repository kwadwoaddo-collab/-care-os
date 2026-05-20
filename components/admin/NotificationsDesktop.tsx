'use client'

import React from 'react'

export interface NotificationLog {
  id:              string
  company_id:      string
  event_type:      string
  recipient_email: string | null
  subject:         string | null
  status:          'sent' | 'failed' | 'skipped'
  error_message:   string | null
  entity_type:     string | null
  entity_id:       string | null
  created_at:      string
}

interface Props {
  logs: NotificationLog[]
  counts: {
    all: number
    sent: number
    failed: number
    skipped: number
  }
  onSendDigest: () => void
  onSendReminders: () => void
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) + '\n' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  )
}

const EVENT_CLS: Record<string, string> = {
  'shift.assigned':    'bg-indigo-100 text-indigo-800',
  'shift.declined':    'bg-red-100    text-red-800',
  'shift.running_late': 'bg-yellow-100 text-yellow-800',
  'incident.escalated': 'bg-orange-100 text-orange-800',
  'compliance.expiring': 'bg-amber-100 text-amber-800',
  'daily.digest':      'bg-blue-100   text-blue-800',
  'shift.reminder':    'bg-purple-100 text-purple-800',
}

const STATUS_CLS: Record<string, string> = {
  sent:    'bg-green-100 text-green-800',
  failed:  'bg-red-100 text-red-800',
  skipped: 'bg-gray-100 text-gray-800',
}

function getInitials(email: string | null): string {
  if (!email) return '?'
  const parts = email.split('@')[0].split(/[._-]/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return email.slice(0, 2).toUpperCase()
}

function formatName(email: string | null): string {
  if (!email) return 'Unknown Recipient'
  const namePart = email.split('@')[0]
  return namePart.split(/[._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
}

function getChannelData(eventType: string) {
  if (eventType.includes('sms')) return { icon: 'sms', label: 'SMS' }
  if (eventType.includes('push')) return { icon: 'notifications', label: 'Push' }
  return { icon: 'mail', label: 'Email' }
}

export default function NotificationsDesktop({ logs, counts, onSendDigest, onSendReminders }: Props) {
  // Mock trend data based on current counts
  const sentRate = counts.all > 0 ? ((counts.sent / counts.all) * 100).toFixed(1) : '0.0'
  
  return (
    <div className="space-y-6" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
      
      {/* ── Header & KPI Row ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1e293b]">Notification Log</h1>
            <p className="text-sm font-medium text-slate-500 mt-1">Real-time history of system-generated communications across all channels.</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={onSendDigest}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">calendar_today</span>
              Send Daily Digest
            </button>
            <button 
              onClick={onSendReminders}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1e293b] text-sm font-bold text-white hover:bg-slate-800 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">send</span>
              Send Reminders
            </button>
          </div>
        </div>

        {/* 4 Equal KPI Cards */}
        <div className="grid grid-cols-4 gap-6">
          <div className="bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-sm p-6 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start">
              <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-slate-600 text-[20px]">bar_chart</span>
              </div>
              <span className="text-[11px] font-bold text-slate-500">+12% vs last week</span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Notifications</p>
              <p className="text-3xl font-bold text-[#1e293b] leading-none">{counts.all.toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-sm p-6 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-indigo-600 text-[20px]">check_circle</span>
              </div>
              <span className="text-[11px] font-bold text-indigo-600">{sentRate}% Rate</span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Successfully Sent</p>
              <p className="text-3xl font-bold text-[#1e293b] leading-none">{counts.sent.toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-sm p-6 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start">
              <div className="w-10 h-10 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-red-600 text-[20px]">error</span>
              </div>
              <span className="text-[11px] font-bold text-red-600">-0.4% Improvement</span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Delivery Failed</p>
              <p className="text-3xl font-bold text-[#1e293b] leading-none">{counts.failed.toLocaleString()}</p>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-sm p-6 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start">
              <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-slate-600 text-[20px]">block</span>
              </div>
              <span className="text-[11px] font-bold text-slate-500">Unsubscribed</span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Skipped / Blocked</p>
              <p className="text-3xl font-bold text-[#1e293b] leading-none">{counts.skipped.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Transmission History Table ───────────────────────────────────── */}
      <div className="bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-sm overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#1e293b]">Transmission History</h2>
          <div className="flex items-center gap-4 text-slate-400">
            <button className="hover:text-slate-600 transition-colors"><span className="material-symbols-outlined text-[20px]">filter_list</span></button>
            <button className="hover:text-slate-600 transition-colors"><span className="material-symbols-outlined text-[20px]">download</span></button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">Timestamp</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Recipient</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Event</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Channel</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {logs.slice(0, 10).map((log) => {
                const init = getInitials(log.recipient_email)
                const name = formatName(log.recipient_email)
                const channel = getChannelData(log.event_type)
                
                return (
                  <tr key={log.id} className="h-[64px] hover:bg-slate-50 transition-colors group">
                    <td className="px-6">
                      <div className="font-mono text-xs text-[#1e293b] leading-tight whitespace-pre-wrap">
                        {formatDateTime(log.created_at)}
                      </div>
                    </td>
                    <td className="px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-indigo-700">{init}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-[#1e293b]">{name}</span>
                          <span className="text-[11px] font-medium text-slate-500 truncate max-w-[150px]">{log.recipient_email ?? '—'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${EVENT_CLS[log.event_type] ?? 'bg-slate-100 text-slate-700'}`}>
                        {log.event_type.replace(/_/g, ' ').replace(/\./g, ' ')}
                      </span>
                    </td>
                    <td className="px-6">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <span className="material-symbols-outlined text-[16px]">{channel.icon}</span>
                        <span className="text-sm font-medium">{channel.label}</span>
                      </div>
                    </td>
                    <td className="px-6">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_CLS[log.status]}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          log.status === 'sent' ? 'bg-green-500' : log.status === 'failed' ? 'bg-red-500' : 'bg-slate-400'
                        }`} />
                        {log.status === 'sent' ? 'Delivered' : log.status === 'failed' ? 'Failed' : 'Processing'}
                      </span>
                    </td>
                    <td className="px-6 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {log.status === 'failed' ? (
                          <button className="p-1.5 text-slate-400 hover:text-[#1e293b] hover:bg-slate-100 rounded">
                            <span className="material-symbols-outlined text-[20px]">refresh</span>
                          </button>
                        ) : (
                          <button className="p-1.5 text-slate-400 hover:text-[#1e293b] hover:bg-slate-100 rounded">
                            <span className="material-symbols-outlined text-[20px]">visibility</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm font-medium text-slate-400">
                    No records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination mock footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">
            Showing {Math.min(logs.length, 10)} of {logs.length}
          </span>
          <div className="flex gap-1">
            <button className="w-8 h-8 rounded flex items-center justify-center text-slate-400 hover:bg-slate-100"><span className="material-symbols-outlined text-[18px]">chevron_left</span></button>
            <button className="w-8 h-8 rounded bg-[#1e293b] text-white text-xs font-bold flex items-center justify-center">1</button>
            <button className="w-8 h-8 rounded text-slate-600 hover:bg-slate-100 text-xs font-bold flex items-center justify-center">2</button>
            <button className="w-8 h-8 rounded text-slate-600 hover:bg-slate-100 text-xs font-bold flex items-center justify-center">3</button>
            <button className="w-8 h-8 rounded flex items-center justify-center text-slate-600 hover:bg-slate-100"><span className="material-symbols-outlined text-[18px]">chevron_right</span></button>
          </div>
        </div>
      </div>

      {/* ── Channel Analytics Footer ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-6">
        
        {/* Email Gateway Status */}
        <div className="bg-[#1e293b] rounded-xl border border-slate-700 shadow-xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-white mb-2">System Health: Email Gateway</h3>
            <p className="text-sm font-medium text-slate-400 max-w-sm">
              All communication channels are currently operational. Average latency is 24ms across 4 regions.
            </p>
          </div>
          <div className="flex items-center gap-4 mt-8">
            <div className="flex gap-0.5">
              <div className="w-4 h-6 bg-green-500 rounded-sm" />
              <div className="w-4 h-6 bg-green-500 rounded-sm" />
              <div className="w-4 h-6 bg-green-500 rounded-sm" />
            </div>
            <span className="text-xs font-bold text-white tracking-widest uppercase">99.9% Uptime</span>
          </div>
        </div>

        {/* Top Channels */}
        <div className="bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-sm p-6">
          <h3 className="text-base font-bold text-[#1e293b] mb-6">Top Channels</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-bold text-[#1e293b] mb-1.5">
                <span>Email</span>
                <span>72%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 rounded-full" style={{ width: '72%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs font-bold text-[#1e293b] mb-1.5">
                <span>SMS</span>
                <span>22%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-400 rounded-full" style={{ width: '22%' }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs font-bold text-[#1e293b] mb-1.5">
                <span>Push</span>
                <span>6%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-300 rounded-full" style={{ width: '6%' }} />
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  )
}
