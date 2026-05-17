'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

const STEPS = [
  { title: 'Company Details',       fields: ['company_name', 'slug_note'] },
  { title: 'Logo & Branding',       fields: ['logo_url', 'accent_colour', 'login_tagline'] },
  { title: 'Contact & Email',       fields: ['email_from'] },
  { title: 'Timezone & Schedule',   fields: ['timezone', 'max_weekly_hours', 'shift_gap_minimum_hours'] },
  { title: 'Compliance Defaults',   fields: ['compliance_dbs_expiry_days', 'compliance_rtw_expiry_days', 'compliance_warning_days', 'compliance_critical_days'] },
  { title: 'Role Structure',        fields: ['require_dbs', 'require_rtw', 'require_references', 'require_id_verification', 'require_contract_signature'] },
  { title: 'Shift & Overtime Rules',fields: ['overtime_threshold_hours', 'block_non_compliant_staff'] },
  { title: 'Notifications',         fields: ['notify_expiry_email', 'notify_expiry_in_app', 'notify_safeguarding_email', 'notify_onboarding_stale', 'is_pilot', 'go_live_date'] },
]

const DEFAULTS = {
  company_name:                  '',
  logo_url:                      '',
  accent_colour:                 '#4f46e5',
  login_tagline:                 '',
  email_from:                    '',
  timezone:                      'Europe/London',
  max_weekly_hours:              48,
  shift_gap_minimum_hours:       11,
  compliance_dbs_expiry_days:    1095,
  compliance_rtw_expiry_days:    730,
  compliance_warning_days:       30,
  compliance_critical_days:      7,
  require_dbs:                   true,
  require_rtw:                   true,
  require_references:            true,
  require_id_verification:       true,
  require_contract_signature:    true,
  overtime_threshold_hours:      40,
  block_non_compliant_staff:     true,
  notify_expiry_email:           true,
  notify_expiry_in_app:          true,
  notify_safeguarding_email:     true,
  notify_onboarding_stale:       true,
  is_pilot:                      true,
  go_live_date:                  '',
}

type FormData = typeof DEFAULTS

