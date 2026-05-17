'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface ConfigData {
  is_active:                    boolean
  is_pilot:                     boolean
  go_live_date:                 string
  timezone:                     string
  compliance_dbs_expiry_days:   number
  compliance_rtw_expiry_days:   number
  compliance_training_days:     number
  compliance_warning_days:      number
  compliance_critical_days:     number
  escalation_unresolved_hours:  number
  escalation_critical_hours:    number
  block_non_compliant_staff:    boolean
  block_expired_dbs:            boolean
  block_expired_rtw:            boolean
  require_dbs:                  boolean
  require_rtw:                  boolean
  require_references:           boolean
  require_id_verification:      boolean
  require_contract_signature:   boolean
  max_weekly_hours:             number
  overtime_threshold_hours:     number
  shift_gap_minimum_hours:      number
  notify_expiry_email:          boolean
  notify_expiry_in_app:         boolean
  notify_safeguarding_email:    boolean
  notify_onboarding_stale:      boolean
  allow_compliance_override:    boolean
  allow_shift_override:         boolean
}

const DEFAULTS: ConfigData = {
  is_active:                   true,
  is_pilot:                    false,
  go_live_date:                '',
  timezone:                    'Europe/London',
  compliance_dbs_expiry_days:  1095,
  compliance_rtw_expiry_days:  730,
  compliance_training_days:    365,
  compliance_warning_days:     30,
  compliance_critical_days:    7,
  escalation_unresolved_hours: 24,
  escalation_critical_hours:   4,
  block_non_compliant_staff:   true,
  block_expired_dbs:           true,
  block_expired_rtw:           true,
  require_dbs:                 true,
  require_rtw:                 true,
  require_references:          true,
  require_id_verification:     true,
  require_contract_signature:  true,
  max_weekly_hours:            48,
  overtime_threshold_hours:    40,
  shift_gap_minimum_hours:     11,
  notify_expiry_email:         true,
  notify_expiry_in_app:        true,
  notify_safeguarding_email:   true,
  notify_onboarding_stale:     true,
  allow_compliance_override:   false,
  allow_shift_override:        false,
}

