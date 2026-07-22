'use client'

import { useEffect, useState, useCallback } from 'react'
import Card from '@/components/ui/Card'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChecklistItem {
  id:          string
  title:       string
  description: string | null
  category:    string
  is_required: boolean
  is_complete: boolean
  notes:       string | null
}

interface StaffChecklist {
  id:                    string
  template_name:         string
  assigned_at:           string
  completed_at:          string | null
  progress:              number
  staff_checklist_items: ChecklistItem[]
}

interface TemplateOption {
  id:       string
  name:     string
  job_role: string | null
}

function ProgressBar({ pct }: { pct: number }) {
  const cls = pct === 100 ? 'bg-green-500' : pct >= 60 ? 'bg-indigo-500' : pct >= 30 ? 'bg-amber-400' : 'bg-gray-300'
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-surface-container-high overflow-hidden">
        <div className={`h-full rounded-full transition-all ${cls}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-on-surface-variant w-9 text-right tabular-nums">{pct}%</span>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StaffChecklistPanel({ staffProfileId }: { staffProfileId: string }) {
  const [checklists, setChecklists] = useState<StaffChecklist[]>([])
  const [loading, setLoading]       = useState(true)
  const [assigning, setAssigning]   = useState(false)
  const [templates, setTemplates]   = useState<TemplateOption[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [busy, setBusy]             = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/admin/staff/${staffProfileId}/checklist`)
      .then((r) => r.json() as Promise<{ data: StaffChecklist[] }>)
      .then((d) => setChecklists(d.data ?? []))
      .catch(() => setChecklists([]))
      .finally(() => setLoading(false))
  }, [staffProfileId])

  useEffect(() => { load() }, [load])

  async function openAssign() {
    setAssigning(true)
    const res = await fetch('/api/admin/checklist-templates?activeOnly=true')
    if (res.ok) {
      const { data } = await res.json() as { data: TemplateOption[] }
      setTemplates(data ?? [])
    }
  }

  async function handleAssign() {
    if (!selectedTemplate) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/staff/${staffProfileId}/checklist`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ template_id: selectedTemplate }),
      })
      if (res.ok) {
        setAssigning(false)
        setSelectedTemplate('')
        load()
      }
    } finally {
      setBusy(false)
    }
  }

  async function toggleItem(item: ChecklistItem) {
    setChecklists((prev) => prev.map((c) => ({
      ...c,
      staff_checklist_items: c.staff_checklist_items.map((i) =>
        i.id === item.id ? { ...i, is_complete: !i.is_complete } : i
      ),
    })))

    const checklist = checklists.find((c) => c.staff_checklist_items.some((i) => i.id === item.id))
    await fetch(`/api/admin/staff/${staffProfileId}/checklist/items/${item.id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ is_complete: !item.is_complete }),
    })
    if (checklist) load()
  }

  return (
    <Card padding="none">
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-on-surface" style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}>
              Onboarding Checklist
            </h2>
            <p className="text-xs text-on-surface-variant">Role-based checklist progress</p>
          </div>
          <button
            onClick={openAssign}
            id="assign-checklist-btn"
            className="text-xs font-semibold text-secondary hover:underline"
          >
            + Assign Checklist
          </button>
        </div>

        {loading && (
          <p className="text-xs text-on-surface-variant animate-pulse">Loading…</p>
        )}

        {!loading && checklists.length === 0 && (
          <p className="text-xs text-on-surface-variant">No checklist assigned yet.</p>
        )}

        <div className="space-y-4">
          {checklists.map((c) => (
            <div key={c.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-on-surface">{c.template_name}</p>
                {c.completed_at && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700 uppercase tracking-wide">Complete</span>
                )}
              </div>
              <ProgressBar pct={c.progress} />
              <div className="space-y-1 pt-1">
                {c.staff_checklist_items.map((item) => (
                  <label key={item.id} className="flex items-start gap-2 py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.is_complete}
                      onChange={() => toggleItem(item)}
                      className="mt-0.5"
                    />
                    <span className={`text-sm ${item.is_complete ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}>
                      {item.title}
                      {!item.is_required && <span className="text-[10px] text-on-surface-variant ml-1">(optional)</span>}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        {assigning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="bg-surface-container-lowest rounded-xl shadow-lg w-full max-w-sm p-5 space-y-3">
              <h3 className="text-sm font-semibold text-primary">Assign a Checklist</h3>
              {templates.length === 0 ? (
                <p className="text-xs text-on-surface-variant">No active templates found. Create one under Onboarding → Checklist Templates.</p>
              ) : (
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm"
                >
                  <option value="">Select a template…</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}{t.job_role ? ` (${t.job_role})` : ''}</option>
                  ))}
                </select>
              )}
              <div className="flex items-center justify-end gap-3 pt-1">
                <button onClick={() => { setAssigning(false); setSelectedTemplate('') }} className="text-xs font-medium text-on-surface-variant hover:underline">
                  Cancel
                </button>
                <button
                  onClick={handleAssign}
                  disabled={!selectedTemplate || busy}
                  className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold bg-primary text-on-primary hover:opacity-90 transition-all shadow-sm disabled:opacity-50"
                >
                  {busy ? 'Assigning…' : 'Assign'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