export default function SetupWizardPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()

  const [step,    setStep]    = useState(0)
  const [form,    setForm]    = useState<FormData>(DEFAULTS)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [done,    setDone]    = useState(false)

  // Load existing config on mount
  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/admin/system/tenants/${id}`)
      if (!res.ok) return
      const data = await res.json()
      const cfg = data.config ?? {}
      const branding = data.branding ?? {}
      setForm(prev => ({
        ...prev,
        company_name:               branding.company_name ?? '',
        logo_url:                   branding.logo_url ?? '',
        accent_colour:              branding.accent_colour ?? '#4f46e5',
        login_tagline:              branding.login_tagline ?? '',
        email_from:                 branding.email_from ?? '',
        timezone:                   cfg.timezone ?? 'Europe/London',
        max_weekly_hours:           cfg.max_weekly_hours ?? 48,
        shift_gap_minimum_hours:    cfg.shift_gap_minimum_hours ?? 11,
        compliance_dbs_expiry_days: cfg.compliance_dbs_expiry_days ?? 1095,
        compliance_rtw_expiry_days: cfg.compliance_rtw_expiry_days ?? 730,
        compliance_warning_days:    cfg.compliance_warning_days ?? 30,
        compliance_critical_days:   cfg.compliance_critical_days ?? 7,
        require_dbs:                cfg.require_dbs ?? true,
        require_rtw:                cfg.require_rtw ?? true,
        require_references:         cfg.require_references ?? true,
        require_id_verification:    cfg.require_id_verification ?? true,
        require_contract_signature: cfg.require_contract_signature ?? true,
        overtime_threshold_hours:   cfg.overtime_threshold_hours ?? 40,
        block_non_compliant_staff:  cfg.block_non_compliant_staff ?? true,
        notify_expiry_email:        cfg.notify_expiry_email ?? true,
        notify_expiry_in_app:       cfg.notify_expiry_in_app ?? true,
        notify_safeguarding_email:  cfg.notify_safeguarding_email ?? true,
        notify_onboarding_stale:    cfg.notify_onboarding_stale ?? true,
        is_pilot:                   cfg.is_pilot ?? true,
        go_live_date:               cfg.go_live_date ?? '',
      }))
      if (cfg.setup_step) setStep(Math.min(cfg.setup_step, 7))
    }
    load()
  }, [id])

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function saveStep() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/system/tenants/${id}/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step, data: form }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Save failed')
      if (json.completed) {
        setDone(true)
      } else {
        setStep(s => Math.min(s + 1, 7))
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-4">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-8 h-8 text-emerald-600">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900">Setup Complete!</h2>
        <p className="text-slate-500 text-sm">This tenant has been fully configured and is ready for use.</p>
        <div className="flex justify-center gap-3 pt-2">
          <Link href={`/admin/system/tenants/${id}`} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
            View Tenant Health
          </Link>
          <Link href="/admin/system/tenants" className="px-4 py-2 border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50">
            All Tenants
          </Link>
        </div>
      </div>
    )
  }

  const currentStep = STEPS[step]

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
          <Link href={`/admin/system/tenants/${id}`} className="hover:text-indigo-600">Tenant</Link>
          <span>/</span>
          <span>Setup Wizard</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Tenant Setup Wizard</h1>
        <p className="text-sm text-slate-500 mt-1">Configure this tenant step by step. Changes are saved at each step.</p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-1 flex-1">
            <button
              onClick={() => i <= step && setStep(i)}
              className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition-colors ${
                i < step  ? 'bg-emerald-500 text-white cursor-pointer' :
                i === step ? 'bg-indigo-600 text-white' :
                'bg-slate-200 text-slate-400 cursor-default'
              }`}
            >
              {i < step ? '✓' : i + 1}
            </button>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 ${i < step ? 'bg-emerald-400' : 'bg-slate-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <h2 className="text-lg font-semibold text-slate-800">
          Step {step + 1} of {STEPS.length}: {currentStep.title}
        </h2>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
        )}

        {/* Step 0: Company Details */}
        {step === 0 && (
          <div className="space-y-4">
            <Field label="Display Name (override)">
              <input
                type="text"
                value={form.company_name}
                onChange={e => set('company_name', e.target.value)}
                placeholder="e.g. Sunrise Care Ltd"
                className="input"
              />
              <p className="text-xs text-slate-400 mt-1">Leave blank to use the company name from the database.</p>
            </Field>
          </div>
        )}

        {/* Step 1: Branding */}
        {step === 1 && (
          <div className="space-y-4">
            <Field label="Logo URL">
              <input type="url" value={form.logo_url} onChange={e => set('logo_url', e.target.value)} placeholder="https://..." className="input" />
            </Field>
            <Field label="Accent Colour">
              <div className="flex items-center gap-3">
                <input type="color" value={form.accent_colour} onChange={e => set('accent_colour', e.target.value)} className="h-10 w-16 rounded border border-slate-300 cursor-pointer" />
                <span className="text-sm text-slate-600">{form.accent_colour}</span>
              </div>
            </Field>
            <Field label="Login Tagline">
              <input type="text" value={form.login_tagline} onChange={e => set('login_tagline', e.target.value)} placeholder="e.g. Quality Care, Delivered Safely" className="input" />
            </Field>
          </div>
        )}

        {/* Step 2: Contact */}
        {step === 2 && (
          <div className="space-y-4">
            <Field label="Branded Email From">
              <input type="email" value={form.email_from} onChange={e => set('email_from', e.target.value)} placeholder="noreply@yourcompany.com" className="input" />
            </Field>
          </div>
        )}

        {/* Step 3: Timezone */}
        {step === 3 && (
          <div className="space-y-4">
            <Field label="Timezone">
              <select value={form.timezone} onChange={e => set('timezone', e.target.value)} className="input">
                <option value="Europe/London">Europe/London (GMT/BST)</option>
                <option value="Europe/Dublin">Europe/Dublin</option>
                <option value="UTC">UTC</option>
              </select>
            </Field>
            <Field label="Max Weekly Hours">
              <input type="number" value={form.max_weekly_hours} onChange={e => set('max_weekly_hours', Number(e.target.value))} min={1} max={168} className="input" />
            </Field>
            <Field label="Minimum Shift Gap (hours)">
              <input type="number" value={form.shift_gap_minimum_hours} onChange={e => set('shift_gap_minimum_hours', Number(e.target.value))} min={0} max={24} className="input" />
            </Field>
          </div>
        )}

        {/* Step 4: Compliance Defaults */}
        {step === 4 && (
          <div className="space-y-4">
            <Field label="DBS Expiry (days)">
              <input type="number" value={form.compliance_dbs_expiry_days} onChange={e => set('compliance_dbs_expiry_days', Number(e.target.value))} className="input" />
            </Field>
            <Field label="Right to Work Expiry (days)">
              <input type="number" value={form.compliance_rtw_expiry_days} onChange={e => set('compliance_rtw_expiry_days', Number(e.target.value))} className="input" />
            </Field>
            <Field label="Warning Period (days before expiry)">
              <input type="number" value={form.compliance_warning_days} onChange={e => set('compliance_warning_days', Number(e.target.value))} className="input" />
            </Field>
            <Field label="Critical Period (days before expiry)">
              <input type="number" value={form.compliance_critical_days} onChange={e => set('compliance_critical_days', Number(e.target.value))} className="input" />
            </Field>
          </div>
        )}

        {/* Step 5: Role Structure / Requirements */}
        {step === 5 && (
          <div className="space-y-3">
            {([
              ['require_dbs',                'Require DBS check'],
              ['require_rtw',                'Require Right to Work'],
              ['require_references',         'Require References'],
              ['require_id_verification',    'Require ID Verification'],
              ['require_contract_signature', 'Require Contract Signature'],
            ] as [keyof FormData, string][]).map(([key, label]) => (
              <Toggle key={key} label={label} value={form[key] as boolean} onChange={v => set(key, v as FormData[typeof key])} />
            ))}
          </div>
        )}

        {/* Step 6: Shifts & Overtime */}
        {step === 6 && (
          <div className="space-y-4">
            <Field label="Overtime Threshold (hours/week)">
              <input type="number" value={form.overtime_threshold_hours} onChange={e => set('overtime_threshold_hours', Number(e.target.value))} className="input" />
            </Field>
            <Toggle label="Block non-compliant staff from shifts" value={form.block_non_compliant_staff} onChange={v => set('block_non_compliant_staff', v)} />
          </div>
        )}

        {/* Step 7: Notifications + Go Live */}
        {step === 7 && (
          <div className="space-y-4">
            <div className="space-y-3">
              {([
                ['notify_expiry_email',       'Email alerts for expiring documents'],
                ['notify_expiry_in_app',      'In-app alerts for expiring documents'],
                ['notify_safeguarding_email', 'Email alerts for safeguarding incidents'],
                ['notify_onboarding_stale',   'Alert for stale onboarding (>30 days)'],
                ['is_pilot',                  'Mark as Pilot Tenant'],
              ] as [keyof FormData, string][]).map(([key, label]) => (
                <Toggle key={key} label={label} value={form[key] as boolean} onChange={v => set(key, v as FormData[typeof key])} />
              ))}
            </div>
            <Field label="Go Live Date">
              <input type="date" value={form.go_live_date} onChange={e => set('go_live_date', e.target.value)} className="input" />
            </Field>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setStep(s => Math.max(0, s - 1))}
          disabled={step === 0}
          className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Back
        </button>
        <button
          onClick={saveStep}
          disabled={saving}
          className="px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2"
        >
          {saving && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
          {step === 7 ? 'Complete Setup' : 'Save & Continue'}
        </button>
      </div>
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