export default function ConfigPage() {
  const { id } = useParams<{ id: string }>()
  const [form,    setForm]   = useState<ConfigData>(DEFAULTS)
  const [saving,  setSaving] = useState(false)
  const [saved,   setSaved]  = useState(false)
  const [error,   setError]  = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/admin/system/tenants/${id}/config`)
      .then(r => r.json())
      .then(d => {
        if (d.config) {
          setForm(prev => ({ ...prev, ...d.config, go_live_date: d.config.go_live_date ?? '' }))
        }
      })
      .finally(() => setLoading(false))
  }, [id])

  function set<K extends keyof ConfigData>(key: K, value: ConfigData[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function save() {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const res = await fetch(`/api/admin/system/tenants/${id}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Save failed')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24"><span className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
          <Link href={`/admin/system/tenants/${id}`} className="hover:text-indigo-600">Tenant</Link>
          <span>/</span>
          <span>Configuration</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Tenant Configuration</h1>
        <p className="text-sm text-slate-500 mt-1">Per-tenant compliance thresholds, blocking rules, and notification settings.</p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}
      {saved && <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">Configuration saved successfully.</div>}

      {/* Tenant Status */}
      <Section title="Tenant Status">
        <Toggle label="Active Tenant" value={form.is_active} onChange={v => set('is_active', v)} />
        <Toggle label="Pilot Mode" value={form.is_pilot} onChange={v => set('is_pilot', v)} />
        <Field label="Go Live Date">
          <input type="date" value={form.go_live_date} onChange={e => set('go_live_date', e.target.value)} className="input" />
        </Field>
      </Section>

      {/* Compliance Thresholds */}
      <Section title="Compliance Thresholds">
        <NumField label="DBS Expiry (days)"                value={form.compliance_dbs_expiry_days}  min={30}  max={3650} onChange={v => set('compliance_dbs_expiry_days', v)} />
        <NumField label="Right to Work Expiry (days)"      value={form.compliance_rtw_expiry_days}  min={30}  max={3650} onChange={v => set('compliance_rtw_expiry_days', v)} />
        <NumField label="Training Expiry (days)"           value={form.compliance_training_days}    min={30}  max={1825} onChange={v => set('compliance_training_days', v)} />
        <NumField label="Warning Period (days before)"     value={form.compliance_warning_days}     min={1}   max={180}  onChange={v => set('compliance_warning_days', v)} />
        <NumField label="Critical Period (days before)"    value={form.compliance_critical_days}    min={1}   max={30}   onChange={v => set('compliance_critical_days', v)} />
      </Section>

      {/* Escalation Timings */}
      <Section title="Escalation Timings">
        <NumField label="Escalate Unresolved After (hours)"  value={form.escalation_unresolved_hours} min={1}  max={168} onChange={v => set('escalation_unresolved_hours', v)} />
        <NumField label="Critical Escalation After (hours)"  value={form.escalation_critical_hours}   min={1}  max={48}  onChange={v => set('escalation_critical_hours', v)} />
      </Section>

      {/* Assignment Blocking */}
      <Section title="Assignment Blocking Rules">
        <Toggle label="Block non-compliant staff from shifts"   value={form.block_non_compliant_staff} onChange={v => set('block_non_compliant_staff', v)} />
        <Toggle label="Block staff with expired DBS"            value={form.block_expired_dbs}         onChange={v => set('block_expired_dbs', v)} />
        <Toggle label="Block staff with expired Right to Work"  value={form.block_expired_rtw}         onChange={v => set('block_expired_rtw', v)} />
      </Section>

      {/* Onboarding Requirements */}
      <Section title="Onboarding Requirements">
        <Toggle label="Require DBS check"          value={form.require_dbs}                 onChange={v => set('require_dbs', v)} />
        <Toggle label="Require Right to Work"      value={form.require_rtw}                 onChange={v => set('require_rtw', v)} />
        <Toggle label="Require References"         value={form.require_references}          onChange={v => set('require_references', v)} />
        <Toggle label="Require ID Verification"    value={form.require_id_verification}     onChange={v => set('require_id_verification', v)} />
        <Toggle label="Require Contract Signature" value={form.require_contract_signature}  onChange={v => set('require_contract_signature', v)} />
      </Section>

      {/* Shift / Overtime Rules */}
      <Section title="Shift & Overtime Rules">
        <NumField label="Max Weekly Hours"              value={form.max_weekly_hours}           min={1}   max={168} onChange={v => set('max_weekly_hours', v)} />
        <NumField label="Overtime Threshold (hours)"    value={form.overtime_threshold_hours}   min={1}   max={168} onChange={v => set('overtime_threshold_hours', v)} />
        <NumField label="Minimum Shift Gap (hours)"     value={form.shift_gap_minimum_hours}    min={0}   max={24}  onChange={v => set('shift_gap_minimum_hours', v)} />
      </Section>

      {/* Notification Preferences */}
      <Section title="Notification Preferences">
        <Toggle label="Email alerts for expiring documents"     value={form.notify_expiry_email}       onChange={v => set('notify_expiry_email', v)} />
        <Toggle label="In-app alerts for expiring documents"    value={form.notify_expiry_in_app}      onChange={v => set('notify_expiry_in_app', v)} />
        <Toggle label="Email alerts for safeguarding incidents" value={form.notify_safeguarding_email} onChange={v => set('notify_safeguarding_email', v)} />
        <Toggle label="Alert for stale onboarding (>30 days)"  value={form.notify_onboarding_stale}   onChange={v => set('notify_onboarding_stale', v)} />
      </Section>

      {/* Override Permissions */}
      <Section title="Override Permissions">
        <Toggle label="Allow compliance override by registered manager" value={form.allow_compliance_override} onChange={v => set('allow_compliance_override', v)} />
        <Toggle label="Allow shift assignment override"                 value={form.allow_shift_override}       onChange={v => set('allow_shift_override', v)} />
      </Section>

      <div className="flex items-center justify-between">
        <Link href={`/admin/system/tenants/${id}`} className="text-sm text-slate-500 hover:text-slate-700">
          &larr; Back to tenant
        </Link>
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2"
        >
          {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
          Save Configuration
        </button>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide border-b border-slate-100 pb-2">{title}</h2>
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

function NumField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <Field label={label}>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={e => onChange(Number(e.target.value))}
        className="input w-40"
      />
    </Field>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div
        onClick={() => onChange(!value)}
        className={`relative w-10 h-5 rounded-full transition-colors ${value ? 'bg-indigo-600' : 'bg-slate-300'}`}
      >
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0'}`} />
      </div>
      <span className="text-sm text-slate-700">{label}</span>
    </label>
  )
}
