'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import SignatureCanvas from 'react-signature-canvas'
import { APPLICATION_ROLES, isSectionVisible, getRoleCategory, CATEGORY_META, type ApplicationRole, type FormSection } from '@/lib/roles'

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

// ── Employment / Education History types ─────────────────────────────────────

const HISTORY_TYPES = [
  'Employment',
  'Education',
  'Volunteering',
  'Unemployed',
  'Career Break',
  'Other',
] as const

type HistoryType = (typeof HISTORY_TYPES)[number] | ''

type EmploymentEntry = {
  type: HistoryType
  employer_name: string
  employer_address: string
  job_title: string
  start_date: string
  end_date: string
  is_current_role: boolean
  reason_for_leaving: string
  main_duties: string
  manager_contact_name: string
  employer_phone: string
  employer_email: string
  permission_to_contact: boolean
}

function makeEmptyEmployment(): EmploymentEntry {
  return {
    type: '',
    employer_name: '',
    employer_address: '',
    job_title: '',
    start_date: '',
    end_date: '',
    is_current_role: false,
    reason_for_leaving: '',
    main_duties: '',
    manager_contact_name: '',
    employer_phone: '',
    employer_email: '',
    permission_to_contact: false,
  }
}

// ── Employment Gap Declaration types ─────────────────────────────────────────

const GAP_REASONS = [
  'Unemployed',
  'Caring responsibilities',
  'Maternity or paternity leave',
  'Study or training',
  'Illness or recovery',
  'Travel',
  'Career break',
  'Volunteering',
  'Self-employment',
  'Other',
] as const

type GapReason = (typeof GAP_REASONS)[number] | ''

type EmploymentGapEntry = {
  from_date: string
  to_date: string
  gap_reason: GapReason
  explanation: string
}

function makeEmptyGap(): EmploymentGapEntry {
  return { from_date: '', to_date: '', gap_reason: '', explanation: '' }
}

/** Returns true if there is a gap of >31 days between any two consecutive date-sorted entries. */
function detectGaps(entries: EmploymentEntry[]): boolean {
  const dated = entries
    .filter(e => e.start_date && (e.end_date || e.is_current_role))
    .map(e => ({ start: new Date(e.start_date), end: e.is_current_role ? new Date() : new Date(e.end_date) }))
    .sort((a, b) => a.start.getTime() - b.start.getTime())
  for (let i = 1; i < dated.length; i++) {
    const gapMs = dated[i].start.getTime() - dated[i - 1].end.getTime()
    if (gapMs > 31 * 24 * 60 * 60 * 1000) return true
  }
  return false
}

// ── Training types ────────────────────────────────────────────────────────────

type TrainingItem = {
  name: string
  selected: boolean
  completed_date: string | null
}

type OtherTrainingItem = {
  name: string
  completed_date: string
}

type TrainingQualifications = {
  default: TrainingItem[]
  other: OtherTrainingItem[]
}

const DEFAULT_TRAINING_NAMES: string[] = [
  'Manual Handling',
  'Basic Life Support',
  'Immediate Life Support',
  'Safeguarding Children and Young People (POCA) Level 2',
  'Safeguarding Children and Young People (POCA) Level 3',
  'Protection of Vulnerable Adults (POVA)',
  'Complaints Handling',
  'COSHH',
  'Fire Safety',
  'Health & Safety',
  'RIDDOR / Risk Incident Reporting',
  'Violence & Aggression',
  'Information Governance, Data Protection & Caldicott Protocol',
  'Infection Control including Clostridium Difficile & MRSA',
  'Lone Worker Training',
]

function makeDefaultTraining(): TrainingItem[] {
  return DEFAULT_TRAINING_NAMES.map(name => ({ name, selected: false, completed_date: null }))
}

// ── Criminal Record & DBS types ─────────────────────────────────────────────

type CriminalRecord = {
  has_convictions: boolean
  conviction_details: string
  has_unfiltered_convictions: boolean
  unfiltered_details: string
  has_investigations: boolean
  investigation_details: string
  overseas_police_check: boolean
  overseas_details: string
  has_dbs: boolean
  dbs_number: string
  dbs_date: string
  dbs_organisation: string
  dbs_update_service: boolean
  dbs_update_number: string
}

function makeEmptyCriminalRecord(): CriminalRecord {
  return {
    has_convictions: false,
    conviction_details: '',
    has_unfiltered_convictions: false,
    unfiltered_details: '',
    has_investigations: false,
    investigation_details: '',
    overseas_police_check: false,
    overseas_details: '',
    has_dbs: false,
    dbs_number: '',
    dbs_date: '',
    dbs_organisation: '',
    dbs_update_service: false,
    dbs_update_number: '',
  }
}

// ── Professional Qualifications types ───────────────────────────────────────────

type ProfessionalQualification = {
  qualification_name: string
  institution: string
  date_from: string
  date_to: string
}

function makeEmptyQualification(): ProfessionalQualification {
  return { qualification_name: '', institution: '', date_from: '', date_to: '' }
}

// ── Professional Registration types ──────────────────────────────────────────

type ProfessionalRegistration = {
  body_name: string
  registration_number: string
  registration_status: string
  expiry_date: string
}

function makeEmptyRegistration(): ProfessionalRegistration {
  return { body_name: '', registration_number: '', registration_status: '', expiry_date: '' }
}

// ── Application Source types ──────────────────────────────────────────────────

const SOURCE_OPTIONS = [
  'Indeed',
  'Facebook',
  'LinkedIn',
  'Google',
  'Care OS website',
  'Friend / referral',
  'Job centre',
  'Other',
] as const

type SourceOption = (typeof SOURCE_OPTIONS)[number] | ''

type ApplicationSource = {
  source: SourceOption
  other_details: string
}

// ── Medical History types ─────────────────────────────────────────────────────

type MedicalHistory = {
  has_illness_impairment_disability: boolean
  needs_assistance_to_do_job: boolean
  awaiting_treatment_or_investigation: boolean
  has_student_loan: boolean
  medical_details: string
}

function makeEmptyMedicalHistory(): MedicalHistory {
  return {
    has_illness_impairment_disability: false,
    needs_assistance_to_do_job: false,
    awaiting_treatment_or_investigation: false,
    has_student_loan: false,
    medical_details: '',
  }
}

// ── Work Availability types ───────────────────────────────────────────────────

type DayAvailability = { available: boolean; notes: string }

type WorkAvailability = {
  monday: DayAvailability
  tuesday: DayAvailability
  wednesday: DayAvailability
  thursday: DayAvailability
  friday: DayAvailability
  saturday: DayAvailability
  sunday: DayAvailability
  general_notes: string
}

const DAYS_OF_WEEK: Array<keyof Omit<WorkAvailability, 'general_notes'>> = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
]

function makeEmptyAvailability(): WorkAvailability {
  const day: DayAvailability = { available: false, notes: '' }
  return {
    monday: { ...day }, tuesday: { ...day }, wednesday: { ...day },
    thursday: { ...day }, friday: { ...day }, saturday: { ...day }, sunday: { ...day },
    general_notes: '',
  }
}

// ── Office & Administration Experience types ──────────────────────────────────

type OfficeExperience = {
  office_software: string
  scheduling_experience: string
  customer_service: string
  administration_experience: string
  hr_payroll_systems: string
}

function makeEmptyOfficeExperience(): OfficeExperience {
  return {
    office_software: '',
    scheduling_experience: '',
    customer_service: '',
    administration_experience: '',
    hr_payroll_systems: '',
  }
}

// ── Application Declarations types ────────────────────────────────────────────

type ApplicationDeclarations = {
  charged_or_cautioned: boolean
  terms_and_conditions: boolean
  health_condition_statement: boolean
  truthful_information: boolean
  dbs_and_references_authorisation: boolean
  data_processing_and_audit: boolean
  student_visa_hours: boolean
  sponsorship_visa_limits: boolean
  travel_expenses_no_duplicate_claim: boolean
  change_of_details: boolean
  not_under_investigation: boolean
  accurate_working_history: boolean
  agency_workers_regulations: boolean
  right_to_work_home_office_check: boolean
  signature_data: string
  signed_date: string
}

function makeEmptyApplicationDeclarations(): ApplicationDeclarations {
  return {
    charged_or_cautioned: false,
    terms_and_conditions: false,
    health_condition_statement: false,
    truthful_information: false,
    dbs_and_references_authorisation: false,
    data_processing_and_audit: false,
    student_visa_hours: false,
    sponsorship_visa_limits: false,
    travel_expenses_no_duplicate_claim: false,
    change_of_details: false,
    not_under_investigation: false,
    accurate_working_history: false,
    agency_workers_regulations: false,
    right_to_work_home_office_check: false,
    signature_data: '',
    signed_date: new Date().toISOString().split('T')[0],
  }
}

