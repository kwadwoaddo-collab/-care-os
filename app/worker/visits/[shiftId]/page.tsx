'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Guidance {
  shift:    { id: string; title: string; shift_date: string; start_time: string; end_time: string; location: string | null; shift_type: string | null; notes: string | null }
  client:   { first_name: string; last_name: string; risk_level: string } | null
  care_package: { title: string } | null
  safeguarding_alerts: { id: string; incident_type: string; severity: string; description: string }[]
  medication_notes: { medication_name: string; dose: string | null; route: string | null; action: string }[]
  escalation_contacts: { name: string; role: string; email: string }[]
}

interface Task {
  id: string; task_type: string; task_name: string; task_description: string | null
  status: string; refused_reason: string | null; notes: string | null; completed_at: string | null
}

interface MedRecord {
  id: string; medication_name: string; dose: string | null; route: string | null
  scheduled_time: string | null; action: string; administered_at: string | null
  refused_reason: string | null; requires_escalation: boolean
}

type Phase = 'guidance' | 'checklist' | 'medication' | 'escalate' | 'complete'

const TASK_TYPE_ICON: Record<string, string> = {
  care:        '🤝',
  medication:  '💊',
  observation: '👁',
  wellbeing:   '❤️',
  risk:        '⚠️',
}

const TASK_STATUS_CLS: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-700',
  skipped:   'bg-slate-100 text-slate-500',
  partial:   'bg-amber-100 text-amber-700',
  refused:   'bg-red-100 text-red-700',
  pending:   'bg-white text-slate-700 border border-slate-200',
}

const MED_ACTION_CLS: Record<string, string> = {
  administered: 'bg-emerald-100 text-emerald-700',
  refused:      'bg-red-100 text-red-700',
  unavailable:  'bg-slate-100 text-slate-500',
  missed:       'bg-red-100 text-red-700',
  prn:          'bg-blue-100 text-blue-700',
}

function fmtTime(t: string) { return t.slice(0, 5) }

// ── Default tasks to seed for a new visit ────────────────────────────────────
const DEFAULT_TASKS: { task_type: string; task_name: string; sequence_order: number }[] = [
  { task_type: 'wellbeing',   task_name: 'Wellbeing check — mood and general health', sequence_order: 1 },
  { task_type: 'care',        task_name: 'Personal hygiene / washing',                sequence_order: 2 },
  { task_type: 'care',        task_name: 'Dressing and grooming',                      sequence_order: 3 },
  { task_type: 'care',        task_name: 'Meal preparation and assistance',             sequence_order: 4 },
  { task_type: 'observation', task_name: 'Record food and fluid intake',               sequence_order: 5 },
  { task_type: 'risk',        task_name: 'Check environment for hazards',              sequence_order: 6 },
]

// ── Inner component ───────────────────────────────────────────────────────────

