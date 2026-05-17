'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus'

// ── Types ─────────────────────────────────────────────────────────────────────

interface VisitNote {
  id:         string
  shift_id:   string
  shifts:     { title: string; shift_date: string; start_time: string; client_name: string | null } | null
}

interface VisitTask {
  id:               string
  task_type:        string
  task_name:        string
  task_description: string | null
  status:           string
  notes:            string | null
  visit_note_id:    string
  visit_notes:      VisitNote | null
}

interface SimpleTask {
  id:               string
  task_type:        string
  task_name:        string
  task_description: string | null
  status:           string
  priority:         string
  href:             string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, string> = {
  care:            '🤝',
  medication:      '💊',
  observation:     '👁️',
  wellbeing:       '❤️',
  risk:            '⚠️',
  documentation:   '📄',
  acknowledgement: '✅',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function fmtTime(t: string) { return t.slice(0, 5) }

// ── Component ─────────────────────────────────────────────────────────────────

export default function WorkerTasksPage() {
  const [visitTasks, setVisitTasks] = useState<VisitTask[]>([])
  const [docTasks,   setDocTasks]   = useState<SimpleTask[]>([])
  const [ackTasks,   setAckTasks]   = useState<SimpleTask[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [token,      setToken]      = useState('')
  const [updating,   setUpdating]   = useState<string | null>(null)
  const [noteText,   setNoteText]   = useState<Record<string, string>>({})
  const [helpOpen,   setHelpOpen]   = useState<string | null>(null)

  const online = useOnlineStatus()

  const load = useCallback(async (tok: string) => {
    const res = await fetch(`/api/worker/tasks?token=${encodeURIComponent(tok)}`)
    const d   = await res.json()
    setVisitTasks(d.visit_tasks ?? [])
    setDocTasks(d.doc_tasks   ?? [])
    setAckTasks(d.ack_tasks   ?? [])
  }, [])

  useEffect(() => {
    const tok = sessionStorage.getItem('worker_token') ?? ''
    if (!tok) { setError('Session expired.'); setLoading(false); return }
    setToken(tok)
    load(tok).catch(() => setError('Failed to load tasks.')).finally(() => setLoading(false))
  }, [load])

  async function markDone(taskId: string) {
    if (!online) return
    setUpdating(taskId)
    await fetch('/api/worker/tasks', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token, task_id: taskId, status: 'completed', notes: noteText[taskId] ?? null }),
    })
    setVisitTasks(prev => prev.filter(t => t.id !== taskId))
    setUpdating(null)
    setHelpOpen(null)
  }

  const totalCount = visitTasks.length + docTasks.length + ackTasks.length

  if (loading) return (
    <div className="space-y-3 animate-pulse">
      {[1,2,3,4].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}
    </div>
  )

  if (error) return (
    <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>
  )

  return (
    <div className="space-y-5 pb-6">
      {/* Offline banner */}
      {!online && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3 text-sm text-amber-700">
          <span className="text-base shrink-0">📡</span>
          <span>You are offline. Actions will be available when reconnected.</span>
        </div>
      )}

      <div>
        <h1 className="text-xl font-bold text-gray-900">Task Centre</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {totalCount > 0 ? `${totalCount} pending action${totalCount !== 1 ? 's' : ''}` : 'All caught up'}
        </p>
      </div>

      {totalCount === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 flex flex-col items-center gap-3 text-center">
          <span className="text-4xl">✅</span>
          <p className="text-sm font-medium text-gray-700">Nothing outstanding</p>
          <p className="text-xs text-gray-400">New tasks will appear here as they come in.</p>
        </div>
      )}

      {/* Shift confirmations */}
      {ackTasks.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Confirm Shifts</h2>
          <div className="space-y-2">
            {ackTasks.map(task => (
              <Link
                key={task.id}
                href={task.href}
                className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3.5 hover:border-amber-300 active:scale-[0.98] transition-all"
              >
                <span className="text-xl shrink-0 mt-0.5">{TYPE_ICON.acknowledgement}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{task.task_name}</p>
                  {task.task_description && (
                    <p className="text-xs text-gray-500 mt-0.5">{task.task_description}</p>
                  )}
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${task.priority === 'today' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                  {task.priority === 'today' ? 'Today' : 'Upcoming'}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Document tasks */}
      {docTasks.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Documents Needed</h2>
          <div className="space-y-2">
            {docTasks.map(task => (
              <Link
                key={task.id}
                href={task.href}
                className={`flex items-start gap-3 rounded-xl border p-3.5 active:scale-[0.98] transition-all ${
                  task.priority === 'overdue'
                    ? 'bg-red-50 border-red-200 hover:border-red-300'
                    : 'bg-amber-50 border-amber-200 hover:border-amber-300'
                }`}
              >
                <span className="text-xl shrink-0 mt-0.5">{TYPE_ICON.documentation}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{task.task_name}</p>
                  {task.task_description && (
                    <p className="text-xs text-gray-500 mt-0.5">{task.task_description}</p>
                  )}
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${task.priority === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                  {task.priority === 'overdue' ? 'Expired' : 'Expiring'}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Visit tasks */}
      {visitTasks.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Visit Tasks</h2>
          <div className="space-y-3">
            {visitTasks.map(task => {
              const shift    = task.visit_notes?.shifts ?? null
              const isHelp   = helpOpen === task.id
              const isBusy   = updating === task.id

              return (
                <div key={task.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="p-3.5">
                    <div className="flex items-start gap-3">
                      <span className="text-xl shrink-0 mt-0.5">{TYPE_ICON[task.task_type] ?? '📋'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{task.task_name}</p>
                        {task.task_description && (
                          <p className="text-xs text-gray-500 mt-0.5">{task.task_description}</p>
                        )}
                        {shift && (
                          <p className="text-xs text-indigo-600 mt-0.5">
                            {shift.title} · {fmtDate(shift.shift_date)} {fmtTime(shift.start_time)}
                            {shift.client_name ? ` · ${shift.client_name}` : ''}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action bar */}
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => markDone(task.id)}
                        disabled={isBusy || !online}
                        className="flex-1 min-h-[44px] bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        {isBusy
                          ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          : '✓'
                        }
                        Done
                      </button>
                      <button
                        onClick={() => setHelpOpen(isHelp ? null : task.id)}
                        className="px-4 min-h-[44px] border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
                      >
                        {isHelp ? 'Cancel' : 'Help'}
                      </button>
                      {task.visit_notes?.shift_id && (
                        <Link
                          href={`/worker/visits/${task.visit_notes.shift_id}`}
                          className="px-4 min-h-[44px] flex items-center border border-indigo-200 text-indigo-600 text-sm font-medium rounded-xl hover:bg-indigo-50 transition-colors"
                        >
                          Visit
                        </Link>
                      )}
                    </div>

                    {/* Help / notes */}
                    {isHelp && (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={noteText[task.id] ?? ''}
                          onChange={e => setNoteText(p => ({ ...p, [task.id]: e.target.value }))}
                          placeholder="Describe what you need help with or add a note before completing…"
                          rows={3}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        />
                        <p className="text-xs text-gray-400">Notes are saved and visible to your coordinator.</p>
                        <button
                          onClick={() => markDone(task.id)}
                          disabled={isBusy || !online || !noteText[task.id]?.trim()}
                          className="w-full min-h-[44px] bg-slate-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 hover:bg-slate-800 transition-colors"
                        >
                          Save Note & Complete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
