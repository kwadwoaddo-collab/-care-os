'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import type { QueueItem, QueuePriority, QueueCategory } from '@/lib/operations/priorityQueue'
import { getQueuePrefs, setQueuePrefs, type QueuePrefs } from '@/lib/operations/workspaceMemory'

// ── Constants ──────────────────────────────────────────────────────────────────

const PRIORITIES: QueuePriority[] = ['critical', 'urgent', 'warning', 'informational']
const CATEGORIES: QueueCategory[] = [
  'safeguarding', 'compliance', 'staffing', 'onboarding',
  'incident', 'medication', 'shift_coverage', 'other',
]

const PRIORITY_ORDER: Record<string, number> = {
  critical: 4, urgent: 3, warning: 2, informational: 1,
}

const PRIORITY_CLS: Record<string, string> = {
  critical:      'bg-red-50    text-red-700    ring-red-500/20',
  urgent:        'bg-orange-50 text-orange-700 ring-orange-500/20',
  warning:       'bg-yellow-50 text-yellow-700 ring-yellow-500/20',
  informational: 'bg-gray-50   text-gray-500   ring-gray-300/30',
}

const STATUS_CLS: Record<string, string> = {
  open:        'bg-red-50  text-red-700    ring-red-500/20',
  in_progress: 'bg-blue-50 text-blue-700   ring-blue-500/20',
  resolved:    'bg-green-50 text-green-700 ring-green-500/20',
  dismissed:   'bg-gray-50  text-gray-400  ring-gray-200',
}

const CATEGORY_ICON: Record<string, string> = {
  safeguarding: '🛡',
  compliance:   '📋',
  staffing:     '👥',
  onboarding:   '📝',
  incident:     '⚠',
  medication:   '💊',
  shift_coverage: '📅',
  other:        '•',
}

// ── Smart sort ────────────────────────────────────────────────────────────────
// Safeguarding items float above same-priority items.
// Overdue items (due_date in the past) get a bonus within their priority.

function smartScore(item: QueueItem): number {
  const prio    = PRIORITY_ORDER[item.priority] ?? 0
  const sg      = item.category === 'safeguarding' ? 0.5 : 0
  const now     = Date.now()
  const due     = item.due_date ? new Date(item.due_date).getTime() : null
  const overdue = due && due < now ? 0.3 : 0
  return prio + sg + overdue
}

function applySortAndFilter(
  items:    QueueItem[],
  priority: string,
  category: string,
  status:   string,
  sortBy:   string,
): QueueItem[] {
  let result = [...items]

  if (status)   result = result.filter((i) => i.status === status)
  if (priority) result = result.filter((i) => i.priority === priority)
  if (category) result = result.filter((i) => i.category === category)

  if (sortBy === 'due_date') {
    result.sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    })
  } else if (sortBy === 'created_at') {
    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  } else {
    // Default: smart priority sort
    result.sort((a, b) => smartScore(b) - smartScore(a))
  }

  return result
}

// ── Micro UI ──────────────────────────────────────────────────────────────────

