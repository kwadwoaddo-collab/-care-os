'use client'

import { useState, useTransition } from 'react'
import type { HandoverNote, HandoverFlaggedItem, HandoverAction, QueuePriority } from '@/lib/operations/priorityQueue'

// ── Handover note card ─────────────────────────────────────────────────────────

const PERIOD_LABEL: Record<string, string> = {
  morning:   'Morning',
  afternoon: 'Afternoon',
  evening:   'Evening',
  night:     'Night',
  day:       'Day',
}

const PRIORITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  urgent:   'bg-orange-500',
  warning:  'bg-yellow-400',
  informational: 'bg-gray-300',
}

function HandoverCard({ note }: { note: HandoverNote }) {
  const [expanded, setExpanded] = useState(false)
  const flagged = Array.isArray(note.flagged_items)     ? note.flagged_items     : []
  const actions = Array.isArray(note.follow_up_actions) ? note.follow_up_actions : []

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)]">
      <div
        className="flex items-start gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50/40 transition-colors"
        onClick={() => setExpanded((x) => !x)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-indigo-700">{note.author_name}</span>
            <span className="text-[10px] text-on-surface-variant">·</span>
            <span className="text-[10px] text-on-surface-variant">
              {PERIOD_LABEL[note.shift_period] ?? note.shift_period}
            </span>
            <span className="text-[10px] text-on-surface-variant">·</span>
            <span className="text-[10px] text-on-surface-variant">
              {new Date(note.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
            {flagged.length > 0 && (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 ml-1">
                {flagged.length} flagged
              </span>
            )}
          </div>
          <p className="text-sm text-gray-700 line-clamp-2">{note.summary}</p>
        </div>
        <span className="text-gray-400 text-xs shrink-0 mt-1">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-outline-variant">
          <div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap mt-3">{note.summary}</p>
          </div>

          {flagged.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-600 mb-2">Flagged Items</h4>
              <div className="space-y-1.5">
                {flagged.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className={`w-2 h-2 rounded-full shrink-0 mt-0.5 ${PRIORITY_DOT[item.priority] ?? 'bg-gray-300'}`} />
                    <div>
                      <span className="font-medium text-gray-700 capitalize">{item.type.replace(/_/g, ' ')}</span>
                      <span className="text-on-surface-variant ml-1.5">{item.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {actions.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-600 mb-2">Follow-up Actions</h4>
              <div className="space-y-1.5">
                {actions.map((a, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className={`w-3.5 h-3.5 rounded border shrink-0 mt-0.5 ${a.done ? 'bg-green-500 border-green-500' : 'border-gray-400'}`} />
                    <div>
                      <span className={`${a.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>{a.action}</span>
                      {a.owner && <span className="text-on-surface-variant ml-1.5">→ {a.owner}</span>}
                      {a.due && <span className="text-amber-700 ml-1.5">by {a.due}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {note.reviewed_by && (
            <p className="text-[10px] text-green-700">
              Reviewed by {note.reviewed_by}
              {note.reviewed_at && ` · ${new Date(note.reviewed_at).toLocaleDateString('en-GB')}`}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Create handover form ───────────────────────────────────────────────────────

function CreateHandoverForm({ onCreated }: { onCreated: (note: HandoverNote) => void }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    author_name:   '',
    summary:       '',
    shift_period:  'day',
    handover_date: new Date().toISOString().slice(0, 10),
  })

  const [flagged, setFlagged] = useState<HandoverFlaggedItem[]>([])
  const [actions, setActions] = useState<HandoverAction[]>([])

  function addFlagged() {
    setFlagged((f) => [...f, { type: 'incident', description: '', priority: 'warning' as QueuePriority }])
  }
  function addAction() {
    setActions((a) => [...a, { action: '', owner: '', due: '' }])
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const payload = {
        ...form,
        flagged_items:    flagged.filter((f) => f.description.trim()),
        follow_up_actions: actions.filter((a) => a.action.trim()),
      }
      const res = await fetch('/api/admin/operations/handover', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setError(d.error ?? 'Failed to create handover note')
        return
      }
      const note = await res.json() as HandoverNote
      onCreated(note)
      setOpen(false)
      setForm({ author_name: '', summary: '', shift_period: 'day', handover_date: new Date().toISOString().slice(0, 10) })
      setFlagged([])
      setActions([])
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors"
      >
        + Create handover note
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-outline-variant rounded-xl p-5 space-y-4 shadow-sm">
      <h4 className="text-sm font-semibold text-gray-800">New Handover Note</h4>
      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-on-surface-variant mb-1">Your name *</label>
          <input
            value={form.author_name}
            onChange={(e) => setForm((f) => ({ ...f, author_name: e.target.value }))}
            required
            className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="e.g. Sarah Johnson"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-on-surface-variant mb-1">Shift period *</label>
          <select
            value={form.shift_period}
            onChange={(e) => setForm((f) => ({ ...f, shift_period: e.target.value }))}
            className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {Object.entries(PERIOD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-on-surface-variant mb-1">Date</label>
          <input
            type="date"
            value={form.handover_date}
            onChange={(e) => setForm((f) => ({ ...f, handover_date: e.target.value }))}
            className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-on-surface-variant mb-1">Handover summary *</label>
        <textarea
          value={form.summary}
          onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
          required
          rows={4}
          className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          placeholder="What does the incoming coordinator need to know? Open issues, completed tasks, anything outstanding..."
        />
      </div>

      {/* Flagged items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-gray-600">Flagged items</label>
          <button type="button" onClick={addFlagged} className="text-xs text-indigo-600 hover:underline">+ Add</button>
        </div>
        {flagged.map((item, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 mb-2">
            <input
              value={item.description}
              onChange={(e) => setFlagged((f) => f.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
              className="rounded-lg border border-outline-variant px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Description"
            />
            <select
              value={item.priority}
              onChange={(e) => setFlagged((f) => f.map((x, j) => j === i ? { ...x, priority: e.target.value as QueuePriority } : x))}
              className="rounded-lg border border-outline-variant px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="critical">critical</option>
              <option value="urgent">urgent</option>
              <option value="warning">warning</option>
              <option value="informational">info</option>
            </select>
            <button type="button" onClick={() => setFlagged((f) => f.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-xs px-1">✕</button>
          </div>
        ))}
      </div>

      {/* Follow-up actions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-gray-600">Follow-up actions</label>
          <button type="button" onClick={addAction} className="text-xs text-indigo-600 hover:underline">+ Add</button>
        </div>
        {actions.map((a, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 mb-2">
            <input
              value={a.action}
              onChange={(e) => setActions((f) => f.map((x, j) => j === i ? { ...x, action: e.target.value } : x))}
              className="rounded-lg border border-outline-variant px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Action"
            />
            <input
              value={a.owner ?? ''}
              onChange={(e) => setActions((f) => f.map((x, j) => j === i ? { ...x, owner: e.target.value } : x))}
              className="rounded-lg border border-outline-variant px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Owner"
            />
            <input
              value={a.due ?? ''}
              type="date"
              onChange={(e) => setActions((f) => f.map((x, j) => j === i ? { ...x, due: e.target.value } : x))}
              className="rounded-lg border border-outline-variant px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button type="button" onClick={() => setActions((f) => f.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-xs px-1">✕</button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 justify-end pt-1">
        <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-on-surface-variant hover:text-primary">
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Saving…' : 'Save handover note'}
        </button>
      </div>
    </form>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function OperationsHandoverForm({
  initialNotes,
}: {
  initialNotes: HandoverNote[]
}) {
  const [notes, setNotes] = useState<HandoverNote[]>(initialNotes)

  function handleCreated(note: HandoverNote) {
    setNotes((prev) => [note, ...prev])
  }

  return (
    <div className="space-y-5">
      <CreateHandoverForm onCreated={handleCreated} />

      {notes.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-10 text-center">
          <p className="text-sm text-on-surface-variant">No handover notes yet. Create the first one above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => <HandoverCard key={note.id} note={note} />)}
        </div>
      )}
    </div>
  )
}
