'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Applicant {
  id: string
  company_id: string
  email: string
  first_name: string
  last_name: string
  phone: string | null
  job_role: string | null
  status: string
  created_at: string
}

interface FormValues {
  // Section 1 — Personal Details
  first_name: string
  last_name: string
  email: string
  phone: string
  job_role: string
  address_line_1: string
  address_line_2: string
  town_city: string
  postcode: string
  date_of_birth: string
  national_insurance: string
  // Section 2 — Employment History
  current_employer: string
  current_job_title: string
  employment_start_date: string
  employment_end_date: string
  reason_for_leaving: string
  employment_gaps: string
  employment_gap_explanation: string
  // Section 2 — References
  reference_1_name: string
  reference_1_position: string
  reference_1_company: string
  reference_1_email: string
  reference_1_phone: string
  reference_1_relationship: string
  reference_2_name: string
  reference_2_position: string
  reference_2_company: string
  reference_2_email: string
  reference_2_phone: string
  reference_2_relationship: string
}

type PageState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; applicant: Applicant }

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

// ── Empty form defaults ────────────────────────────────────────────────────────

const EMPTY: FormValues = {
  first_name: '', last_name: '', email: '', phone: '',
  job_role: '', address_line_1: '', address_line_2: '',
  town_city: '', postcode: '', date_of_birth: '', national_insurance: '',
  current_employer: '', current_job_title: '',
  employment_start_date: '', employment_end_date: '',
  reason_for_leaving: '', employment_gaps: '', employment_gap_explanation: '',
  reference_1_name: '', reference_1_position: '', reference_1_company: '',
  reference_1_email: '', reference_1_phone: '', reference_1_relationship: '',
  reference_2_name: '', reference_2_position: '', reference_2_company: '',
  reference_2_email: '', reference_2_phone: '', reference_2_relationship: '',
}

function fromApplicant(a: Applicant): FormValues {
  return {
    ...EMPTY,
    first_name: a.first_name ?? '',
    last_name:  a.last_name  ?? '',
    email:      a.email      ?? '',
    phone:      a.phone      ?? '',
    job_role:   a.job_role   ?? '',
  }
}

// ── Shared styles ──────────────────────────────────────────────────────────────

const inputCls =
  'block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 ' +
  'placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ' +
  'disabled:bg-gray-50 disabled:text-gray-500'

const textareaCls =
  inputCls + ' resize-y min-h-[88px]'

// ── Sub-components ─────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

type RefPrefix = 'reference_1' | 'reference_2'
type RefSuffix = 'name' | 'position' | 'company' | 'email' | 'phone' | 'relationship'

function rk(prefix: RefPrefix, suffix: RefSuffix): keyof FormValues {
  return `${prefix}_${suffix}` as keyof FormValues
}