function VisitExecutionInner() {
  const { shiftId } = useParams<{ shiftId: string }>()
  const searchParams = useSearchParams()
  const token  = searchParams.get('token') ?? (typeof window !== 'undefined' ? sessionStorage.getItem('worker_token') ?? '' : '')
  const online = useOnlineStatus()

  const [phase,     setPhase]     = useState<Phase>('guidance')
  const [guidance,  setGuidance]  = useState<Guidance | null>(null)
  const [tasks,     setTasks]     = useState<Task[]>([])
  const [meds,      setMeds]      = useState<MedRecord[]>([])
  const [arrivedAt, setArrivedAt] = useState<string | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [busy,      setBusy]      = useState(false)

  // New task / medication form state
  const [newTask, setNewTask] = useState({ task_type: 'care', task_name: '' })
  const [newMed,  setNewMed]  = useState({ medication_name: '', dose: '', route: '', scheduled_time: '', action: 'administered', refused_reason: '', prn_reason: '', notes: '' })

  // Escalation form
  const [escType,  setEscType]  = useState('safeguarding')
  const [escNotes, setEscNotes] = useState('')
  const [escalated, setEscalated] = useState(false)

  const loadGuidance = useCallback(async () => {
    if (!token) { setError('Portal token missing.'); setLoading(false); return }
    try {
      const res = await fetch(`/api/worker/visits/${shiftId}/guidance?token=${encodeURIComponent(token)}`)
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? 'Failed to load visit'); return }
      setGuidance(d)
    } catch { setError('Failed to load visit guidance.') }
    finally { setLoading(false) }
  }, [shiftId, token])

  const loadTasks = useCallback(async () => {
    const res = await fetch(`/api/worker/visits/${shiftId}/checklist?token=${encodeURIComponent(token)}`)
    const d = await res.json()
    setTasks(d.tasks ?? [])
  }, [shiftId, token])

  const loadMeds = useCallback(async () => {
    const res = await fetch(`/api/worker/visits/${shiftId}/medication?token=${encodeURIComponent(token)}`)
    const d = await res.json()
    setMeds(d.records ?? [])
  }, [shiftId, token])

  useEffect(() => { loadGuidance() }, [loadGuidance])
  useEffect(() => { if (phase === 'checklist') loadTasks() }, [phase, loadTasks])
  useEffect(() => { if (phase === 'medication') loadMeds() }, [phase, loadMeds])

  async function arrive() {
    setBusy(true)
    const res = await fetch(`/api/worker/visits/${shiftId}/arrive`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
    const d = await res.json()
    if (d.ok) {
      setArrivedAt(d.arrived_at)
      // Seed default tasks
      for (const t of DEFAULT_TASKS) {
        await fetch(`/api/worker/visits/${shiftId}/checklist`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, ...t }) })
      }
      setPhase('checklist')
      await loadTasks()
    }
    setBusy(false)
  }

  async function updateTask(taskId: string, status: string, opts?: { refused_reason?: string; notes?: string }) {
    await fetch(`/api/worker/visits/${shiftId}/checklist`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, task_id: taskId, status, ...opts }),
    })
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status, ...opts } : t))
  }

  async function addTask() {
    if (!newTask.task_name.trim()) return
    setBusy(true)
    const res = await fetch(`/api/worker/visits/${shiftId}/checklist`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, ...newTask, sequence_order: tasks.length + 1 }) })
    const d = await res.json()
    if (d.task) setTasks(prev => [...prev, d.task])
    setNewTask({ task_type: 'care', task_name: '' })
    setBusy(false)
  }

  async function addMed() {
    if (!newMed.medication_name.trim()) return
    setBusy(true)
    const res = await fetch(`/api/worker/visits/${shiftId}/medication`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, ...newMed }) })
    const d = await res.json()
    if (d.record) setMeds(prev => [...prev, d.record])
    setNewMed({ medication_name: '', dose: '', route: '', scheduled_time: '', action: 'administered', refused_reason: '', prn_reason: '', notes: '' })
    setBusy(false)
  }

  async function raiseEscalation() {
    setBusy(true)
    const res = await fetch(`/api/worker/visits/${shiftId}/escalate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, escalation_type: escType, notes: escNotes, severity: 'high' }) })
    const d = await res.json()
    if (d.ok) setEscalated(true)
    setBusy(false)
  }

  async function depart() {
    setBusy(true)
    await fetch(`/api/worker/visits/${shiftId}/depart`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
    setPhase('complete')
    setBusy(false)
  }

  if (loading) return <div className="flex items-center justify-center py-24"><span className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
  if (error)   return (
    <div className="space-y-3">
      {!online && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3 text-sm text-amber-700">
          <span>📡</span><span>You are offline. Visit data may be unavailable.</span>
        </div>
      )}
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
        <p>{error}</p>
        <Link href="/worker/shifts" className="text-sm text-red-600 underline mt-2 inline-block">Back to shifts</Link>
      </div>
    </div>
  )

  const g = guidance!
  const clientName = g.client ? `${g.client.first_name} ${g.client.last_name}` : g.shift.title
  const completedCount = tasks.filter(t => t.status === 'completed').length
  const totalTasks = tasks.length

  // ── Nav tabs ─────────────────────────────────────────────────────────────
  const tabs: { key: Phase; label: string; disabled?: boolean }[] = [
    { key: 'guidance',   label: 'Briefing' },
    { key: 'checklist',  label: `Tasks${totalTasks > 0 ? ` (${completedCount}/${totalTasks})` : ''}`, disabled: !arrivedAt },
    { key: 'medication', label: `Meds${meds.length > 0 ? ` (${meds.length})` : ''}`, disabled: !arrivedAt },
    { key: 'escalate',   label: 'Escalate', disabled: !arrivedAt },
  ]

  return (
    <div className="space-y-4 pb-24">
      {/* Offline warning */}
      {!online && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3 text-sm text-amber-700">
          <span className="shrink-0">📡</span>
          <span>You are offline. Actions will be saved when you reconnect.</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <Link href="/worker/shifts" className="text-sm text-gray-500 hover:text-gray-900">← Shifts</Link>
        <Link
          href="/worker/safety"
          className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 active:scale-95 transition-all"
        >
          🚨 Safety
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-bold text-gray-900">{clientName}</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {fmtTime(g.shift.start_time)}–{fmtTime(g.shift.end_time)}
          {g.shift.location && ` · ${g.shift.location}`}
        </p>
        {g.client?.risk_level && g.client.risk_level !== 'standard' && (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold mt-1 capitalize ${g.client.risk_level === 'critical' ? 'bg-red-100 text-red-700' : g.client.risk_level === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'}`}>
            {g.client.risk_level} risk
          </span>
        )}
      </div>

      {/* Safeguarding alert banner */}
      {g.safeguarding_alerts.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-3">
          <p className="text-sm font-bold text-red-800">⚠ Safeguarding alert</p>
          {g.safeguarding_alerts.map(a => (
            <p key={a.id} className="text-xs text-red-700 mt-1">{a.incident_type}: {a.description?.slice(0, 100)}</p>
          ))}
        </div>
      )}

      {/* Phase tabs */}
      <div className="flex gap-0 border-b border-gray-200 overflow-x-auto no-scrollbar">
        {tabs.map(tab => (
          <button
            key={tab.key}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && setPhase(tab.key)}
            className={`px-3 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors disabled:opacity-40 ${
              phase === tab.key ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── GUIDANCE ─────────────────────────────────────────────────────────── */}
      {phase === 'guidance' && (
        <div className="space-y-4">
          {/* Shift notes */}
          {g.shift.notes && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-blue-700 mb-1">Coordinator notes</p>
              <p className="text-sm text-blue-900">{g.shift.notes}</p>
            </div>
          )}

          {/* Previous medication */}
          {g.medication_notes.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
              <p className="text-sm font-semibold text-gray-800">Previous medication (last visit)</p>
              {g.medication_notes.map((m, i) => (
                <div key={i} className="flex items-start justify-between text-sm">
                  <span className="text-gray-700">{m.medication_name}{m.dose ? ` — ${m.dose}` : ''}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${MED_ACTION_CLS[m.action] ?? 'bg-slate-100 text-slate-500'}`}>{m.action}</span>
                </div>
              ))}
            </div>
          )}

          {/* Key risks */}
          {g.client?.risk_level && g.client.risk_level !== 'standard' && (
            <div className={`rounded-xl border p-4 ${g.client.risk_level === 'critical' ? 'bg-red-50 border-red-300' : 'bg-orange-50 border-orange-300'}`}>
              <p className="text-sm font-bold text-gray-800 mb-1">
                {g.client.risk_level === 'critical' ? '⚠️ Critical risk client' : '⚠️ High risk client'}
              </p>
              <p className="text-xs text-gray-600">Follow all care plan instructions precisely. Escalate any concerns immediately.</p>
            </div>
          )}

          {/* Care package context */}
          {g.care_package && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-gray-800 mb-1">Care package</p>
              <p className="text-sm text-gray-700">{g.care_package.title}</p>
            </div>
          )}

          {/* Escalation contacts */}
          {g.escalation_contacts.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
              <p className="text-sm font-semibold text-gray-800">Escalation contacts</p>
              {g.escalation_contacts.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-gray-700">{c.name}</p>
                    <p className="text-xs text-gray-500 capitalize">{c.role}</p>
                  </div>
                  <a href={`tel:${c.email}`} className="text-indigo-600 text-xs hover:underline">{c.email}</a>
                </div>
              ))}
            </div>
          )}

          {/* Arrive CTA */}
          {!arrivedAt ? (
            <button onClick={arrive} disabled={busy} className="w-full py-4 bg-indigo-600 text-white text-base font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {busy && <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              Confirm Arrival
            </button>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
              <p className="text-sm font-semibold text-emerald-700">Arrived {new Date(arrivedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
              <button onClick={() => setPhase('checklist')} className="text-indigo-600 text-sm mt-2 hover:underline">Go to checklist →</button>
            </div>
          )}
        </div>
      )}

      {/* ── CHECKLIST ────────────────────────────────────────────────────────── */}
      {phase === 'checklist' && (
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No tasks yet. Add a task below.</p>
          ) : (
            tasks.map(t => (
              <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1">
                    <span className="text-lg shrink-0">{TASK_TYPE_ICON[t.task_type] ?? '📋'}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{t.task_name}</p>
                      {t.refused_reason && <p className="text-xs text-red-600 mt-0.5">Refused: {t.refused_reason}</p>}
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 capitalize ${TASK_STATUS_CLS[t.status] ?? 'bg-slate-100 text-slate-500'}`}>
                    {t.status}
                  </span>
                </div>
                {t.status === 'pending' && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {(['completed','partial','skipped','refused'] as const).map(s => (
                      <button key={s} onClick={() => updateTask(t.id, s)} className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 capitalize transition-colors">
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}

          {/* Add task */}
          <div className="bg-white border border-dashed border-slate-300 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Add task</p>
            <div className="flex gap-2">
              <select value={newTask.task_type} onChange={e => setNewTask(p => ({...p, task_type: e.target.value}))} className="input flex-none w-28 text-xs">
                {Object.keys(TASK_TYPE_ICON).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <input type="text" value={newTask.task_name} onChange={e => setNewTask(p => ({...p, task_name: e.target.value}))} placeholder="Task description" className="input flex-1 text-sm" />
            </div>
            <button onClick={addTask} disabled={busy || !newTask.task_name.trim()} className="w-full py-2 bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-60">
              Add Task
            </button>
          </div>

          <button onClick={() => setPhase('medication')} className="w-full py-3 border border-indigo-200 text-indigo-700 text-sm font-medium rounded-xl hover:bg-indigo-50">
            Continue to Medication →
          </button>
        </div>
      )}

      {/* ── MEDICATION ───────────────────────────────────────────────────────── */}
      {phase === 'medication' && (
        <div className="space-y-3">
          {meds.length > 0 && (
            <div className="space-y-2">
              {meds.map(m => (
                <div key={m.id} className={`bg-white rounded-xl border p-4 ${m.requires_escalation ? 'border-red-300' : 'border-gray-200'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-800">💊 {m.medication_name}</p>
                      {m.dose && <p className="text-xs text-gray-500">{m.dose}{m.route ? ` — ${m.route}` : ''}</p>}
                      {m.refused_reason && <p className="text-xs text-red-600 mt-0.5">Refused: {m.refused_reason}</p>}
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 capitalize ${MED_ACTION_CLS[m.action] ?? 'bg-slate-100 text-slate-500'}`}>
                      {m.action}
                    </span>
                  </div>
                  {m.requires_escalation && (
                    <p className="text-xs text-red-600 font-semibold mt-2">⚠ Escalation required</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Record medication */}
          <div className="bg-white border border-dashed border-slate-300 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Record medication</p>
            <input type="text" value={newMed.medication_name} onChange={e => setNewMed(p => ({...p, medication_name: e.target.value}))} placeholder="Medication name *" className="input text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={newMed.dose} onChange={e => setNewMed(p => ({...p, dose: e.target.value}))} placeholder="Dose (e.g. 10mg)" className="input text-sm" />
              <input type="text" value={newMed.route} onChange={e => setNewMed(p => ({...p, route: e.target.value}))} placeholder="Route (oral, etc.)" className="input text-sm" />
            </div>
            <select value={newMed.action} onChange={e => setNewMed(p => ({...p, action: e.target.value}))} className="input text-sm">
              <option value="administered">Administered</option>
              <option value="refused">Refused by client</option>
              <option value="unavailable">Medication unavailable</option>
              <option value="missed">Missed</option>
              <option value="prn">PRN (as needed)</option>
            </select>
            {(newMed.action === 'refused' || newMed.action === 'missed') && (
              <input type="text" value={newMed.refused_reason} onChange={e => setNewMed(p => ({...p, refused_reason: e.target.value}))} placeholder="Reason" className="input text-sm" />
            )}
            {newMed.action === 'prn' && (
              <input type="text" value={newMed.prn_reason} onChange={e => setNewMed(p => ({...p, prn_reason: e.target.value}))} placeholder="PRN reason" className="input text-sm" />
            )}
            <textarea value={newMed.notes} onChange={e => setNewMed(p => ({...p, notes: e.target.value}))} placeholder="Notes (optional)" rows={2} className="input text-sm resize-none" />
            <button onClick={addMed} disabled={busy || !newMed.medication_name.trim()} className="w-full py-2 bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-60">
              Record Medication
            </button>
          </div>

          <button onClick={depart} disabled={busy} className="w-full py-4 bg-emerald-600 text-white text-base font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2">
            {busy && <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            End Visit & Depart
          </button>
        </div>
      )}

      {/* ── ESCALATE ─────────────────────────────────────────────────────────── */}
      {phase === 'escalate' && (
        <div className="space-y-4">
          {escalated ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center space-y-2">
              <p className="text-2xl">✅</p>
              <p className="text-sm font-bold text-emerald-800">Escalation raised</p>
              <p className="text-xs text-emerald-700">Your coordinator has been notified. An incident record has been created.</p>
              <button onClick={() => setPhase('checklist')} className="text-indigo-600 text-sm hover:underline mt-2 inline-block">Back to checklist</button>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <p className="text-sm font-semibold text-gray-800">Raise a concern or escalation</p>
              <p className="text-xs text-gray-500">This will immediately notify your coordinator and create an incident record.</p>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Type of concern</label>
                <select value={escType} onChange={e => setEscType(e.target.value)} className="input text-sm">
                  <option value="safeguarding">Safeguarding concern</option>
                  <option value="medical">Medical emergency</option>
                  <option value="medication">Medication issue</option>
                  <option value="operational">Operational issue</option>
                  <option value="client_refusal">Client refusal</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description *</label>
                <textarea
                  value={escNotes}
                  onChange={e => setEscNotes(e.target.value)}
                  rows={4}
                  placeholder="Describe what happened and what action you have taken…"
                  className="input text-sm resize-none"
                />
              </div>

              <button
                onClick={raiseEscalation}
                disabled={busy || !escNotes.trim()}
                className="w-full py-3 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {busy && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                Raise Escalation
              </button>

              {g.escalation_contacts.length > 0 && (
                <div className="border-t border-slate-100 pt-3 space-y-1">
                  <p className="text-xs font-semibold text-gray-500">Emergency contacts</p>
                  {g.escalation_contacts.map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-gray-700">{c.name} ({c.role})</span>
                      <a href={`mailto:${c.email}`} className="text-indigo-600 hover:underline">{c.email}</a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── COMPLETE ─────────────────────────────────────────────────────────── */}
      {phase === 'complete' && (
        <div className="text-center py-12 space-y-4">
          <div className="text-5xl">✅</div>
          <h2 className="text-xl font-bold text-gray-900">Visit complete</h2>
          <p className="text-sm text-gray-500">You have departed. {completedCount} of {totalTasks} tasks completed.</p>
          <p className="text-xs text-gray-400">Your visit notes have been saved automatically.</p>
          <div className="flex justify-center gap-3 pt-2">
            <Link href={`/worker/shifts`} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
              Back to Shifts
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export default function WorkerVisitPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24"><span className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>}>
      <VisitExecutionInner />
    </Suspense>
  )
}
