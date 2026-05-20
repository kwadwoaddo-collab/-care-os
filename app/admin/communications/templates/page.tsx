'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Template {
  id: string; name: string; description: string | null
  message_type: string; subject: string; body: string
  priority: string; channel: string; is_system: boolean; use_count: number
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

export default function TemplatesPage() {
  const [templates,  setTemplates]  = useState<Template[]>([])
  const [loading,    setLoading]    = useState(true)
  const [selected,   setSelected]   = useState<Template | null>(null)
  const [creating,   setCreating]   = useState(false)
  const [newTmpl,    setNewTmpl]    = useState({ name: '', description: '', message_type: 'announcement', subject: '', body: '', priority: 'normal', channel: 'in_app' })
  const [saving,     setSaving]     = useState(false)
  const [saveMsg,    setSaveMsg]    = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/communications/templates')
      .then(r => r.json())
      .then(d => setTemplates(d.templates ?? []))
      .finally(() => setLoading(false))
  }, [])

  async function saveTemplate() {
    if (!newTmpl.name || !newTmpl.subject || !newTmpl.body) return
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await fetch('/api/admin/communications/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTmpl),
      })
      const d = await res.json()
      if (d.template) {
        setTemplates(prev => [d.template, ...prev])
        setCreating(false)
        setNewTmpl({ name: '', description: '', message_type: 'announcement', subject: '', body: '', priority: 'normal', channel: 'in_app' })
        setSaveMsg('Template created.')
        setTimeout(() => setSaveMsg(null), 3000)
      }
    } finally { setSaving(false) }
  }

  const systemTemplates = templates.filter(t => t.is_system)
  const customTemplates = templates.filter(t => !t.is_system)

  if (loading) return <div className="flex items-center justify-center py-24"><span className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
            <Link href="/admin/communications" className="hover:text-indigo-600">Communications</Link>
            <span>/</span>
            <span>Templates</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Message Templates</h1>
          <p className="text-sm text-slate-500 mt-1">Reusable templates for operational messages and compliance reminders.</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
        >
          + New Template
        </button>
      </div>

      {saveMsg && <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">{saveMsg}</div>}

      {/* Create form */}
      {creating && (
        <div className="bg-surface-container-lowest border border-indigo-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-800">New Template</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
              <input type="text" value={newTmpl.name} onChange={e => setNewTmpl(p => ({...p, name: e.target.value}))} className="input" placeholder="e.g. Monthly Staff Update" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
              <select value={newTmpl.message_type} onChange={e => setNewTmpl(p => ({...p, message_type: e.target.value}))} className="input">
                {['announcement','compliance_reminder','staffing_alert','onboarding_reminder','safeguarding_escalation','shift_communication','broadcast'].map(t => (
                  <option key={t} value={t}>{t.replace(/_/g,' ')}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Description (optional)</label>
              <input type="text" value={newTmpl.description} onChange={e => setNewTmpl(p => ({...p, description: e.target.value}))} className="input" placeholder="When to use this template" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
              <input type="text" value={newTmpl.subject} onChange={e => setNewTmpl(p => ({...p, subject: e.target.value}))} className="input" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Body</label>
              <textarea rows={5} value={newTmpl.body} onChange={e => setNewTmpl(p => ({...p, body: e.target.value}))} className="input resize-none" placeholder="Use {{first_name}}, {{company_name}} for personalisation." />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
              <select value={newTmpl.priority} onChange={e => setNewTmpl(p => ({...p, priority: e.target.value}))} className="input">
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Channel</label>
              <select value={newTmpl.channel} onChange={e => setNewTmpl(p => ({...p, channel: e.target.value}))} className="input">
                <option value="in_app">In-app</option>
                <option value="email">Email</option>
                <option value="multi">In-app + Email</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button onClick={saveTemplate} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2">
              {saving && <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />}
              Save Template
            </button>
            <button onClick={() => setCreating(false)} className="text-sm text-slate-500 hover:text-slate-700">Cancel</button>
          </div>
        </div>
      )}

      {/* Selected template detail */}
      {selected && (
        <div className="bg-surface-container-lowest border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">{selected.name}</h2>
              {selected.description && <p className="text-xs text-slate-500 mt-0.5">{selected.description}</p>}
            </div>
            <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 text-xs">Close ✕</button>
          </div>
          <div className="bg-slate-50 rounded-lg p-4 space-y-2">
            <p className="text-xs font-semibold text-slate-500">Subject</p>
            <p className="text-sm font-medium text-slate-800">{selected.subject}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-4 space-y-2">
            <p className="text-xs font-semibold text-slate-500">Body</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{selected.body}</p>
          </div>
          <Link
            href={`/admin/communications/broadcast?template=${selected.id}`}
            className="inline-block text-sm text-indigo-600 font-medium hover:underline"
          >
            Use this template →
          </Link>
        </div>
      )}

      {/* System templates */}
      {systemTemplates.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">System Templates</h2>
          <div className="bg-surface-container-lowest border border-slate-200 rounded-xl overflow-hidden">
            {systemTemplates.map((t, i) => (
              <div
                key={t.id}
                onClick={() => setSelected(t)}
                className={`flex items-start justify-between px-4 py-3.5 cursor-pointer hover:bg-slate-50 transition-colors ${i > 0 ? 'border-t border-slate-50' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-800 truncate">{t.name}</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLOURS[t.message_type] ?? 'bg-slate-50 text-slate-600'}`}>
                      {t.message_type.replace(/_/g,' ')}
                    </span>
                  </div>
                  {t.description && <p className="text-xs text-slate-400 mt-0.5 truncate">{t.description}</p>}
                </div>
                <div className="flex items-center gap-3 ml-4 shrink-0">
                  <span className={`text-xs font-medium capitalize ${t.priority === 'critical' ? 'text-red-600' : t.priority === 'urgent' ? 'text-amber-600' : 'text-slate-400'}`}>
                    {t.priority}
                  </span>
                  <span className="text-xs text-indigo-600">View →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom templates */}
      {customTemplates.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">Custom Templates</h2>
          <div className="bg-surface-container-lowest border border-slate-200 rounded-xl overflow-hidden">
            {customTemplates.map((t, i) => (
              <div
                key={t.id}
                onClick={() => setSelected(t)}
                className={`flex items-start justify-between px-4 py-3.5 cursor-pointer hover:bg-slate-50 transition-colors ${i > 0 ? 'border-t border-slate-50' : ''}`}
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">{t.name}</p>
                  {t.description && <p className="text-xs text-slate-400 mt-0.5">{t.description}</p>}
                </div>
                <span className="text-xs text-indigo-600 ml-4">View →</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {customTemplates.length === 0 && !creating && (
        <div className="bg-surface-container-lowest border border-slate-200 rounded-xl p-8 text-center">
          <p className="text-slate-500 text-sm">No custom templates yet.</p>
          <button onClick={() => setCreating(true)} className="text-indigo-600 text-sm mt-2 hover:underline">
            Create your first template →
          </button>
        </div>
      )}
    </div>
  )
}
