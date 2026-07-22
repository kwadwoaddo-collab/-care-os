'use client'

import { useEffect, useState, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

type Category = 'documentation' | 'training' | 'meeting' | 'task'

interface TemplateItem {
  id?:          string
  title:        string
  description:  string
  category:     Category
  is_required:  boolean
  sort_order:   number
}

interface Template {
  id:          string
  name:        string
  description: string | null
  job_role:    string | null
  is_active:   boolean
  item_count?: number
  items?:      TemplateItem[]
}

const CATEGORY_LABEL: Record<Category, string> = {
  documentation: 'Documentation',
  training:      'Training',
  meeting:       'Meeting',
  task:          'Task',
}

function emptyItem(sortOrder: number): TemplateItem {
  return { title: '', description: '', category: 'task', is_required: true, sort_order: sortOrder }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ChecklistTemplatesClient({ canWrite }: { canWrite: boolean }) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading]     = useState(true)
  const [editing, setEditing]     = useState<Template | 'new' | null>(null)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/checklist-templates')
      .then((r) => r.json() as Promise<{ data: Template[] }>)
      .then((d) => setTemplates(d.data ?? []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function openEdit(template: Template) {
    const res = await fetch(`/api/admin/checklist-templates/${template.id}`)
    if (!res.ok) return
    const { data } = await res.json() as { data: Template }
    setEditing(data)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this template? Staff already assigned checklists from it are unaffected.')) return
    const res = await fetch(`/api/admin/checklist-templates/${id}`, { method: 'DELETE' })
    if (res.ok) load()
  }

  return (
    <div className="space-y-4">
      {canWrite && (
        <button
          onClick={() => setEditing('new')}
          id="new-checklist-template-btn"
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold bg-primary text-on-primary hover:opacity-90 transition-all shadow-sm"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          New Template
        </button>
      )}

      {loading && (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant px-4 py-10 text-center text-sm text-on-surface-variant animate-pulse">
          Loading templates…
        </div>
      )}

      {!loading && templates.length === 0 && (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant px-4 py-12 text-center space-y-2">
          <span className="material-symbols-outlined text-[36px] text-on-surface-variant block">checklist</span>
          <p className="text-sm font-medium text-primary">No checklist templates yet</p>
          <p className="text-xs text-on-surface-variant">Create one to start assigning structured onboarding checklists.</p>
        </div>
      )}

      {!loading && templates.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((t) => (
            <div key={t.id} className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-primary">{t.name}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {t.job_role ? `Role: ${t.job_role}` : 'Applies to all roles'}
                    {' · '}{t.item_count ?? 0} item{(t.item_count ?? 0) !== 1 ? 's' : ''}
                  </p>
                </div>
                {!t.is_active && (
                  <span className="text-[10px] font-medium bg-gray-100 text-on-surface-variant rounded px-1.5 py-0.5">Inactive</span>
                )}
              </div>
              {t.description && <p className="text-xs text-on-surface-variant">{t.description}</p>}
              {canWrite && (
                <div className="flex items-center gap-3 pt-1">
                  <button onClick={() => openEdit(t)} className="text-xs font-medium text-secondary hover:underline">Edit</button>
                  <button onClick={() => handleDelete(t.id)} className="text-xs font-medium text-red-600 hover:underline">Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <TemplateEditor
          template={editing === 'new' ? null : editing}
          saving={saving}
          error={error}
          onCancel={() => { setEditing(null); setError(null) }}
          onSave={async (payload) => {
            setSaving(true)
            setError(null)
            try {
              const isNew = editing === 'new'
              const res = await fetch(
                isNew ? '/api/admin/checklist-templates' : `/api/admin/checklist-templates/${(editing as Template).id}`,
                {
                  method:  isNew ? 'POST' : 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body:    JSON.stringify(payload),
                }
              )
              if (!res.ok) {
                const j = await res.json() as { error?: string }
                setError(j.error ?? 'Failed to save template')
                return
              }
              setEditing(null)
              load()
            } finally {
              setSaving(false)
            }
          }}
        />
      )}
    </div>
  )
}

// ── Editor ────────────────────────────────────────────────────────────────────

interface TemplateEditorProps {
  template: Template | null
  saving:   boolean
  error:    string | null
  onCancel: () => void
  onSave:   (payload: { name: string; description: string | null; job_role: string | null; items: TemplateItem[] }) => void
}

function TemplateEditor({ template, saving, error, onCancel, onSave }: TemplateEditorProps) {
  const [name, setName]               = useState(template?.name ?? '')
  const [description, setDescription] = useState(template?.description ?? '')
  const [jobRole, setJobRole]         = useState(template?.job_role ?? '')
  const [items, setItems]             = useState<TemplateItem[]>(
    template?.items && template.items.length > 0 ? template.items : [emptyItem(0)]
  )

  function updateItem(i: number, patch: Partial<TemplateItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem(prev.length)])
  }

  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i))
  }

  function handleSubmit() {
    const cleanItems = items
      .filter((it) => it.title.trim())
      .map((it, i) => ({ ...it, sort_order: i }))
    onSave({
      name:        name.trim(),
      description: description.trim() || null,
      job_role:    jobRole.trim() || null,
      items:       cleanItems,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-surface-container-lowest rounded-xl shadow-lg w-full max-w-xl max-h-[85vh] overflow-y-auto p-6 space-y-4">
        <h2 className="text-base font-semibold text-primary">
          {template ? 'Edit Template' : 'New Checklist Template'}
        </h2>

        {error && (
          <div className="rounded-lg bg-red-50 text-red-700 text-xs px-3 py-2">{error}</div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-on-surface-variant">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm"
              placeholder="e.g. Care Worker Onboarding"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-on-surface-variant">Job Role (leave blank for all roles)</label>
            <input
              value={jobRole}
              onChange={(e) => setJobRole(e.target.value)}
              className="mt-1 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm"
              placeholder="e.g. Care Worker"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-on-surface-variant">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-outline-variant px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-on-surface-variant">Checklist Items</p>
          {items.map((item, i) => (
            <div key={i} className="rounded-lg border border-outline-variant p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  value={item.title}
                  onChange={(e) => updateItem(i, { title: e.target.value })}
                  placeholder="Item title"
                  className="flex-1 rounded-lg border border-outline-variant px-2 py-1.5 text-sm"
                />
                <select
                  value={item.category}
                  onChange={(e) => updateItem(i, { category: e.target.value as Category })}
                  className="rounded-lg border border-outline-variant px-2 py-1.5 text-xs"
                >
                  {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
                  ))}
                </select>
                <button onClick={() => removeItem(i)} className="text-red-500 text-xs px-1">
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
              <input
                value={item.description}
                onChange={(e) => updateItem(i, { description: e.target.value })}
                placeholder="Description (optional)"
                className="w-full rounded-lg border border-outline-variant px-2 py-1.5 text-xs"
              />
              <label className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                <input
                  type="checkbox"
                  checked={item.is_required}
                  onChange={(e) => updateItem(i, { is_required: e.target.checked })}
                />
                Required
              </label>
            </div>
          ))}
          <button onClick={addItem} className="text-xs font-medium text-secondary hover:underline">
            + Add item
          </button>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button onClick={onCancel} className="text-xs font-medium text-on-surface-variant hover:underline">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !name.trim() || items.every((it) => !it.title.trim())}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold bg-primary text-on-primary hover:opacity-90 transition-all shadow-sm disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  )
}