// ── References types ─────────────────────────────────────────────────────────

const REFERENCE_TYPES = [
  'Professional',
  'Academic',
  'Volunteer Supervisor',
  'Character',
  'Other',
] as const

type ReferenceType = (typeof REFERENCE_TYPES)[number]

type ReferenceEntry = {
  full_name: string
  position: string
  organisation: string
  email: string
  phone: string
  relationship: string
  reference_type: ReferenceType
  is_most_recent_employer: boolean
  permission_to_contact: boolean
}

function makeEmptyReference(): ReferenceEntry {
  return {
    full_name: '',
    position: '',
    organisation: '',
    email: '',
    phone: '',
    relationship: '',
    reference_type: 'Professional',
    is_most_recent_employer: false,
    permission_to_contact: false,
  }
}

/** A reference is "complete" when full_name, relationship, and email or phone are filled. */
function isCompleteReference(r: ReferenceEntry): boolean {
  return r.full_name.trim() !== '' &&
    r.relationship.trim() !== '' &&
    (r.email.trim() !== '' || r.phone.trim() !== '')
}

// ── Declaration & Consent types ──────────────────────────────────────────────

type DeclarationConsent = {
  information_true: boolean
  understand_false_information: boolean
  consent_reference_checks: boolean
  consent_right_to_work_checks: boolean
  consent_dbs_check: boolean
  consent_data_processing: boolean
  applicant_signature: string
  declaration_date: string
}

function makeEmptyDeclaration(): DeclarationConsent {
  return {
    information_true: false,
    understand_false_information: false,
    consent_reference_checks: false,
    consent_right_to_work_checks: false,
    consent_dbs_check: false,
    consent_data_processing: false,
    applicant_signature: '',
    declaration_date: new Date().toISOString().split('T')[0],
  }
}

// ── Form value types ───────────────────────────────────────────────────────────

interface FormValues {
  // Section 1
  first_name: string; last_name: string; email: string; phone: string
  job_role: string; address_line_1: string; address_line_2: string
  town_city: string; postcode: string; date_of_birth: string; national_insurance: string
  // Section 2 — (references moved to separate state)
  // Section 3 — Right to Work
  right_to_work_uk: string; right_to_work_type: string
  requires_sponsorship: string; visa_expiry_date: string; share_code: string
  // Section 3 — Care Experience
  previous_care_experience: string; care_experience_details: string
  preferred_work_setting: string; available_start_date: string
  // Section 3 — Emergency Contact
  emergency_contact_name: string; emergency_contact_relationship: string
  emergency_contact_phone: string; emergency_contact_email: string
}

type PageState = { phase: 'loading' } | { phase: 'error'; message: string } | { phase: 'ready'; applicant: Applicant }
type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type SubmitState = 'idle' | 'submitting' | 'submitted' | 'error'

const EMPTY: FormValues = {
  first_name: '', last_name: '', email: '', phone: '', job_role: '',
  address_line_1: '', address_line_2: '', town_city: '', postcode: '',
  date_of_birth: '', national_insurance: '',

  right_to_work_uk: '', right_to_work_type: '', requires_sponsorship: '',
  visa_expiry_date: '', share_code: '',
  previous_care_experience: '', care_experience_details: '',
  preferred_work_setting: '', available_start_date: '',
  emergency_contact_name: '', emergency_contact_relationship: '',
  emergency_contact_phone: '', emergency_contact_email: '',
}

function fromApplicant(a: Applicant): FormValues {
  return { ...EMPTY, first_name: a.first_name ?? '', last_name: a.last_name ?? '',
    email: a.email ?? '', phone: a.phone ?? '', job_role: a.job_role ?? '' }
}

const inputCls =
  'block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 ' +
  'placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

const textareaCls = inputCls + ' resize-y min-h-[88px]'

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-surface-container-lowest p-6 space-y-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h2>
      {children}
    </div>
  )
}

function YesNo({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-6 mt-1">
      {['true', 'false'].map(v => (
        <label key={v} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="radio" className="accent-blue-600" checked={value === v}
            onChange={() => onChange(v)} />
          {v === 'true' ? 'Yes' : 'No'}
        </label>
      ))}
    </div>
  )
}

function CheckItem({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-start gap-3 text-sm text-gray-700 cursor-pointer">
      <input type="checkbox" className="mt-0.5 accent-blue-600"
        checked={value === 'true'} onChange={e => onChange(e.target.checked ? 'true' : 'false')} />
      <span>{label}</span>
    </label>
  )
}