function PriBadge({ level }: { level: string }) {
  const cls = PRIORITY_CLS[level] ?? PRIORITY_CLS.informational
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-px text-[10px] font-semibold ring-1 ring-inset ${cls}`}>
      {level}
    </span>
  )
}

function StaBadge({ status }: { status: string }) {
  const cls = STATUS_CLS[status] ?? STATUS_CLS.open
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-px text-[10px] font-medium ring-1 ring-inset ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function SelBtn({
  value, active, onClick, children,
}: {
  value: string; active: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[32px] ${
        active
          ? 'bg-indigo-600 text-white'
          : 'bg-surface-container-lowest border border-outline-variant text-on-surface-variant hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  )
}

// ── Create item form ──────────────────────────────────────────────────────────

function CreateItemForm({ onCreated }: { onCreated: (item: QueueItem) => void }) {
  const [open, setOpen] = useState(false)
  const [pending, startT] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    title: '', description: '', priority: 'warning' as QueuePriority,
    category: 'other' as QueueCategory, assigned_to: '', due_date: '',
  })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startT(async () => {
      const res = await fetch('/api/admin/operations/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setError(d.error ?? 'Failed')
        return
      }
      onCreated(await res.json() as QueueItem)
      setOpen(false)
      setForm({ title: '', description: '', priority: 'warning', category: 'other', assigned_to: '', due_date: '' })
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors min-h-[36px]"
      >
        + Add item
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-800">New queue item</h4>
        <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xs">✕ Cancel</button>
      </div>
      {error && <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{error}</p>}

      <input
        value={form.title} onChange={set('title')} required
        className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        placeholder="What needs to be done? *"
      />

      <div className="grid grid-cols-2 gap-2">
        <select value={form.priority} onChange={set('priority')}
          className="rounded-lg border border-outline-variant px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400">
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={form.category} onChange={set('category')}
          className="rounded-lg border border-outline-variant px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400">
          {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
        </select>
        <input value={form.assigned_to} onChange={set('assigned_to')} placeholder="Assign to (optional)"
          className="rounded-lg border border-outline-variant px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        <input type="date" value={form.due_date} onChange={set('due_date')}
          className="rounded-lg border border-outline-variant px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400" />
      </div>

      <textarea value={form.description} onChange={set('description')} rows={2} placeholder="Context (optional)"
        className="w-full rounded-lg border border-outline-variant px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />

      <button type="submit" disabled={pending}
        className="w-full py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
        {pending ? 'Adding…' : 'Add to queue'}
      </button>
    </form>
  )
}

// ── Queue row ─────────────────────────────────────────────────────────────────

function QueueRow({ item, onUpdate }: { item: QueueItem; onUpdate: (id: string, u: Partial<QueueItem>) => void }) {
  const [expanded,     setExpanded]     = useState(false)
  const [resolveOpen,  setResolveOpen]  = useState(false)
  const [assignOpen,   setAssignOpen]   = useState(false)
  const [resolveNotes, setResolveNotes] = useState('')
  const [assignTo,     setAssignTo]     = useState(item.assigned_to ?? '')
  const [pending, startT] = useTransition()

  const patch = useCallback((updates: Record<string, unknown>) => {
    startT(async () => {
      const res = await fetch(`/api/admin/operations/queue/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (res.ok) onUpdate(item.id, await res.json() as Partial<QueueItem>)
    })
  }, [item.id, onUpdate])

  const isActive = item.status === 'open' || item.status === 'in_progress'
  const isOverdue = item.due_date && new Date(item.due_date) < new Date()
  const isSafeguarding = item.category === 'safeguarding'

  return (
    <div
      className={`border-b border-outline-variant last:border-0 transition-opacity ${pending ? 'opacity-60' : ''} ${
        isSafeguarding ? 'bg-red-50/30' : ''
      }`}
    >
      {/* Main row */}
      <div
        className="flex items-start gap-3 px-4 py-3.5 hover:bg-gray-50/40 cursor-pointer"
        onClick={() => setExpanded((x) => !x)}
      >
        {/* Category icon */}
        <span className="text-base leading-none mt-0.5 w-5 text-center shrink-0">
          {CATEGORY_ICON[item.category] ?? '•'}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <PriBadge level={item.priority} />
            <StaBadge status={item.status} />
            {isOverdue && (
              <span className="text-[10px] font-bold text-red-600 bg-red-50 rounded px-1.5 py-px ring-1 ring-red-200">overdue</span>
            )}
            {isSafeguarding && (
              <span className="text-[10px] font-bold text-red-700 bg-red-100 rounded px-1.5 py-px ring-1 ring-red-300">safeguarding</span>
            )}
          </div>
          <p className="text-sm font-medium text-gray-800 leading-snug">{item.title}</p>
          {!expanded && item.description && (
            <p className="text-[11px] text-on-surface-variant mt-0.5 line-clamp-1">{item.description}</p>
          )}
          <div className="flex items-center gap-2.5 mt-1 text-[10px] text-gray-400 flex-wrap">
            {item.assigned_to && <span>→ {item.assigned_to}</span>}
            {item.due_date && (
              <span className={isOverdue ? 'text-red-600 font-semibold' : 'text-amber-700'}>
                due {new Date(item.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
              </span>
            )}
            <span>{new Date(item.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
          </div>
        </div>

        {/* Inline quick actions (always visible) */}
        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          {item.entity_url && (
            <a href={item.entity_url}
              className="inline-flex items-center rounded px-2 py-1 text-[10px] font-semibold border border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-gray-50 transition-colors min-h-[28px]"
            >
              View
            </a>
          )}
          {isActive && (
            <button
              onClick={() => patch({ status: 'resolved', resolved_by: 'Coordinator' })}
              className="inline-flex items-center rounded px-2 py-1 text-[10px] font-bold border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 transition-colors min-h-[28px]"
              title="Quick resolve"
            >
              ✓
            </button>
          )}
          <span className="text-gray-300 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 bg-gray-50/30">
          {item.description && (
            <p className="text-xs text-gray-700 leading-relaxed pt-2">{item.description}</p>
          )}

          {/* Action strip */}
          {isActive && (
            <div className="flex items-center gap-2 flex-wrap pt-1">
              {item.status === 'open' && (
                <button onClick={() => patch({ status: 'in_progress' })}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors min-h-[32px]">
                  In progress
                </button>
              )}
              <button onClick={() => { setAssignOpen((x) => !x); setResolveOpen(false) }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-50 text-gray-700 border border-outline-variant hover:bg-gray-100 transition-colors min-h-[32px]">
                {item.assigned_to ? 'Reassign' : 'Assign'}
              </button>
              <button onClick={() => { setResolveOpen((x) => !x); setAssignOpen(false) }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors min-h-[32px]">
                Resolve
              </button>
              <button onClick={() => patch({ status: 'dismissed' })}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-50 text-gray-500 border border-outline-variant hover:bg-gray-100 transition-colors min-h-[32px]">
                Dismiss
              </button>
            </div>
          )}

          {/* Assign form */}
          {assignOpen && (
            <div className="flex gap-2">
              <input value={assignTo} onChange={(e) => setAssignTo(e.target.value)}
                placeholder="Assign to (name or email)"
                className="flex-1 rounded-lg border border-outline-variant px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button onClick={() => { patch({ assigned_to: assignTo }); setAssignOpen(false) }}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors min-h-[32px]">
                Save
              </button>
            </div>
          )}

          {/* Resolve form */}
          {resolveOpen && (
            <div className="space-y-2">
              <textarea value={resolveNotes} onChange={(e) => setResolveNotes(e.target.value)}
                rows={2} placeholder="Resolution notes (optional)…"
                className="w-full rounded-lg border border-outline-variant px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-400 resize-none" />
              <button onClick={() => { patch({ status: 'resolved', resolution_notes: resolveNotes || null, resolved_by: 'Coordinator' }); setResolveOpen(false) }}
                className="px-4 py-1.5 rounded-lg bg-green-600 text-white text-xs font-bold hover:bg-green-700 transition-colors min-h-[32px]">
                Confirm resolve
              </button>
            </div>
          )}

          {/* Resolved info */}
          {item.status === 'resolved' && item.resolution_notes && (
            <p className="text-xs text-gray-600 bg-surface-container-lowest rounded-lg border border-outline-variant p-3 leading-relaxed">
              <span className="font-semibold">Resolution: </span>{item.resolution_notes}
            </p>
          )}

          {/* Escalation */}
          {item.escalation_triggered_at && !item.escalation_acknowledged_at && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-red-600 font-semibold">
                Escalated {new Date(item.escalation_triggered_at).toLocaleDateString('en-GB')}
              </span>
              <button
                onClick={() => patch({ escalation_acknowledged_by: 'Coordinator' })}
                className="px-2 py-1 rounded text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
              >
                Acknowledge
              </button>
            </div>
          )}
          {item.escalation_acknowledged_by && (
            <p className="text-[10px] text-green-600">
              Acknowledged by {item.escalation_acknowledged_by}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Priority summary chips ────────────────────────────────────────────────────

function PriChip({
  count, level, active, onClick,
}: {
  count: number; level: string; active: boolean; onClick: () => void
}) {
  if (count === 0) return null
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-all min-h-[30px] ${
        active
          ? 'bg-indigo-600 text-white border-indigo-600'
          : `${PRIORITY_CLS[level]} border-transparent`
      }`}
    >
      {count} {level}
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OperationsPriorityQueue({
  initialItems,
}: {
  initialItems: QueueItem[]
}) {
  const [items, setItems] = useState<QueueItem[]>(initialItems)

  // Hydrate preferences from localStorage after mount
  const [prefs, setPrefsState] = useState<QueuePrefs>({
    filterPriority: '',
    filterCategory: '',
    filterStatus:   'open',
    sortBy:         'priority',
  })

  useEffect(() => {
    const saved = getQueuePrefs()
    setTimeout(() => {
      setPrefsState(saved)
    }, 0)
  }, [])

  function updatePref<K extends keyof typeof prefs>(key: K, value: typeof prefs[K]) {
    const next = { ...prefs, [key]: value }
    setPrefsState(next)
    setQueuePrefs(next)
  }

  const handleCreated = useCallback((item: QueueItem) => {
    setItems((prev) => [item, ...prev])
  }, [])

  const handleUpdate = useCallback((id: string, updates: Partial<QueueItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)))
  }, [])

  const displayed = applySortAndFilter(
    items,
    prefs.filterPriority,
    prefs.filterCategory,
    prefs.filterStatus,
    prefs.sortBy,
  )

  // Counts for open/in_progress items only
  const activeCounts = { critical: 0, urgent: 0, warning: 0, informational: 0 }
  for (const i of items.filter((x) => x.status === 'open' || x.status === 'in_progress')) {
    activeCounts[i.priority as keyof typeof activeCounts] =
      (activeCounts[i.priority as keyof typeof activeCounts] ?? 0) + 1
  }

  return (
    <div className="space-y-4">

      {/* Priority summary + create */}
      <div className="flex items-center gap-2 flex-wrap justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {(['critical', 'urgent', 'warning'] as QueuePriority[]).map((p) => (
            <PriChip
              key={p}
              count={activeCounts[p]}
              level={p}
              active={prefs.filterPriority === p}
              onClick={() => updatePref('filterPriority', prefs.filterPriority === p ? '' : p)}
            />
          ))}
        </div>
        <CreateItemForm onCreated={handleCreated} />
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <select value={prefs.filterStatus}
          onChange={(e) => updatePref('filterStatus', e.target.value)}
          className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 min-h-[32px]">
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </select>
        <select value={prefs.filterCategory}
          onChange={(e) => updatePref('filterCategory', e.target.value)}
          className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 min-h-[32px]">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
        </select>
        <div className="flex items-center gap-1">
          <SelBtn value="priority" active={prefs.sortBy === 'priority'}
            onClick={() => updatePref('sortBy', 'priority')}>Smart sort</SelBtn>
          <SelBtn value="due_date" active={prefs.sortBy === 'due_date'}
            onClick={() => updatePref('sortBy', 'due_date')}>By due date</SelBtn>
        </div>
        {(prefs.filterPriority || prefs.filterCategory || prefs.filterStatus !== 'open') && (
          <button onClick={() => {
            const reset = { filterPriority: '', filterCategory: '', filterStatus: 'open', sortBy: 'priority' as const }
            setPrefsState(reset)
            setQueuePrefs(reset)
          }} className="text-xs text-on-surface-variant hover:text-primary underline">
            Reset
          </button>
        )}
        <span className="text-xs text-on-surface-variant ml-auto">
          {displayed.length} item{displayed.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Queue list */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] overflow-hidden">
        {displayed.length === 0 ? (
          <div className="flex items-center gap-3 p-8">
            <span className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold shrink-0">✓</span>
            <div>
              <p className="text-sm font-semibold text-gray-700">
                {prefs.filterStatus === 'open' ? 'All operational queue items are resolved.' : 'No items match your filters.'}
              </p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {prefs.filterStatus === 'open'
                  ? 'No open actions require coordinator attention right now.'
                  : 'Try adjusting your filters above.'}
              </p>
            </div>
          </div>
        ) : (
          displayed.map((item) => (
            <QueueRow key={item.id} item={item} onUpdate={handleUpdate} />
          ))
        )}
      </div>
    </div>
  )
}
