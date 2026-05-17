'use client'

import { useState, useTransition } from 'react'
import type { QueueItem, QueuePriority, QueueCategory } from '@/lib/operations/priorityQueue'

// ── Constants ──────────────────────────────────────────────────────────────────

const PRIORITIES: QueuePriority[] = ['critical', 'urgent', 'warning', 'informational']
const CATEGORIES: QueueCategory[] = [
  'safeguarding', 'compliance', 'staffing', 'onboarding',
  'incident', 'medication', 'shift_coverage', 'other',
]

const PRIORITY_CLS: Record<string, string> = {
  critical:      'bg-red-50    text-red-700    ring-red-600/20',
  urgent:        'bg-orange-50 text-orange-700 ring-orange-600/20',
  warning:       'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
  informational: 'bg-gray-50   text-gray-600   ring-gray-400/20',
}

const STATUS_CLS: Record<string, string> = {
  open:        'bg-red-50     text-red-700    ring-red-600/20',
  in_progress: 'bg-blue-50    text-blue-700   ring-blue-600/20',
  resolved:    'bg-green-50   text-green-700  ring-green-600/20',
  dismissed:   'bg-gray-50    text-gray-600   ring-gray-400/20',
}

function Badge({ label, cls }: { label: string; cls: string }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset uppercase tracking-wide ${cls}`}>
      {label.replace(/_/g, ' ')}
    </span>
  )
}

// ── Create item form ───────────────────────────────────────────────────────────

function CreateItemForm({ onCreated }: { onCreated: (item: QueueItem) => void }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const [form, setForm] = useState({
    title:       '',
    description: '',
    priority:    'warning' as QueuePriority,
    category:    'other'   as QueueCategory,
    assigned_to: '',
    due_date:    '',
  })
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await fetch('/api/admin/operations/queue', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setError(d.error ?? 'Failed to create item')
        return
      }
      const item = await res.json() as QueueItem
      onCreated(item)
      setOpen(false)
      setForm({ title: '', description: '', priority: 'warning', category: 'other', assigned_to: '', due_date: '' })
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors"
      >
        + Add queue item
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-outline-variant rounded-xl p-5 space-y-3 shadow-sm">
      <h4 className="text-sm font-semibold text-gray-800">New Queue Item</h4>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-on-surface-variant mb-1">Title *</label>
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
            className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="What needs to be done?"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-on-surface-variant mb-1">Priority *</label>
          <select
            value={form.priority}
            onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as QueuePriority }))}
            className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-on-surface-variant mb-1">Category *</label>
          <select
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as QueueCategory }))}
            className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-on-surface-variant mb-1">Assign to</label>
          <input
            value={form.assigned_to}
            onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))}
            className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Name or email"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-on-surface-variant mb-1">Due date</label>
          <input
            type="date"
            value={form.due_date}
            onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
            className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-on-surface-variant mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            placeholder="Optional context..."
          />
        </div>
      </div>
      <div className="flex items-center gap-2 justify-end">
        <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-on-surface-variant hover:text-primary">
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Adding…' : 'Add item'}
        </button>
      </div>
    </form>
  )
}

// ── Queue row ──────────────────────────────────────────────────────────────────

function QueueRow({
  item,
  onUpdate,
}: {
  item: QueueItem
  onUpdate: (id: string, updates: Partial<QueueItem>) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [resolveOpen, setResolveOpen] = useState(false)
  const [resolveNotes, setResolveNotes] = useState('')
  const [pending, startTransition] = useTransition()

  function patch(updates: Partial<QueueItem> & { resolved_by?: string }) {
    startTransition(async () => {
      const res = await fetch(`/api/admin/operations/queue/${item.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(updates),
      })
      if (res.ok) {
        const updated = await res.json() as QueueItem
        onUpdate(item.id, updated)
      }
    })
  }

  return (
    <div className={`border-b border-outline-variant last:border-0 ${pending ? 'opacity-60' : ''}`}>
      <div
        className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50/40 transition-colors cursor-pointer"
        onClick={() => setExpanded((x) => !x)}
      >
        <div className="flex flex-col gap-1 pt-0.5">
          <Badge label={item.priority} cls={PRIORITY_CLS[item.priority] ?? PRIORITY_CLS.informational} />
          <Badge label={item.status}   cls={STATUS_CLS[item.status]   ?? STATUS_CLS.open}          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-primary leading-snug">{item.title}</p>
          {item.description && (
            <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-1">{item.description}</p>
          )}
          <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
            <span className="capitalize">{item.category.replace(/_/g, ' ')}</span>
            {item.assigned_to && <span>→ {item.assigned_to}</span>}
            {item.due_date && (
              <span className="text-amber-700">Due {new Date(item.due_date).toLocaleDateString('en-GB')}</span>
            )}
            <span className="ml-auto">{new Date(item.created_at).toLocaleDateString('en-GB')}</span>
          </div>
        </div>
        <span className="text-gray-400 text-xs mt-1">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="px-5 pb-4 space-y-3">
          {item.entity_url && (
            <a href={item.entity_url} className="text-xs text-indigo-600 hover:underline">
              View linked record →
            </a>
          )}

          {item.status !== 'resolved' && item.status !== 'dismissed' && (
            <div className="flex items-center gap-2 flex-wrap">
              {item.status === 'open' && (
                <button
                  onClick={() => patch({ status: 'in_progress' })}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  Mark in progress
                </button>
              )}
              <button
                onClick={() => setResolveOpen((x) => !x)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
              >
                Resolve
              </button>
              <button
                onClick={() => patch({ status: 'dismissed' })}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Dismiss
              </button>
            </div>
          )}

          {resolveOpen && (
            <div className="space-y-2">
              <textarea
                value={resolveNotes}
                onChange={(e) => setResolveNotes(e.target.value)}
                rows={2}
                placeholder="Resolution notes (optional)..."
                className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />
              <button
                onClick={() => patch({ status: 'resolved', resolution_notes: resolveNotes || undefined, resolved_by: 'Coordinator' })}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-green-600 text-white hover:bg-green-700 transition-colors"
              >
                Confirm resolve
              </button>
            </div>
          )}

          {item.resolution_notes && (
            <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3">
              <span className="font-semibold">Resolution: </span>{item.resolution_notes}
            </p>
          )}

          {item.escalation_triggered_at && (
            <p className="text-[10px] text-red-600">
              Escalated {new Date(item.escalation_triggered_at).toLocaleDateString('en-GB')}
              {item.escalation_acknowledged_by && ` · Acknowledged by ${item.escalation_acknowledged_by}`}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function OperationsPriorityQueue({
  initialItems,
}: {
  initialItems: QueueItem[]
}) {
  const [items, setItems] = useState<QueueItem[]>(initialItems)
  const [filterPriority, setFilterPriority] = useState<string>('')
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [filterStatus,   setFilterStatus]   = useState<string>('open')

  function handleCreated(item: QueueItem) {
    setItems((prev) => [item, ...prev])
  }

  function handleUpdate(id: string, updates: Partial<QueueItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)))
  }

  const filtered = items.filter((i) => {
    if (filterPriority && i.priority !== filterPriority) return false
    if (filterCategory && i.category !== filterCategory) return false
    if (filterStatus   && i.status   !== filterStatus)   return false
    return true
  })

  const pCounts: Record<string, number> = { critical: 0, urgent: 0, warning: 0, informational: 0 }
  for (const i of items.filter((x) => x.status === 'open' || x.status === 'in_progress')) {
    pCounts[i.priority] = (pCounts[i.priority] ?? 0) + 1
  }

  return (
    <div className="space-y-5">

      {/* Priority summary */}
      <div className="flex items-center gap-3 flex-wrap">
        {(['critical', 'urgent', 'warning'] as QueuePriority[]).map((p) => (
          pCounts[p] > 0 && (
            <button
              key={p}
              onClick={() => setFilterPriority(filterPriority === p ? '' : p)}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${
                filterPriority === p
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : `${PRIORITY_CLS[p]} border-transparent`
              }`}
            >
              {pCounts[p]} {p}
            </button>
          )
        ))}
      </div>

      {/* Filters + create */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
        </select>
        <div className="ml-auto">
          <CreateItemForm onCreated={handleCreated} />
        </div>
      </div>

      {/* Queue list */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-on-surface-variant">
            No items match current filters
          </div>
        ) : (
          filtered.map((item) => (
            <QueueRow key={item.id} item={item} onUpdate={handleUpdate} />
          ))
        )}
      </div>
    </div>
  )
}
