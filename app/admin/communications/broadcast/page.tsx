'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Template {
  id: string; name: string; description: string | null
  message_type: string; subject: string; body: string
  priority: string; channel: string; is_system: boolean
}

const AUDIENCE_TYPES = [
  { value: 'all_staff',           label: 'All Staff' },
  { value: 'by_role',             label: 'By Admin Role' },
  { value: 'by_compliance_state', label: 'By Compliance State' },
  { value: 'by_onboarding_stage', label: 'By Onboarding Stage' },
  { value: 'individual',          label: 'Specific Staff (by ID)' },
]

const ROLES = [
  'coordinator', 'compliance_manager', 'registered_manager', 'company_admin',
]

const COMPLIANCE_STATES = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'expired',     label: 'Expired' },
  { value: 'rejected',    label: 'Rejected' },
]

const ONBOARDING_STAGES = [
  { value: 'pre_employment', label: 'Pre-employment' },
  { value: 'active',         label: 'Active' },
]

const MESSAGE_TYPES = [
  'announcement', 'compliance_reminder', 'staffing_alert',
  'onboarding_reminder', 'safeguarding_escalation', 'shift_communication', 'broadcast',
]

export default function BroadcastPage() {
  const router = useRouter()

  const [templates,  setTemplates]  = useState<Template[]>([])
  const [subject,    setSubject]    = useState('')
  const [body,       setBody]       = useState('')
  const [msgType,    setMsgType]    = useState('announcement')
  const [priority,   setPriority]   = useState('normal')
  const [channel,    setChannel]    = useState('in_app')
  const [audience,   setAudience]   = useState('all_staff')
  const [roles,      setRoles]      = useState<string[]>([])
  const [compStates, setCompStates] = useState<string[]>([])
  const [onbStages,  setOnbStages]  = useState<string[]>([])
  const [staffIds,   setStaffIds]   = useState('')
  const [sending,    setSending]    = useState(false)
  const [result,     setResult]     = useState<{sent?: number; failed?: number; recipients?: number; skipped?: boolean; error?: string} | null>(null)
  const [preview,    setPreview]    = useState(false)

  useEffect(() => {
    fetch('/api/admin/communications/templates')
      .then(r => r.json())
      .then(d => setTemplates(d.templates ?? []))
      .catch(() => {})
  }, [])

  function applyTemplate(t: Template) {
    setSubject(t.subject)
    setBody(t.body)
    setMsgType(t.message_type)
    setPriority(t.priority)
    setChannel(t.channel)
  }

  function toggleArray<T>(arr: T[], setArr: (v: T[]) => void, val: T) {
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
  }

  function buildFilter() {
    if (audience === 'by_role')             return { roles }
    if (audience === 'by_compliance_state') return { compliance_states: compStates }
    if (audience === 'by_onboarding_stage') return { onboarding_stages: onbStages }
    if (audience === 'individual')          return { staff_ids: staffIds.split(',').map(s => s.trim()).filter(Boolean) }
    return {}
  }

  async function send() {
    if (!subject.trim() || !body.trim()) return
    setSending(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/communications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          body,
          message_type:    msgType,
          priority,
          channel,
          audience_type:   audience,
          audience_filter: buildFilter(),
        }),
      })
      const d = await res.json()
      setResult(d)
      if (d.ok && !d.skipped) {
        setTimeout(() => router.push('/admin/communications'), 1500)
      }
    } catch {
      setResult({ error: 'Network error — please retry.' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
          <Link href="/admin/communications" className="hover:text-indigo-600">Communications</Link>
          <span>/</span>
          <span>New Message</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">New Broadcast</h1>
        <p className="text-sm text-slate-500 mt-1">Send an operational message, compliance reminder, or announcement to staff.</p>
      </div>

      {/* Template picker */}
      {templates.length > 0 && (
        <div className="bg-surface-container-lowest border border-slate-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-700">Start from a template</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {templates.slice(0, 6).map(t => (
              <button
                key={t.id}
                onClick={() => applyTemplate(t)}
                className="text-left p-3 border border-slate-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-colors group"
              >
                <p className="text-xs font-semibold text-slate-800 group-hover:text-indigo-700 truncate">{t.name}</p>
                {t.description && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{t.description}</p>}
                <div className="flex items-center gap-1 mt-1">
                  {t.is_system && <span className="text-[10px] bg-slate-100 text-slate-500 px-1 rounded">system</span>}
                  <span className="text-[10px] text-slate-400 capitalize">{t.priority}</span>
                </div>
              </button>
            ))}
          </div>
          <Link href="/admin/communications/templates" className="text-xs text-indigo-600 hover:underline">
            View all templates →
          </Link>
        </div>
      )}

      {result && (
        <div className={`rounded-xl p-4 text-sm font-medium border ${
          result.error  ? 'bg-red-50 border-red-200 text-red-700' :
          result.skipped ? 'bg-amber-50 border-amber-200 text-amber-700' :
          'bg-emerald-50 border-emerald-200 text-emerald-700'
        }`}>
          {result.error    ? result.error :
           result.skipped  ? 'Message suppressed — already sent recently.' :
           `Sent to ${result.recipients ?? 0} recipient${result.recipients !== 1 ? 's' : ''} (${result.sent ?? 0} delivered, ${result.failed ?? 0} failed). Redirecting…`}
        </div>
      )}

      {/* Message compose */}
      <div className="bg-surface-container-lowest border border-slate-200 rounded-xl p-6 space-y-5">
        <Section title="Message Content">
          <Field label="Subject">
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="e.g. Action required: DBS expiring this month"
              className="input"
            />
          </Field>
          <Field label="Body">
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Write your message here. Use {{first_name}}, {{company_name}} for personalisation."
              rows={6}
              className="input resize-none"
            />
            <p className="text-xs text-slate-400 mt-1">{body.length}/5000 characters</p>
          </Field>
        </Section>

        <Section title="Classification">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Type">
              <select value={msgType} onChange={e => setMsgType(e.target.value)} className="input">
                {MESSAGE_TYPES.map(t => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select value={priority} onChange={e => setPriority(e.target.value)} className="input">
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
                <option value="critical">Critical</option>
              </select>
            </Field>
            <Field label="Channel">
              <select value={channel} onChange={e => setChannel(e.target.value)} className="input">
                <option value="in_app">In-app only</option>
                <option value="email">Email only</option>
                <option value="multi">In-app + Email</option>
              </select>
            </Field>
          </div>
        </Section>

        <Section title="Audience">
          <Field label="Send to">
            <select value={audience} onChange={e => setAudience(e.target.value)} className="input">
              {AUDIENCE_TYPES.map(a => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </Field>

          {audience === 'by_role' && (
            <Field label="Select roles">
              <div className="flex flex-wrap gap-2 mt-1">
                {ROLES.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleArray(roles, setRoles, r)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      roles.includes(r)
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'border-slate-200 text-slate-600 hover:border-indigo-300'
                    }`}
                  >
                    {r.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </Field>
          )}

          {audience === 'by_compliance_state' && (
            <Field label="Compliance states">
              <div className="flex flex-wrap gap-2 mt-1">
                {COMPLIANCE_STATES.map(s => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => toggleArray(compStates, setCompStates, s.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      compStates.includes(s.value)
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'border-slate-200 text-slate-600 hover:border-amber-300'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </Field>
          )}

          {audience === 'by_onboarding_stage' && (
            <Field label="Onboarding stages">
              <div className="flex flex-wrap gap-2 mt-1">
                {ONBOARDING_STAGES.map(s => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => toggleArray(onbStages, setOnbStages, s.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      onbStages.includes(s.value)
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'border-slate-200 text-slate-600 hover:border-purple-300'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </Field>
          )}

          {audience === 'individual' && (
            <Field label="Staff IDs (comma-separated)">
              <input
                type="text"
                value={staffIds}
                onChange={e => setStaffIds(e.target.value)}
                placeholder="uuid1, uuid2, ..."
                className="input font-mono text-xs"
              />
            </Field>
          )}
        </Section>
      </div>

      {/* Preview toggle */}
      {subject && body && (
        <div className="bg-surface-container-lowest border border-slate-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setPreview(!preview)}
            className="w-full text-left px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center justify-between"
          >
            <span>Preview message</span>
            <span className="text-slate-400">{preview ? '▲' : '▼'}</span>
          </button>
          {preview && (
            <div className="px-5 pb-5 space-y-2">
              <p className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">{subject}</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{body}</p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Link href="/admin/communications" className="text-sm text-slate-500 hover:text-slate-700">
          &larr; Cancel
        </Link>
        <button
          onClick={send}
          disabled={sending || !subject.trim() || !body.trim()}
          className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2"
        >
          {sending && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
          Send Now
        </button>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-100 pb-1">{title}</p>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  )
}