export default function ApplyContent() {
  const params  = useSearchParams()
  const token   = params.get('token')
  const [page, setPage]               = useState<PageState>({ phase: 'loading' })
  const [form, setForm]               = useState<FormValues>(EMPTY)
  const [training, setTraining]       = useState<TrainingQualifications>({ default: makeDefaultTraining(), other: [] })
  const [applyingFor, setApplyingFor] = useState<ApplicationRole | ''>('')
  const [employment, setEmployment]   = useState<EmploymentEntry[]>([makeEmptyEmployment()])
  const [gapDeclarations, setGapDeclarations] = useState<EmploymentGapEntry[]>([])
  const [hasNeverWorked, setHasNeverWorked]   = useState(false)
  const [employmentHistoryDeclaration, setEmploymentHistoryDeclaration] = useState(false)
  const [references, setReferences]   = useState<ReferenceEntry[]>([makeEmptyReference(), makeEmptyReference()])
  const [criminalRecord, setCriminalRecord] = useState<CriminalRecord>(makeEmptyCriminalRecord())
  const [qualifications, setQualifications] = useState<ProfessionalQualification[]>([makeEmptyQualification()])
  const [registration, setRegistration]     = useState<ProfessionalRegistration[]>([makeEmptyRegistration()])
  const [appSource, setAppSource]           = useState<ApplicationSource>({ source: '', other_details: '' })
  const [medicalHistory, setMedicalHistory] = useState<MedicalHistory>(makeEmptyMedicalHistory())
  const [officeExperience, setOfficeExperience] = useState<OfficeExperience>(makeEmptyOfficeExperience())
  const [availability, setAvailability]     = useState<WorkAvailability>(makeEmptyAvailability())
  const [declaration, setDeclaration]       = useState<DeclarationConsent>(makeEmptyDeclaration())
  const [appDeclarations, setAppDeclarations] = useState<ApplicationDeclarations>(makeEmptyApplicationDeclarations())
  const sigRef = useRef<SignatureCanvas | null>(null)
  const [sigWarning, setSigWarning] = useState(false)
  const [saveState, setSave]          = useState<SaveState>('idle')
  const [saveError, setSaveError]     = useState<string | null>(null)
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const isSubmitted = submitState === 'submitted'

  function set(field: keyof FormValues, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    if (saveState === 'saved' || saveState === 'error') setSave('idle')
  }

  // Role-based section visibility
  function showSection(section: FormSection): boolean {
    return isSectionVisible(applyingFor || undefined, section)
  }
  const roleCategory = applyingFor ? getRoleCategory(applyingFor) : null
  const roleMeta = roleCategory ? CATEGORY_META[roleCategory] : null

  useEffect(() => {
    if (!token) {
      setPage({ phase: 'error', message: 'This link doesn\'t include an invitation code. Please use the link sent to you by your employer — check your email including your spam folder.' })
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
      if (res.status === 410) message = 'This invitation link has expired. Please contact your employer to request a new one.'
      else if (res.status === 401) message = 'This invitation link is invalid. Please use the link from your invitation email.'
      else if (res.status === 409) { const j = await res.json() as { error?: string }; message = j.error ?? message }
      setPage({ phase: 'error', message })
    }
    validate().catch(() => { if (!cancelled) setPage({ phase: 'error', message: 'Could not reach the server. Please check your connection and try again.' }) })
    return () => { cancelled = true }
  }, [token])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!token || saveState === 'saving' || isSubmitted) return
    setSave('saving'); setSaveError(null)
    try {
      const answers: Record<string, unknown> = { ...form, applying_for: applyingFor, training_qualifications: training, employment_history: employment, employment_gap_declarations: gapDeclarations, has_never_worked: hasNeverWorked, employment_history_declaration: employmentHistoryDeclaration, references, criminal_record: criminalRecord, professional_qualifications: qualifications, professional_registration: registration, office_experience: officeExperience, application_source: appSource, medical_history: medicalHistory, work_availability: availability, declaration_consent: declaration, application_declarations: appDeclarations }
      const res = await fetch('/api/applicant/apply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, answers }),
      })
      if (res.ok) { setSave('saved') }
      else { const j = await res.json() as { error?: string }; setSaveError(j.error ?? 'Something went wrong.'); setSave('error') }
    } catch { setSaveError('Could not reach the server.'); setSave('error') }
  }

  async function handleSubmit() {
    if (!token || submitState === 'submitting' || isSubmitted) return
    setSubmitState('submitting'); setSubmitError(null)
    try {
      const answers: Record<string, unknown> = { ...form, applying_for: applyingFor, training_qualifications: training, employment_history: employment, employment_gap_declarations: gapDeclarations, has_never_worked: hasNeverWorked, employment_history_declaration: employmentHistoryDeclaration, references, criminal_record: criminalRecord, professional_qualifications: qualifications, professional_registration: registration, office_experience: officeExperience, application_source: appSource, medical_history: medicalHistory, work_availability: availability, declaration_consent: declaration, application_declarations: appDeclarations }
      const res = await fetch('/api/applicant/apply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, answers, submit: true }),
      })
      if (res.ok) { setSubmitState('submitted') }
      else { const j = await res.json() as { error?: string }; setSubmitError(j.error ?? 'Something went wrong.'); setSubmitState('error') }
    } catch { setSubmitError('Could not reach the server.'); setSubmitState('error') }
  }

  if (page.phase === 'loading') return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
      <p className="text-sm">Verifying your invitation…</p>
    </div>
  )

  if (page.phase === 'error') return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
      <p className="text-2xl mb-3" aria-hidden="true">🔗</p>
      <p className="text-base font-semibold text-amber-900">Link not recognised</p>
      <p className="mt-2 text-sm text-amber-800 max-w-sm mx-auto">{page.message}</p>
      <p className="mt-4 text-xs text-amber-700">
        Need help? Contact your employer or HR team directly.
      </p>
    </div>
  )

  return (
    <form onSubmit={handleSave} noValidate>
      <fieldset disabled={isSubmitted} className="contents">
      <div className="space-y-6">

        <div>
          <h1 className="text-xl font-semibold text-gray-900">Your application</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isSubmitted ? 'Your application has been submitted. No further changes can be made.' : 'Please complete all required fields and save your progress.'}
          </p>
        </div>

        {isSubmitted && (
          <div className="rounded-lg border border-green-300 bg-green-50 px-4 py-4">
            <p className="text-sm font-semibold text-green-800">Application submitted ✓</p>
            <p className="mt-1 text-sm text-green-700">Thank you. Your application has been received. You will be contacted if further information is required.</p>
          </div>
        )}

        {!isSubmitted && saveState === 'saved' && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            Draft saved. Complete all sections and click Submit Application when ready.
          </div>
        )}

        {/* ── Role Selector ─────────────────────────────────────────────── */}
        <div className="rounded-xl border border-gray-200 bg-surface-container-lowest p-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Applying For</h2>
            <p className="mt-1 text-sm text-gray-500">Select the role you are applying for. The form will adapt to show only the sections relevant to your role.</p>
          </div>
          <Field label="Role" required>
            <select
              className={inputCls}
              value={applyingFor}
              onChange={e => {
                const role = e.target.value as ApplicationRole | ''
                setApplyingFor(role)
                set('job_role', role)
              }}
            >
              <option value="">Select a role…</option>
              {APPLICATION_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          {roleMeta && (
            <div className={`rounded-lg border ${roleMeta.border} ${roleMeta.bg} px-4 py-2.5 flex items-center gap-2`}>
              <span className={`text-xs font-semibold ${roleMeta.colour} rounded px-2 py-0.5 ${roleMeta.bg} border ${roleMeta.border}`}>{roleMeta.label}</span>
              <span className="text-xs text-gray-600">
                {roleCategory === 'care' && 'Your form includes care-specific sections such as training, qualifications, and care experience.'}
                {roleCategory === 'admin' && 'Your form includes office and administration experience sections.'}
                {roleCategory === 'operational' && 'Your form shows the core sections required for operational roles.'}
                {roleCategory === 'other' && 'All form sections are shown. Complete those relevant to your role.'}
              </span>
            </div>
          )}
        </div>

        {/* Section 1 */}
        <SectionCard title="Personal Details">
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
          {applyingFor && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Role applied for">
                <input type="text" className={inputCls + ' bg-gray-50 text-gray-500'} value={applyingFor} readOnly />
              </Field>
            </div>
          )}
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
              <input type="text" className={`${inputCls} uppercase tracking-widest`}
                value={form.national_insurance} placeholder="AB 12 34 56 C" maxLength={13}
                onChange={e => set('national_insurance', e.target.value.toUpperCase())} />
            </Field>
          </div>
        </SectionCard>

        {/* Section 2 — Employment / Education History (CQC Reg 19 compliant) */}
        <div className="rounded-xl border border-gray-200 bg-surface-container-lowest p-6 space-y-5">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Employment History</h2>
            <p className="mt-1 text-sm text-gray-500">
              Please provide your full employment history from leaving full-time education or from your first employment.
              Include all employment, education, volunteering, unemployment, or career breaks.
              There should be no unexplained gaps in your history.
            </p>
          </div>

          {/* Never worked checkbox */}
          <label className="flex items-start gap-3 text-sm text-gray-700 cursor-pointer bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
            <input
              type="checkbox"
              className="mt-0.5 accent-blue-600"
              checked={hasNeverWorked}
              onChange={e => {
                setHasNeverWorked(e.target.checked)
                if (saveState === 'saved' || saveState === 'error') setSave('idle')
              }}
            />
            <span>I have never been employed. I understand I need to provide education, training, or an explanation of how I have spent my time since leaving full-time education.</span>
          </label>

          {!hasNeverWorked && detectGaps(employment) && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              There appears to be a gap in your history. Please ensure all periods are covered, or declare gaps in the Employment Gap Declaration section below.
            </div>
          )}

          {!hasNeverWorked && employment.map((entry, i) => (
            <div key={i} className="space-y-4">
              {i > 0 && <div className="border-t border-gray-100 pt-2" />}
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">Entry {i + 1}</p>
                {employment.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setEmployment(prev => prev.filter((_, idx) => idx !== i))
                      if (saveState === 'saved' || saveState === 'error') setSave('idle')
                    }}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>

              <Field label="Type" required>
                <select
                  className={inputCls}
                  value={entry.type}
                  onChange={e => {
                    setEmployment(prev => { const next = [...prev]; next[i] = { ...next[i], type: e.target.value as HistoryType }; return next })
                    if (saveState === 'saved' || saveState === 'error') setSave('idle')
                  }}
                >
                  <option value="">Select type…</option>
                  {HISTORY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>

              <Field label="Employer / Organisation name" required>
                <input type="text" className={inputCls} value={entry.employer_name}
                  onChange={e => {
                    setEmployment(prev => { const next = [...prev]; next[i] = { ...next[i], employer_name: e.target.value }; return next })
                    if (saveState === 'saved' || saveState === 'error') setSave('idle')
                  }} />
              </Field>

              <Field label="Employer / Organisation address">
                <textarea className={textareaCls} value={entry.employer_address} rows={2}
                  onChange={e => {
                    setEmployment(prev => { const next = [...prev]; next[i] = { ...next[i], employer_address: e.target.value }; return next })
                    if (saveState === 'saved' || saveState === 'error') setSave('idle')
                  }} />
              </Field>

              <Field label="Job title / Role" hint="e.g. Care Assistant, NVQ Level 2, Support Worker">
                <input type="text" className={inputCls} value={entry.job_title}
                  onChange={e => {
                    setEmployment(prev => { const next = [...prev]; next[i] = { ...next[i], job_title: e.target.value }; return next })
                    if (saveState === 'saved' || saveState === 'error') setSave('idle')
                  }} />
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Start date" required>
                  <input type="date" className={inputCls} value={entry.start_date}
                    onChange={e => {
                      setEmployment(prev => { const next = [...prev]; next[i] = { ...next[i], start_date: e.target.value }; return next })
                      if (saveState === 'saved' || saveState === 'error') setSave('idle')
                    }} />
                </Field>
                <div>
                  <Field label="End date" hint={entry.is_current_role ? 'Not required — current role' : undefined}>
                    <input type="date" className={inputCls} value={entry.end_date}
                      disabled={entry.is_current_role}
                      onChange={e => {
                        setEmployment(prev => { const next = [...prev]; next[i] = { ...next[i], end_date: e.target.value }; return next })
                        if (saveState === 'saved' || saveState === 'error') setSave('idle')
                      }} />
                  </Field>
                  <label className="flex items-center gap-2 mt-2 text-sm text-gray-600 cursor-pointer">
                    <input type="checkbox" className="accent-blue-600"
                      checked={entry.is_current_role}
                      onChange={e => {
                        setEmployment(prev => { const next = [...prev]; next[i] = { ...next[i], is_current_role: e.target.checked, end_date: e.target.checked ? '' : next[i].end_date }; return next })
                        if (saveState === 'saved' || saveState === 'error') setSave('idle')
                      }} />
                    Currently working here
                  </label>
                </div>
              </div>

              {!entry.is_current_role && (
                <Field label="Reason for leaving">
                  <input type="text" className={inputCls} value={entry.reason_for_leaving}
                    onChange={e => {
                      setEmployment(prev => { const next = [...prev]; next[i] = { ...next[i], reason_for_leaving: e.target.value }; return next })
                      if (saveState === 'saved' || saveState === 'error') setSave('idle')
                    }} />
                </Field>
              )}

              <Field label="Main duties and responsibilities">
                <textarea className={textareaCls} value={entry.main_duties} rows={3}
                  onChange={e => {
                    setEmployment(prev => { const next = [...prev]; next[i] = { ...next[i], main_duties: e.target.value }; return next })
                    if (saveState === 'saved' || saveState === 'error') setSave('idle')
                  }} />
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Manager / Contact name">
                  <input type="text" className={inputCls} value={entry.manager_contact_name}
                    onChange={e => {
                      setEmployment(prev => { const next = [...prev]; next[i] = { ...next[i], manager_contact_name: e.target.value }; return next })
                      if (saveState === 'saved' || saveState === 'error') setSave('idle')
                    }} />
                </Field>
                <Field label="Employer phone">
                  <input type="tel" className={inputCls} value={entry.employer_phone}
                    onChange={e => {
                      setEmployment(prev => { const next = [...prev]; next[i] = { ...next[i], employer_phone: e.target.value }; return next })
                      if (saveState === 'saved' || saveState === 'error') setSave('idle')
                    }} />
                </Field>
                <Field label="Employer email">
                  <input type="email" className={inputCls} value={entry.employer_email}
                    onChange={e => {
                      setEmployment(prev => { const next = [...prev]; next[i] = { ...next[i], employer_email: e.target.value }; return next })
                      if (saveState === 'saved' || saveState === 'error') setSave('idle')
                    }} />
                </Field>
              </div>

              <Field label="May we contact this employer for a reference?" required>
                <div className="flex gap-6 mt-1">
                  {['true', 'false'].map(v => (
                    <label key={v} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="radio" className="accent-blue-600"
                        checked={String(entry.permission_to_contact) === v}
                        onChange={() => {
                          setEmployment(prev => { const next = [...prev]; next[i] = { ...next[i], permission_to_contact: v === 'true' }; return next })
                          if (saveState === 'saved' || saveState === 'error') setSave('idle')
                        }} />
                      {v === 'true' ? 'Yes' : 'No'}
                    </label>
                  ))}
                </div>
              </Field>
            </div>
          ))}

          {!hasNeverWorked && (
            <button
              type="button"
              onClick={() => {
                setEmployment(prev => [...prev, makeEmptyEmployment()])
                if (saveState === 'saved' || saveState === 'error') setSave('idle')
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              + Add employment entry
            </button>
          )}

          {hasNeverWorked && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              Since you have not been employed, please ensure you complete the Training &amp; Qualifications section with your education history, or use the Employment Gap Declaration section below to explain how you have spent your time since leaving full-time education.
            </div>
          )}
        </div>

        {/* Section 2 — Employment Gap Declaration */}
        <div className="rounded-xl border border-gray-200 bg-surface-container-lowest p-6 space-y-5">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Employment Gap Declaration</h2>
            <p className="mt-1 text-sm text-gray-500">
              Please explain any gaps in your employment, education, training, volunteering, or self-employment history.
              This helps us complete safer recruitment checks.
            </p>
          </div>

          {gapDeclarations.length === 0 && (
            <p className="text-sm text-gray-400 italic">No gaps declared. If there are no gaps in your history, you can leave this section empty.</p>
          )}

          {gapDeclarations.map((gap, i) => (
            <div key={i} className="space-y-4">
              {i > 0 && <div className="border-t border-gray-100 pt-2" />}
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">Gap {i + 1}</p>
                <button
                  type="button"
                  onClick={() => {
                    setGapDeclarations(prev => prev.filter((_, idx) => idx !== i))
                    if (saveState === 'saved' || saveState === 'error') setSave('idle')
                  }}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="From date" required>
                  <input type="date" className={inputCls} value={gap.from_date}
                    onChange={e => {
                      setGapDeclarations(prev => { const next = [...prev]; next[i] = { ...next[i], from_date: e.target.value }; return next })
                      if (saveState === 'saved' || saveState === 'error') setSave('idle')
                    }} />
                </Field>
                <Field label="To date" required>
                  <input type="date" className={inputCls} value={gap.to_date}
                    onChange={e => {
                      setGapDeclarations(prev => { const next = [...prev]; next[i] = { ...next[i], to_date: e.target.value }; return next })
                      if (saveState === 'saved' || saveState === 'error') setSave('idle')
                    }} />
                </Field>
              </div>

              <Field label="Reason for gap" required>
                <select className={inputCls} value={gap.gap_reason}
                  onChange={e => {
                    setGapDeclarations(prev => { const next = [...prev]; next[i] = { ...next[i], gap_reason: e.target.value as GapReason }; return next })
                    if (saveState === 'saved' || saveState === 'error') setSave('idle')
                  }}
                >
                  <option value="">Select reason…</option>
                  {GAP_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>

              <Field label="Brief explanation" required>
                <textarea className={textareaCls} value={gap.explanation} rows={2}
                  placeholder="Please briefly explain what you were doing during this period."
                  onChange={e => {
                    setGapDeclarations(prev => { const next = [...prev]; next[i] = { ...next[i], explanation: e.target.value }; return next })
                    if (saveState === 'saved' || saveState === 'error') setSave('idle')
                  }} />
              </Field>
            </div>
          ))}

          <button
            type="button"
            onClick={() => {
              setGapDeclarations(prev => [...prev, makeEmptyGap()])
              if (saveState === 'saved' || saveState === 'error') setSave('idle')
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            + Declare a gap
          </button>
        </div>

        {/* Section 2 — References */}
        <div className="rounded-xl border border-gray-200 bg-surface-container-lowest p-6 space-y-5">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">References</h2>
            <p className="mt-1 text-sm text-gray-500">
              Please provide at least two references. At least one should ideally be from your most recent employer, where applicable.
              References should not be family members or friends.
            </p>
          </div>

          {references.filter(isCompleteReference).length < 2 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Please provide at least two complete references (full name, relationship, and email or phone).
            </div>
          )}

          {references.map((ref, i) => (
            <div key={i} className="space-y-4">
              {i > 0 && <div className="border-t border-gray-100 pt-2" />}
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">Reference {i + 1}</p>
                {references.length > 2 && (
                  <button
                    type="button"
                    onClick={() => {
                      setReferences(prev => prev.filter((_, idx) => idx !== i))
                      if (saveState === 'saved' || saveState === 'error') setSave('idle')
                    }}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Full name" required>
                  <input type="text" className={inputCls} value={ref.full_name}
                    onChange={e => {
                      setReferences(prev => { const next = [...prev]; next[i] = { ...next[i], full_name: e.target.value }; return next })
                      if (saveState === 'saved' || saveState === 'error') setSave('idle')
                    }} />
                </Field>
                <Field label="Job title / Position">
                  <input type="text" className={inputCls} value={ref.position}
                    onChange={e => {
                      setReferences(prev => { const next = [...prev]; next[i] = { ...next[i], position: e.target.value }; return next })
                      if (saveState === 'saved' || saveState === 'error') setSave('idle')
                    }} />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Organisation">
                  <input type="text" className={inputCls} value={ref.organisation}
                    onChange={e => {
                      setReferences(prev => { const next = [...prev]; next[i] = { ...next[i], organisation: e.target.value }; return next })
                      if (saveState === 'saved' || saveState === 'error') setSave('idle')
                    }} />
                </Field>
                <Field label="Reference type">
                  <select className={inputCls} value={ref.reference_type}
                    onChange={e => {
                      setReferences(prev => { const next = [...prev]; next[i] = { ...next[i], reference_type: e.target.value as ReferenceType }; return next })
                      if (saveState === 'saved' || saveState === 'error') setSave('idle')
                    }}
                  >
                    {REFERENCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Email" required>
                  <input type="email" className={inputCls} value={ref.email}
                    onChange={e => {
                      setReferences(prev => { const next = [...prev]; next[i] = { ...next[i], email: e.target.value }; return next })
                      if (saveState === 'saved' || saveState === 'error') setSave('idle')
                    }} />
                </Field>
                <Field label="Phone">
                  <input type="tel" className={inputCls} value={ref.phone}
                    onChange={e => {
                      setReferences(prev => { const next = [...prev]; next[i] = { ...next[i], phone: e.target.value }; return next })
                      if (saveState === 'saved' || saveState === 'error') setSave('idle')
                    }} />
                </Field>
              </div>

              <Field label="Relationship to applicant" hint="e.g. Line manager, Tutor, Supervisor">
                <input type="text" className={inputCls} value={ref.relationship}
                  onChange={e => {
                    setReferences(prev => { const next = [...prev]; next[i] = { ...next[i], relationship: e.target.value }; return next })
                    if (saveState === 'saved' || saveState === 'error') setSave('idle')
                  }} />
              </Field>

              <div className="space-y-2">
                <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" className="accent-blue-600" checked={ref.is_most_recent_employer}
                    onChange={e => {
                      setReferences(prev => { const next = [...prev]; next[i] = { ...next[i], is_most_recent_employer: e.target.checked }; return next })
                      if (saveState === 'saved' || saveState === 'error') setSave('idle')
                    }} />
                  This is my most recent employer
                </label>
                <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" className="accent-blue-600" checked={ref.permission_to_contact}
                    onChange={e => {
                      setReferences(prev => { const next = [...prev]; next[i] = { ...next[i], permission_to_contact: e.target.checked }; return next })
                      if (saveState === 'saved' || saveState === 'error') setSave('idle')
                    }} />
                  I give permission to contact this reference
                </label>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => {
              setReferences(prev => [...prev, makeEmptyReference()])
              if (saveState === 'saved' || saveState === 'error') setSave('idle')
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            + Add another reference
          </button>
        </div>

        {/* Section 3 — Right to Work */}
        <SectionCard title="Right to Work">
          <Field label="Do you have the right to work in the UK?" required>
            <YesNo value={form.right_to_work_uk} onChange={v => set('right_to_work_uk', v)} />
          </Field>
          <Field label="Right to work type" hint="e.g. British Citizen, Settled Status, Visa">
            <input type="text" className={inputCls} value={form.right_to_work_type}
              onChange={e => set('right_to_work_type', e.target.value)} />
          </Field>
          <Field label="Do you require visa sponsorship?">
            <YesNo value={form.requires_sponsorship} onChange={v => set('requires_sponsorship', v)} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Visa expiry date" hint="If applicable">
              <input type="date" className={inputCls} value={form.visa_expiry_date}
                onChange={e => set('visa_expiry_date', e.target.value)} />
            </Field>
            <Field label="Share code" hint="If using the online right to work check">
              <input type="text" className={inputCls} value={form.share_code}
                onChange={e => set('share_code', e.target.value)} />
            </Field>
          </div>
        </SectionCard>

        {/* Section 3 — Criminal Record & DBS Declaration */}
        <SectionCard title="Criminal Record &amp; DBS Declaration">
          <p className="text-sm text-gray-500 leading-relaxed">
            The following questions are required for UK care recruitment compliance. All information is treated in strict confidence.
          </p>

          {/* Unspent convictions */}
          <Field label="Do you have any unspent criminal convictions?" required>
            <YesNo
              value={criminalRecord.has_convictions ? 'true' : 'false'}
              onChange={v => setCriminalRecord(prev => ({ ...prev, has_convictions: v === 'true' }))}
            />
          </Field>
          {criminalRecord.has_convictions && (
            <Field label="Please provide details of unspent convictions">
              <textarea className={textareaCls} value={criminalRecord.conviction_details}
                onChange={e => setCriminalRecord(prev => ({ ...prev, conviction_details: e.target.value }))} />
            </Field>
          )}

          {/* Unfiltered convictions */}
          <Field label="Do you have any convictions, cautions, reprimands, or final warnings that would not be filtered under the Rehabilitation of Offenders Act 1974?" required>
            <YesNo
              value={criminalRecord.has_unfiltered_convictions ? 'true' : 'false'}
              onChange={v => setCriminalRecord(prev => ({ ...prev, has_unfiltered_convictions: v === 'true' }))}
            />
          </Field>
          {criminalRecord.has_unfiltered_convictions && (
            <Field label="Please provide details">
              <textarea className={textareaCls} value={criminalRecord.unfiltered_details}
                onChange={e => setCriminalRecord(prev => ({ ...prev, unfiltered_details: e.target.value }))} />
            </Field>
          )}

          {/* Investigations */}
          <Field label="Are you currently under investigation by any regulatory body, employer, or the police?" required>
            <YesNo
              value={criminalRecord.has_investigations ? 'true' : 'false'}
              onChange={v => setCriminalRecord(prev => ({ ...prev, has_investigations: v === 'true' }))}
            />
          </Field>
          {criminalRecord.has_investigations && (
            <Field label="Please provide details of ongoing investigations">
              <textarea className={textareaCls} value={criminalRecord.investigation_details}
                onChange={e => setCriminalRecord(prev => ({ ...prev, investigation_details: e.target.value }))} />
            </Field>
          )}

          {/* Overseas police check */}
          <Field label="Have you lived or worked outside the UK for 6 months or more in the last 5 years?" required>
            <YesNo
              value={criminalRecord.overseas_police_check ? 'true' : 'false'}
              onChange={v => setCriminalRecord(prev => ({ ...prev, overseas_police_check: v === 'true' }))}
            />
          </Field>
          {criminalRecord.overseas_police_check && (
            <Field label="Please provide country/countries and relevant dates" hint="An overseas police check may be required">
              <textarea className={textareaCls} value={criminalRecord.overseas_details}
                onChange={e => setCriminalRecord(prev => ({ ...prev, overseas_details: e.target.value }))} />
            </Field>
          )}

          {/* DBS certificate */}
          <Field label="Do you hold a current DBS certificate?">
            <YesNo
              value={criminalRecord.has_dbs ? 'true' : 'false'}
              onChange={v => setCriminalRecord(prev => ({ ...prev, has_dbs: v === 'true' }))}
            />
          </Field>
          {criminalRecord.has_dbs && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="DBS certificate number">
                  <input type="text" className={inputCls} value={criminalRecord.dbs_number}
                    onChange={e => setCriminalRecord(prev => ({ ...prev, dbs_number: e.target.value }))} />
                </Field>
                <Field label="DBS issue date">
                  <input type="date" className={inputCls} value={criminalRecord.dbs_date}
                    onChange={e => setCriminalRecord(prev => ({ ...prev, dbs_date: e.target.value }))} />
                </Field>
              </div>
              <Field label="Issuing organisation">
                <input type="text" className={inputCls} value={criminalRecord.dbs_organisation}
                  onChange={e => setCriminalRecord(prev => ({ ...prev, dbs_organisation: e.target.value }))} />
              </Field>
            </>
          )}

          {/* DBS Update Service */}
          <Field label="Are you registered with the DBS Update Service?">
            <YesNo
              value={criminalRecord.dbs_update_service ? 'true' : 'false'}
              onChange={v => setCriminalRecord(prev => ({ ...prev, dbs_update_service: v === 'true' }))}
            />
          </Field>
          {criminalRecord.dbs_update_service && (
            <Field label="DBS Update Service subscription number">
              <input type="text" className={inputCls} value={criminalRecord.dbs_update_number}
                onChange={e => setCriminalRecord(prev => ({ ...prev, dbs_update_number: e.target.value }))} />
            </Field>
          )}
        </SectionCard>

        {/* Section 3 — Care Experience (care roles only) */}
        {showSection('care_experience') && (
        <SectionCard title="Care Experience">
          <Field label="Do you have previous care experience?">
            <YesNo value={form.previous_care_experience} onChange={v => set('previous_care_experience', v)} />
          </Field>
          {form.previous_care_experience === 'true' && (
            <Field label="Please describe your care experience">
              <textarea className={textareaCls} value={form.care_experience_details}
                onChange={e => set('care_experience_details', e.target.value)} />
            </Field>
          )}
          <Field label="Preferred work setting" hint="e.g. Residential care, Domiciliary, Supported living">
            <input type="text" className={inputCls} value={form.preferred_work_setting}
              onChange={e => set('preferred_work_setting', e.target.value)} />
          </Field>
          <Field label="Available start date">
            <input type="date" className={inputCls} value={form.available_start_date}
              onChange={e => set('available_start_date', e.target.value)} />
          </Field>
        </SectionCard>
        )}

        {/* Section 3 — Training (care roles only) */}
        {showSection('training_qualifications') && (
        <div className="rounded-xl border border-gray-200 bg-surface-container-lowest p-6 space-y-5">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Training &amp; Qualifications</h2>
            <p className="mt-1 text-sm text-gray-500">Please tick all training you have completed and provide the completion date.</p>
          </div>

          <div className="space-y-3">
            {training.default.map((item, i) => (
              <div key={item.name}>
                <label className="flex items-start gap-3 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-blue-600"
                    checked={item.selected}
                    onChange={e => {
                      setTraining(prev => {
                        const next = [...prev.default]
                        next[i] = { ...next[i], selected: e.target.checked, completed_date: e.target.checked ? next[i].completed_date : null }
                        return { ...prev, default: next }
                      })
                      if (saveState === 'saved' || saveState === 'error') setSave('idle')
                    }}
                  />
                  <span>{item.name}</span>
                </label>
                {item.selected && (
                  <div className="ml-7 mt-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Date completed</label>
                    <input
                      type="date"
                      className={inputCls + ' max-w-[200px]'}
                      value={item.completed_date ?? ''}
                      onChange={e => {
                        setTraining(prev => {
                          const next = [...prev.default]
                          next[i] = { ...next[i], completed_date: e.target.value || null }
                          return { ...prev, default: next }
                        })
                        if (saveState === 'saved' || saveState === 'error') setSave('idle')
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Other training */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">Other training or qualifications</p>

            {training.other.map((item, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="flex-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="Training / qualification name"
                    value={item.name}
                    onChange={e => {
                      setTraining(prev => {
                        const next = [...prev.other]
                        next[i] = { ...next[i], name: e.target.value }
                        return { ...prev, other: next }
                      })
                      if (saveState === 'saved' || saveState === 'error') setSave('idle')
                    }}
                  />
                  <input
                    type="date"
                    className={inputCls}
                    value={item.completed_date}
                    onChange={e => {
                      setTraining(prev => {
                        const next = [...prev.other]
                        next[i] = { ...next[i], completed_date: e.target.value }
                        return { ...prev, other: next }
                      })
                      if (saveState === 'saved' || saveState === 'error') setSave('idle')
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTraining(prev => ({ ...prev, other: prev.other.filter((_, idx) => idx !== i) }))
                    if (saveState === 'saved' || saveState === 'error') setSave('idle')
                  }}
                  className="mt-1 text-xs text-red-500 hover:text-red-700 whitespace-nowrap"
                >
                  Remove
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => {
                setTraining(prev => ({ ...prev, other: [...prev.other, { name: '', completed_date: '' }] }))
                if (saveState === 'saved' || saveState === 'error') setSave('idle')
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              + Add other training
            </button>
          </div>
        </div>
        )}

        {/* Section — Professional Qualifications (care roles only) */}
        {showSection('professional_qualifications') && (
        <div className="rounded-xl border border-gray-200 bg-surface-container-lowest p-6 space-y-5">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Professional Qualifications</h2>
            <p className="mt-1 text-sm text-gray-500">
              List all professional qualifications and formal courses undertaken.
            </p>
          </div>

          {qualifications.map((entry, i) => (
            <div key={i} className="space-y-4">
              {i > 0 && <div className="border-t border-gray-100 pt-2" />}
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">Qualification {i + 1}</p>
                {qualifications.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setQualifications(prev => prev.filter((_, idx) => idx !== i))
                      if (saveState === 'saved' || saveState === 'error') setSave('idle')
                    }}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Qualification name">
                  <input
                    type="text"
                    className={inputCls}
                    value={entry.qualification_name}
                    onChange={e => {
                      setQualifications(prev => { const next = [...prev]; next[i] = { ...next[i], qualification_name: e.target.value }; return next })
                      if (saveState === 'saved' || saveState === 'error') setSave('idle')
                    }}
                  />
                </Field>
                <Field label="Institution / awarding body">
                  <input
                    type="text"
                    className={inputCls}
                    value={entry.institution}
                    onChange={e => {
                      setQualifications(prev => { const next = [...prev]; next[i] = { ...next[i], institution: e.target.value }; return next })
                      if (saveState === 'saved' || saveState === 'error') setSave('idle')
                    }}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Date from">
                  <input
                    type="date"
                    className={inputCls}
                    value={entry.date_from}
                    onChange={e => {
                      setQualifications(prev => { const next = [...prev]; next[i] = { ...next[i], date_from: e.target.value }; return next })
                      if (saveState === 'saved' || saveState === 'error') setSave('idle')
                    }}
                  />
                </Field>
                <Field label="Date to" hint="Leave blank if ongoing">
                  <input
                    type="date"
                    className={inputCls}
                    value={entry.date_to}
                    onChange={e => {
                      setQualifications(prev => { const next = [...prev]; next[i] = { ...next[i], date_to: e.target.value }; return next })
                      if (saveState === 'saved' || saveState === 'error') setSave('idle')
                    }}
                  />
                </Field>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => {
              setQualifications(prev => [...prev, makeEmptyQualification()])
              if (saveState === 'saved' || saveState === 'error') setSave('idle')
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            + Add qualification
          </button>
        </div>
        )}


        {/* Section — Professional Registration (care roles only) */}
        {showSection('professional_registration') && (
        <div className="rounded-xl border border-gray-200 bg-surface-container-lowest p-6 space-y-5">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Professional Registration</h2>
            <p className="mt-1 text-sm text-gray-500">List any professional bodies you are registered with.</p>
          </div>

          {registration.map((entry, i) => (
            <div key={i} className="space-y-4">
              {i > 0 && <div className="border-t border-gray-100 pt-2" />}
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">Registration {i + 1}</p>
                {registration.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setRegistration(prev => prev.filter((_, idx) => idx !== i))
                      if (saveState === 'saved' || saveState === 'error') setSave('idle')
                    }}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Professional body name">
                  <input type="text" className={inputCls} value={entry.body_name}
                    onChange={e => {
                      setRegistration(prev => { const next = [...prev]; next[i] = { ...next[i], body_name: e.target.value }; return next })
                      if (saveState === 'saved' || saveState === 'error') setSave('idle')
                    }} />
                </Field>
                <Field label="Registration number">
                  <input type="text" className={inputCls} value={entry.registration_number}
                    onChange={e => {
                      setRegistration(prev => { const next = [...prev]; next[i] = { ...next[i], registration_number: e.target.value }; return next })
                      if (saveState === 'saved' || saveState === 'error') setSave('idle')
                    }} />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Registration status" hint="e.g. Active, Lapsed, Suspended">
                  <input type="text" className={inputCls} value={entry.registration_status}
                    onChange={e => {
                      setRegistration(prev => { const next = [...prev]; next[i] = { ...next[i], registration_status: e.target.value }; return next })
                      if (saveState === 'saved' || saveState === 'error') setSave('idle')
                    }} />
                </Field>
                <Field label="Expiry date" hint="If applicable">
                  <input type="date" className={inputCls} value={entry.expiry_date}
                    onChange={e => {
                      setRegistration(prev => { const next = [...prev]; next[i] = { ...next[i], expiry_date: e.target.value }; return next })
                      if (saveState === 'saved' || saveState === 'error') setSave('idle')
                    }} />
                </Field>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => {
              setRegistration(prev => [...prev, makeEmptyRegistration()])
              if (saveState === 'saved' || saveState === 'error') setSave('idle')
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            + Add professional registration
          </button>
        </div>
        )}

        {/* Section — Office & Administration Experience (admin roles only) */}
        {showSection('office_experience') && (
        <SectionCard title="Office & Administration Experience">
          <Field label="Office software experience" hint="e.g. Microsoft Office, Google Workspace, CRM systems">
            <textarea className={textareaCls} value={officeExperience.office_software}
              onChange={e => {
                setOfficeExperience(prev => ({ ...prev, office_software: e.target.value }))
                if (saveState === 'saved' || saveState === 'error') setSave('idle')
              }} />
          </Field>
          <Field label="Scheduling / rostering experience" hint="e.g. care planning software, rota management">
            <textarea className={textareaCls} value={officeExperience.scheduling_experience}
              onChange={e => {
                setOfficeExperience(prev => ({ ...prev, scheduling_experience: e.target.value }))
                if (saveState === 'saved' || saveState === 'error') setSave('idle')
              }} />
          </Field>
          <Field label="Customer service experience">
            <textarea className={textareaCls} value={officeExperience.customer_service}
              onChange={e => {
                setOfficeExperience(prev => ({ ...prev, customer_service: e.target.value }))
                if (saveState === 'saved' || saveState === 'error') setSave('idle')
              }} />
          </Field>
          <Field label="Administration experience" hint="e.g. filing, data entry, minute-taking">
            <textarea className={textareaCls} value={officeExperience.administration_experience}
              onChange={e => {
                setOfficeExperience(prev => ({ ...prev, administration_experience: e.target.value }))
                if (saveState === 'saved' || saveState === 'error') setSave('idle')
              }} />
          </Field>
          <Field label="HR, payroll, or compliance systems" hint="e.g. SAGE, Xero, BrightHR, Moorepay">
            <textarea className={textareaCls} value={officeExperience.hr_payroll_systems}
              onChange={e => {
                setOfficeExperience(prev => ({ ...prev, hr_payroll_systems: e.target.value }))
                if (saveState === 'saved' || saveState === 'error') setSave('idle')
              }} />
          </Field>
        </SectionCard>
        )}

        {/* Section 3 — Emergency Contact */}
        <SectionCard title="Emergency Contact">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Full name" required>
              <input type="text" className={inputCls} value={form.emergency_contact_name}
                onChange={e => set('emergency_contact_name', e.target.value)} />
            </Field>
            <Field label="Relationship to you">
              <input type="text" className={inputCls} value={form.emergency_contact_relationship}
                onChange={e => set('emergency_contact_relationship', e.target.value)}
                placeholder="e.g. Partner, Parent, Sibling" />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Phone number" required>
              <input type="tel" className={inputCls} value={form.emergency_contact_phone}
                onChange={e => set('emergency_contact_phone', e.target.value)} />
            </Field>
            <Field label="Email address">
              <input type="email" className={inputCls} value={form.emergency_contact_email}
                onChange={e => set('emergency_contact_email', e.target.value)} />
            </Field>
          </div>
        </SectionCard>

        {/* Section — Source */}
        <SectionCard title="Source">
          <Field label="Where did you hear about us?">
            <select
              className={inputCls}
              value={appSource.source}
              onChange={e => {
                setAppSource(prev => ({ ...prev, source: e.target.value as SourceOption, other_details: e.target.value !== 'Other' ? '' : prev.other_details }))
                if (saveState === 'saved' || saveState === 'error') setSave('idle')
              }}
            >
              <option value="">Select&hellip;</option>
              {SOURCE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </Field>
          {appSource.source === 'Other' && (
            <Field label="Other, please specify">
              <input type="text" className={inputCls} value={appSource.other_details}
                onChange={e => {
                  setAppSource(prev => ({ ...prev, other_details: e.target.value }))
                  if (saveState === 'saved' || saveState === 'error') setSave('idle')
                }} />
            </Field>
          )}
        </SectionCard>

        {/* Section — Medical History */}
        <SectionCard title="Medical History">
          <p className="text-sm text-gray-500">Your answers are treated confidentially and assessed only in relation to your ability to carry out the role.</p>

          <Field label="Do you have any illness, impairment, or disability that may affect your work?" required>
            <YesNo
              value={medicalHistory.has_illness_impairment_disability ? 'true' : 'false'}
              onChange={v => {
                setMedicalHistory(prev => ({ ...prev, has_illness_impairment_disability: v === 'true' }))
                if (saveState === 'saved' || saveState === 'error') setSave('idle')
              }}
            />
          </Field>

          <Field label="Do you need any assistance or adjustments to do this job?" required>
            <YesNo
              value={medicalHistory.needs_assistance_to_do_job ? 'true' : 'false'}
              onChange={v => {
                setMedicalHistory(prev => ({ ...prev, needs_assistance_to_do_job: v === 'true' }))
                if (saveState === 'saved' || saveState === 'error') setSave('idle')
              }}
            />
          </Field>

          <Field label="Are you currently awaiting treatment or investigation for a medical condition?" required>
            <YesNo
              value={medicalHistory.awaiting_treatment_or_investigation ? 'true' : 'false'}
              onChange={v => {
                setMedicalHistory(prev => ({ ...prev, awaiting_treatment_or_investigation: v === 'true' }))
                if (saveState === 'saved' || saveState === 'error') setSave('idle')
              }}
            />
          </Field>

          <Field label="Do you have a student loan?" required>
            <YesNo
              value={medicalHistory.has_student_loan ? 'true' : 'false'}
              onChange={v => {
                setMedicalHistory(prev => ({ ...prev, has_student_loan: v === 'true' }))
                if (saveState === 'saved' || saveState === 'error') setSave('idle')
              }}
            />
          </Field>

          {(medicalHistory.has_illness_impairment_disability ||
            medicalHistory.needs_assistance_to_do_job ||
            medicalHistory.awaiting_treatment_or_investigation ||
            medicalHistory.has_student_loan) && (
            <Field label="Please provide relevant details">
              <textarea
                className={textareaCls}
                value={medicalHistory.medical_details}
                onChange={e => {
                  setMedicalHistory(prev => ({ ...prev, medical_details: e.target.value }))
                  if (saveState === 'saved' || saveState === 'error') setSave('idle')
                }}
              />
            </Field>
          )}
        </SectionCard>

        {/* Section — Work Availability */}
        <SectionCard title="Work Availability">
          <p className="text-sm text-gray-500">Please indicate the days you are available to work and any relevant notes (e.g. hours, shifts).</p>

          <div className="space-y-3">
            {DAYS_OF_WEEK.map(day => (
              <div key={day}>
                <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-blue-600"
                    checked={availability[day].available}
                    onChange={e => {
                      setAvailability(prev => ({ ...prev, [day]: { ...prev[day], available: e.target.checked } }))
                      if (saveState === 'saved' || saveState === 'error') setSave('idle')
                    }}
                  />
                  {day.charAt(0).toUpperCase() + day.slice(1)}
                </label>
                {availability[day].available && (
                  <div className="ml-7 mt-2">
                    <input
                      type="text"
                      className={inputCls + ' max-w-sm'}
                      placeholder="Available hours or notes (e.g. 9am – 5pm)"
                      value={availability[day].notes}
                      onChange={e => {
                        setAvailability(prev => ({ ...prev, [day]: { ...prev[day], notes: e.target.value } }))
                        if (saveState === 'saved' || saveState === 'error') setSave('idle')
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <Field label="General availability notes" hint="Optional — e.g. preferred shift patterns, restrictions">
            <textarea
              className={textareaCls}
              value={availability.general_notes}
              onChange={e => {
                setAvailability(prev => ({ ...prev, general_notes: e.target.value }))
                if (saveState === 'saved' || saveState === 'error') setSave('idle')
              }}
            />
          </Field>
        </SectionCard>

        {/* Section — Declaration & Consent */}
        <SectionCard title="Declaration &amp; Consent">
          <p className="text-sm text-gray-600 leading-relaxed">
            Please read each statement carefully and tick to confirm your agreement. This declaration forms part of your application.
          </p>

          {/* Warning if any consent unchecked */}
          {(
            !declaration.information_true ||
            !declaration.understand_false_information ||
            !declaration.consent_reference_checks ||
            !declaration.consent_right_to_work_checks ||
            !declaration.consent_dbs_check ||
            !declaration.consent_data_processing
          ) && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Please tick all declarations and consents before submitting your application.
            </div>
          )}

          <div className="space-y-4">
            <label className="flex items-start gap-3 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 accent-blue-600 shrink-0"
                checked={declaration.information_true}
                onChange={e => setDeclaration(prev => ({ ...prev, information_true: e.target.checked }))}
              />
              <span>I confirm that the information I have provided is true and complete to the best of my knowledge.</span>
            </label>

            <label className="flex items-start gap-3 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 accent-blue-600 shrink-0"
                checked={declaration.understand_false_information}
                onChange={e => setDeclaration(prev => ({ ...prev, understand_false_information: e.target.checked }))}
              />
              <span>I understand that providing false or misleading information may result in my application being withdrawn or my employment being terminated.</span>
            </label>

            <label className="flex items-start gap-3 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 accent-blue-600 shrink-0"
                checked={declaration.consent_reference_checks}
                onChange={e => setDeclaration(prev => ({ ...prev, consent_reference_checks: e.target.checked }))}
              />
              <span>I consent to Care Supreme Ltd contacting my referees as part of the recruitment process.</span>
            </label>

            <label className="flex items-start gap-3 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 accent-blue-600 shrink-0"
                checked={declaration.consent_right_to_work_checks}
                onChange={e => setDeclaration(prev => ({ ...prev, consent_right_to_work_checks: e.target.checked }))}
              />
              <span>I consent to Care Supreme Ltd carrying out right to work checks.</span>
            </label>

            <label className="flex items-start gap-3 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 accent-blue-600 shrink-0"
                checked={declaration.consent_dbs_check}
                onChange={e => setDeclaration(prev => ({ ...prev, consent_dbs_check: e.target.checked }))}
              />
              <span>I consent to Care Supreme Ltd carrying out an Enhanced DBS check where required for the role.</span>
            </label>

            <label className="flex items-start gap-3 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 accent-blue-600 shrink-0"
                checked={declaration.consent_data_processing}
                onChange={e => setDeclaration(prev => ({ ...prev, consent_data_processing: e.target.checked }))}
              />
              <span>I consent to Care Supreme Ltd processing my personal data for recruitment, onboarding, safer recruitment, and compliance purposes.</span>
            </label>
          </div>

          {/* Employment History Declaration — CQC Reg 19 */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 space-y-3">
            <label className="flex items-start gap-3 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 accent-blue-600 shrink-0"
                checked={employmentHistoryDeclaration}
                onChange={e => {
                  setEmploymentHistoryDeclaration(e.target.checked)
                  if (saveState === 'saved' || saveState === 'error') setSave('idle')
                }}
              />
              <span className="font-medium">I confirm that I have provided my full employment history and explained all gaps. I understand that incomplete or false information may affect my application.</span>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
            <Field label="Applicant full name as signature" required>
              <input
                type="text"
                className={inputCls}
                value={declaration.applicant_signature}
                onChange={e => setDeclaration(prev => ({ ...prev, applicant_signature: e.target.value }))}
                placeholder="Type your full name to sign"
              />
            </Field>
            <Field label="Declaration date" required>
              <input
                type="date"
                className={inputCls}
                value={declaration.declaration_date}
                onChange={e => setDeclaration(prev => ({ ...prev, declaration_date: e.target.value }))}
              />
            </Field>
          </div>
        </SectionCard>

        {/* Section — Declarations */}
        <SectionCard title="Declarations">
          <p className="text-sm text-gray-600 leading-relaxed">
            Please read each declaration carefully and tick to confirm. These declarations form a legally binding part of your application to Care Supreme.
          </p>

          {Object.values({
            charged_or_cautioned: appDeclarations.charged_or_cautioned,
            terms_and_conditions: appDeclarations.terms_and_conditions,
            health_condition_statement: appDeclarations.health_condition_statement,
            truthful_information: appDeclarations.truthful_information,
            dbs_and_references_authorisation: appDeclarations.dbs_and_references_authorisation,
            data_processing_and_audit: appDeclarations.data_processing_and_audit,
            student_visa_hours: appDeclarations.student_visa_hours,
            sponsorship_visa_limits: appDeclarations.sponsorship_visa_limits,
            travel_expenses_no_duplicate_claim: appDeclarations.travel_expenses_no_duplicate_claim,
            change_of_details: appDeclarations.change_of_details,
            not_under_investigation: appDeclarations.not_under_investigation,
            accurate_working_history: appDeclarations.accurate_working_history,
            agency_workers_regulations: appDeclarations.agency_workers_regulations,
            right_to_work_home_office_check: appDeclarations.right_to_work_home_office_check,
          }).some(v => !v) && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Please tick all declarations before submitting your application.
            </div>
          )}

          <div className="space-y-4">
            {([
              ['charged_or_cautioned',              'I understand that if I am charged or cautioned after signing this declaration, I must inform Care Supreme.'],
              ['terms_and_conditions',              'I acknowledge that I have been given a copy of the Terms and Conditions of Service issued by Care Supreme, which is mine to keep, and that I have read those Terms and Conditions and agree to abide by them.'],
              ['health_condition_statement',        'I am not aware of any condition, medical or otherwise, which would affect or limit my employment or performance, other than those declared in my Occupational Health Questionnaire.'],
              ['truthful_information',              'I declare that the information given in this application is true and complete and is not presented in a way intended to mislead. I understand that false or misleading information, or failure to provide relevant information now or in the future, may result in Care Supreme ceasing to offer me further agency placements without notice and may lead to recovery of payments or losses.'],
              ['dbs_and_references_authorisation', 'I authorise Care Supreme to apply for and obtain a Disclosure and Barring Service Check, including online status update checks where applicable, and references from previous employers and educational establishments.'],
              ['data_processing_and_audit',        'I acknowledge that my personal details will be stored and handled by Care Supreme in accordance with the Data Protection Act 2018 and may be made available for audit or review by relevant third parties, including documents such as DBS, occupational health and references.'],
              ['student_visa_hours',               'I understand that if I am on a student visa, I can only work for 20 hours per week during term time and I am responsible for monitoring this. If my student status changes, I must inform Care Supreme.'],
              ['sponsorship_visa_limits',          'I understand that if I am on a Tier 2 or Skilled Worker sponsorship visa, I can only work within the limits allowed by my visa conditions and must inform Care Supreme if my sponsored employment changes.'],
              ['travel_expenses_no_duplicate_claim','I understand that if travel expenses are pre-authorised outside of the Care Supreme Privilege Payments scheme, I cannot make a duplicate claim under the scheme.'],
              ['change_of_details',               'I acknowledge that if any details in this application change, or if my circumstances change in a way that may affect my ability to work for Care Supreme, I must inform Care Supreme immediately.'],
              ['not_under_investigation',          'I confirm that I am not currently under investigation or suspended by my professional regulatory body or by my current or previous employer. I will inform Care Supreme if this changes at any point.'],
              ['accurate_working_history',         'I confirm that when asked about my working history, including for Agency Workers Regulations purposes, I will provide accurate information.'],
              ['agency_workers_regulations',       'I acknowledge that should I reach the 12-week qualifying period under the Agency Workers Regulations, I may be asked to provide further documentation as evidence of qualifying weeks.'],
              ['right_to_work_home_office_check',  'I give permission for Care Supreme to run a Right to Work check with the Home Office if I provide a Biometric Residence Card or other relevant immigration documentation.'],
            ] as [keyof ApplicationDeclarations, string][]).map(([key, label]) => (
              <label key={key} className="flex items-start gap-3 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-blue-600 shrink-0"
                  checked={appDeclarations[key] as boolean}
                  onChange={e => {
                    setAppDeclarations(prev => ({ ...prev, [key]: e.target.checked }))
                    if (saveState === 'saved' || saveState === 'error') setSave('idle')
                  }}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2">
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Signature <span className="text-red-500">*</span></p>
              <div className="border border-gray-300 rounded-lg bg-surface-container-lowest overflow-hidden">
                <SignatureCanvas
                  ref={sigRef}
                  penColor="black"
                  canvasProps={{ className: 'w-full h-40' }}
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    sigRef.current?.clear()
                    setAppDeclarations(prev => ({ ...prev, signature_data: '' }))
                    setSigWarning(false)
                    if (saveState === 'saved' || saveState === 'error') setSave('idle')
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (sigRef.current && !sigRef.current.isEmpty()) {
                      const dataUrl = sigRef.current.getTrimmedCanvas().toDataURL('image/png')
                      setAppDeclarations(prev => ({ ...prev, signature_data: dataUrl }))
                      setSigWarning(false)
                      if (saveState === 'saved' || saveState === 'error') setSave('idle')
                    } else {
                      setSigWarning(true)
                    }
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Save Signature
                </button>
                {appDeclarations.signature_data && (
                  <span className="text-xs text-green-600">✓ Captured</span>
                )}
              </div>
              {sigWarning && (
                <p className="text-xs text-amber-600">Please draw your signature before saving.</p>
              )}
              {!appDeclarations.signature_data && !sigWarning && (
                <p className="text-xs text-gray-400">Draw your signature in the box above, then click Save Signature.</p>
              )}
            </div>
            <Field label="Date signed" required>
              <input
                type="date"
                className={inputCls}
                value={appDeclarations.signed_date}
                onChange={e => {
                  setAppDeclarations(prev => ({ ...prev, signed_date: e.target.value }))
                  if (saveState === 'saved' || saveState === 'error') setSave('idle')
                }}
              />
            </Field>
          </div>
        </SectionCard>

        {saveState === 'error' && saveError && (
          <p className="text-sm text-red-600">{saveError}</p>
        )}
        {submitState === 'error' && submitError && (
          <p className="text-sm text-red-600">{submitError}</p>
        )}

        {!isSubmitted && (
          <div className="flex items-center justify-end gap-3">
            <button
              type="submit"
              disabled={saveState === 'saving'}
              className={[
                'rounded-lg px-5 py-2.5 text-sm font-medium transition-colors border',
                saveState === 'saved'
                  ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
                  : 'border-gray-300 bg-surface-container-lowest text-gray-700 hover:bg-gray-50',
                saveState === 'saving' ? 'opacity-60 cursor-not-allowed' : '',
              ].join(' ')}
            >
              {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Draft saved ✓' : 'Save draft'}
            </button>

            <button
              type="button"
              disabled={submitState === 'submitting'}
              onClick={handleSubmit}
              className={[
                'rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors',
                submitState === 'submitting' ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700',
              ].join(' ')}
            >
              {submitState === 'submitting' ? 'Submitting…' : 'Submit application'}
            </button>
          </div>
        )}

      </div>
      </fieldset>
    </form>
  )
}