function ReferenceSection({
  prefix,
  title,
  form,
  set,
}: {
  prefix: RefPrefix
  title: string
  form: FormValues
  set: (field: keyof FormValues, value: string) => void
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-gray-800">{title}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full name" required>
          <input
            type="text"
            className={inputCls}
            value={form[rk(prefix, 'name')]}
            onChange={e => set(rk(prefix, 'name'), e.target.value)}
          />
        </Field>
        <Field label="Job title / Position">
          <input
            type="text"
            className={inputCls}
            value={form[rk(prefix, 'position')]}
            onChange={e => set(rk(prefix, 'position'), e.target.value)}
          />
        </Field>
      </div>

      <Field label="Company or organisation">
        <input
          type="text"
          className={inputCls}
          value={form[rk(prefix, 'company')]}
          onChange={e => set(rk(prefix, 'company'), e.target.value)}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Email" required>
          <input
            type="email"
            className={inputCls}
            value={form[rk(prefix, 'email')]}
            onChange={e => set(rk(prefix, 'email'), e.target.value)}
          />
        </Field>
        <Field label="Phone">
          <input
            type="tel"
            className={inputCls}
            value={form[rk(prefix, 'phone')]}
            onChange={e => set(rk(prefix, 'phone'), e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Relationship to you" hint="e.g. Line manager, Supervisor">
          <input
            type="text"
            className={inputCls}
            value={form[rk(prefix, 'relationship')]}
            onChange={e => set(rk(prefix, 'relationship'), e.target.value)}
          />
        </Field>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ApplyContent() {
  const params    = useSearchParams()
  const token     = params.get('token')
  const [page, setPage]           = useState<PageState>({ phase: 'loading' })
  const [form, setForm]           = useState<FormValues>(EMPTY)
  const [saveState, setSave]      = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  function set(field: keyof FormValues, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    if (saveState === 'saved' || saveState === 'error') setSave('idle')
  }

  // ── Validate token on mount ──────────────────────────────────────────────────

  useEffect(() => {
    if (!token) {
      setPage({ phase: 'error', message: 'No invitation token found. Please use the link from your invitation email.' })
      return
    }

    let cancelled = false

    async function validate() {
      const res = await fetch(`/api/applicant/validate?token=${encodeURIComponent(token!)}`)
      if (cancelled) return

      if (res.ok) {
        const json = await res.json() as { applicant: Applicant }
        setPage({ phase: 'ready', applicant: json.applicant })
        setForm(fromApplicant(json.applicant))
        return
      }

      let message = 'Something went wrong. Please try again or contact your employer.'
      if (res.status === 410) {
        message = 'This invitation link has expired. Please contact your employer to request a new one.'
      } else if (res.status === 401) {
        message = 'This invitation link is invalid. Please use the link from your invitation email.'
      } else if (res.status === 409) {
        const json = await res.json() as { error?: string }
        message = json.error ?? message
      }

      setPage({ phase: 'error', message })
    }

    validate().catch(() => {
      if (!cancelled) {
        setPage({ phase: 'error', message: 'Could not reach the server. Please check your connection and try again.' })
      }
    })

    return () => { cancelled = true }
  }, [token])

  // ── Save handler ─────────────────────────────────────────────────────────────

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!token || saveState === 'saving') return

    setSave('saving')
    setSaveError(null)

    try {
      const res = await fetch('/api/applicant/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, answers: form }),
      })

      if (res.ok) {
        setSave('saved')
      } else {
        const json = await res.json() as { error?: string }
        setSaveError(json.error ?? 'Something went wrong. Please try again.')
        setSave('error')
      }
    } catch {
      setSaveError('Could not reach the server. Please check your connection.')
      setSave('error')
    }
  }

  // ── Loading / error states ───────────────────────────────────────────────────

  if (page.phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
        <p className="text-sm">Verifying your invitation…</p>
      </div>
    )
  }

  if (page.phase === 'error') {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-base font-medium text-red-700">Unable to continue</p>
        <p className="mt-1 text-sm text-red-600">{page.message}</p>
      </div>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSave} noValidate>
      <div className="space-y-6">

        <div>
          <h1 className="text-xl font-semibold text-gray-900">Your application</h1>
          <p className="mt-1 text-sm text-gray-500">
            Please complete all required fields and save your progress.
          </p>
        </div>

        {saveState === 'saved' && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            Your application has been saved.
          </div>
        )}

        {/* ── Section 1: Personal Details ──────────────────────────────────── */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Personal Details
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="First name" required>
              <input type="text" className={inputCls} value={form.first_name}
                onChange={e => set('first_name', e.target.value)} autoComplete="given-name" />
            </Field>
            <Field label="Last name" required>
              <input type="text" className={inputCls} value={form.last_name}
                onChange={e => set('last_name', e.target.value)} autoComplete="family-name" />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Email" required>
              <input type="email" className={inputCls} value={form.email}
                onChange={e => set('email', e.target.value)} autoComplete="email" />
            </Field>
            <Field label="Phone">
              <input type="tel" className={inputCls} value={form.phone}
                onChange={e => set('phone', e.target.value)} autoComplete="tel" />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Job role">
              <input type="text" className={inputCls} value={form.job_role}
                onChange={e => set('job_role', e.target.value)} />
            </Field>
          </div>

          <Field label="Address line 1" required>
            <input type="text" className={inputCls} value={form.address_line_1}
              onChange={e => set('address_line_1', e.target.value)} autoComplete="address-line1" />
          </Field>

          <Field label="Address line 2">
            <input type="text" className={inputCls} value={form.address_line_2}
              onChange={e => set('address_line_2', e.target.value)} autoComplete="address-line2" />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Town / City" required>
              <input type="text" className={inputCls} value={form.town_city}
                onChange={e => set('town_city', e.target.value)} autoComplete="address-level2" />
            </Field>
            <Field label="Postcode" required>
              <input type="text" className={`${inputCls} uppercase`} value={form.postcode}
                onChange={e => set('postcode', e.target.value.toUpperCase())} autoComplete="postal-code" />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Date of birth" required>
              <input type="date" className={inputCls} value={form.date_of_birth}
                onChange={e => set('date_of_birth', e.target.value)} />
            </Field>
            <Field label="National Insurance number" required hint="Format: AB 12 34 56 C">
              <input
                type="text"
                className={`${inputCls} uppercase tracking-widest`}
                value={form.national_insurance}
                onChange={e => set('national_insurance', e.target.value.toUpperCase())}
                placeholder="AB 12 34 56 C"
                maxLength={13}
              />
            </Field>
          </div>
        </div>

        {/* ── Section 2: Employment History ────────────────────────────────── */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Employment History
          </h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Current or most recent employer">
              <input type="text" className={inputCls} value={form.current_employer}
                onChange={e => set('current_employer', e.target.value)} />
            </Field>
            <Field label="Job title">
              <input type="text" className={inputCls} value={form.current_job_title}
                onChange={e => set('current_job_title', e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Start date">
              <input type="date" className={inputCls} value={form.employment_start_date}
                onChange={e => set('employment_start_date', e.target.value)} />
            </Field>
            <Field label="End date" hint="Leave blank if this is your current role">
              <input type="date" className={inputCls} value={form.employment_end_date}
                onChange={e => set('employment_end_date', e.target.value)} />
            </Field>
          </div>

          <Field label="Reason for leaving">
            <textarea className={textareaCls} value={form.reason_for_leaving}
              onChange={e => set('reason_for_leaving', e.target.value)} />
          </Field>

          <Field label="Gaps in employment" hint="List any periods where you were not employed, including dates and duration">
            <textarea className={textareaCls} value={form.employment_gaps}
              onChange={e => set('employment_gaps', e.target.value)} />
          </Field>

          <Field label="Explanation of gaps" hint="Please explain the reason for any gaps listed above">
            <textarea className={textareaCls} value={form.employment_gap_explanation}
              onChange={e => set('employment_gap_explanation', e.target.value)} />
          </Field>
        </div>

        {/* ── Section 2: References ─────────────────────────────────────────── */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-6">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              References
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Please provide two professional references. References should not be family members.
            </p>
          </div>

          <ReferenceSection prefix="reference_1" title="Reference 1" form={form} set={set} />

          <div className="border-t border-gray-100" />

          <ReferenceSection prefix="reference_2" title="Reference 2" form={form} set={set} />
        </div>

        {saveState === 'error' && saveError && (
          <p className="text-sm text-red-600">{saveError}</p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saveState === 'saving'}
            className={[
              'rounded-lg px-5 py-2.5 text-sm font-medium transition-colors',
              saveState === 'saved'
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-blue-600 text-white hover:bg-blue-700',
              saveState === 'saving' ? 'opacity-60 cursor-not-allowed' : '',
            ].join(' ')}
          >
            {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved ✓' : 'Save application'}
          </button>
        </div>

      </div>
    </form>
  )
}
