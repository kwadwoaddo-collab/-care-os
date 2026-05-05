import Link from 'next/link'
import { notFound } from 'next/navigation'
import ApplicantActions from './ApplicantActions'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Applicant {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  phone: string | null
  job_role: string | null
  status: string
  created_at: string
  invited_by: string | null
}

interface FormResponse {
  id: string
  status: string
  submitted_at: string | null
  created_at: string
  updated_at: string
}

interface ApiResponse {
  applicant: Applicant
  response: FormResponse | null
  answers: Record<string, unknown>
}

// ── Data Fetching ─────────────────────────────────────────────────────────────

async function getApplicant(id: string): Promise<ApiResponse> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(`${baseUrl}/api/admin/applicants/${id}`, {
    cache: 'no-store',
  })
  if (res.status === 404) notFound()
  if (!res.ok) {
    throw new Error(`Failed to fetch applicant: ${res.status}`)
  }
  return res.json() as Promise<ApiResponse>
}

// ── Helper Components ─────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined || value === '') {
    return (
      <div>
        <dt className="text-xs font-medium text-gray-500">{label}</dt>
        <dd className="mt-0.5 text-sm text-gray-400">—</dd>
      </div>
    )
  }
  if (typeof value === 'boolean') {
    return (
      <div>
        <dt className="text-xs font-medium text-gray-500">{label}</dt>
        <dd className="mt-0.5 text-sm text-gray-900">{value ? 'Yes' : 'No'}</dd>
      </div>
    )
  }
  if (typeof value === 'object') {
    return (
      <div className="col-span-full">
        <dt className="text-xs font-medium text-gray-500 mb-1">{label}</dt>
        <dd>
          <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-xs text-gray-700 overflow-auto whitespace-pre-wrap">
            {JSON.stringify(value, null, 2)}
          </pre>
        </dd>
      </div>
    )
  }
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{String(value)}</dd>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      </div>
      <div className="p-4">
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          {children}
        </dl>
      </div>
    </div>
  )
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// ── Employment History Section ────────────────────────────────────────────────

interface EmploymentEntry {
  type?: string
  employer?: string
  jobTitle?: string
  startDate?: string
  endDate?: string | null
  current?: boolean
  reasonForLeaving?: string
  description?: string
}

function EmploymentHistory({ entries }: { entries: unknown }) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return <p className="text-sm text-gray-400">No entries recorded.</p>
  }
  return (
    <div className="space-y-4">
      {(entries as EmploymentEntry[]).map((entry, i) => (
        <div key={i} className="border border-gray-200 rounded p-3 text-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium text-gray-900">{entry.employer ?? '—'}</span>
            {entry.type && (
              <span className="text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">{entry.type}</span>
            )}
            {entry.current && (
              <span className="text-xs bg-blue-50 text-blue-700 rounded px-1.5 py-0.5">Current</span>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {entry.jobTitle && <><dt className="text-gray-500">Job Title</dt><dd className="text-gray-900">{entry.jobTitle}</dd></>}
            {entry.startDate && <><dt className="text-gray-500">Start</dt><dd className="text-gray-900">{entry.startDate}</dd></>}
            {(entry.endDate || entry.current) && <><dt className="text-gray-500">End</dt><dd className="text-gray-900">{entry.current ? 'Present' : entry.endDate}</dd></>}
            {entry.reasonForLeaving && <><dt className="text-gray-500">Reason for leaving</dt><dd className="text-gray-900">{entry.reasonForLeaving}</dd></>}
          </dl>
          {entry.description && (
            <p className="mt-2 text-xs text-gray-600">{entry.description}</p>
          )}
        </div>
      ))}
    </div>
  )
}

// ── References Section ────────────────────────────────────────────────────────

interface Reference {
  name?: string
  jobTitle?: string
  organisation?: string
  email?: string
  phone?: string
  relationship?: string
  canContact?: boolean
}

function References({ entries }: { entries: unknown }) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return <p className="text-sm text-gray-400">No references recorded.</p>
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {(entries as Reference[]).map((ref, i) => (
        <div key={i} className="border border-gray-200 rounded p-3 text-sm space-y-1">
          <p className="font-medium text-gray-900">{ref.name ?? '—'}</p>
          {ref.jobTitle && <p className="text-xs text-gray-500">{ref.jobTitle}</p>}
          {ref.organisation && <p className="text-xs text-gray-600">{ref.organisation}</p>}
          {ref.relationship && <p className="text-xs text-gray-500">Relationship: {ref.relationship}</p>}
          {ref.email && <p className="text-xs text-gray-600">{ref.email}</p>}
          {ref.phone && <p className="text-xs text-gray-600">{ref.phone}</p>}
          {ref.canContact !== undefined && (
            <p className="text-xs text-gray-500">Can contact: {ref.canContact ? 'Yes' : 'No'}</p>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Training & Qualifications Section ────────────────────────────────────────

interface TrainingItem {
  name?: string
  completed?: boolean
  completionDate?: string | null
}

interface TrainingQualifications {
  items?: TrainingItem[]
  other?: TrainingItem[]
}

function TrainingQualifications({ data }: { data: unknown }) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return <p className="text-sm text-gray-400">No training data recorded.</p>
  }
  const tq = data as TrainingQualifications
  const allItems = [
    ...(tq.items ?? []).filter((i) => i.completed || i.completionDate),
    ...(tq.other ?? []),
  ]
  if (allItems.length === 0) {
    return <p className="text-sm text-gray-400">No training items completed.</p>
  }
  return (
    <div className="space-y-1">
      {allItems.map((item, i) => (
        <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-100 last:border-0">
          <span className="text-gray-900">{item.name ?? '—'}</span>
          <span className="text-xs text-gray-500">{item.completionDate ?? (item.completed ? 'Completed' : 'Not completed')}</span>
        </div>
      ))}
    </div>
  )
}

// ── Criminal Record Section ───────────────────────────────────────────────────

interface CriminalRecord {
  hasCriminalRecord?: boolean
  details?: string
  hasDbsBarred?: boolean
  consentToDbsCheck?: boolean
  declarationAccepted?: boolean
}

function CriminalRecordSection({ data }: { data: unknown }) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return <p className="text-sm text-gray-400">No declaration recorded.</p>
  }
  const cr = data as CriminalRecord
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
      <div>
        <dt className="text-xs font-medium text-gray-500">Has criminal record</dt>
        <dd className="mt-0.5 text-gray-900">{cr.hasCriminalRecord === true ? 'Yes' : cr.hasCriminalRecord === false ? 'No' : '—'}</dd>
      </div>
      {cr.hasCriminalRecord && cr.details && (
        <div className="col-span-full">
          <dt className="text-xs font-medium text-gray-500">Details</dt>
          <dd className="mt-0.5 text-gray-900">{cr.details}</dd>
        </div>
      )}
      <div>
        <dt className="text-xs font-medium text-gray-500">On DBS barred list</dt>
        <dd className="mt-0.5 text-gray-900">{cr.hasDbsBarred === true ? 'Yes' : cr.hasDbsBarred === false ? 'No' : '—'}</dd>
      </div>
      <div>
        <dt className="text-xs font-medium text-gray-500">Consents to DBS check</dt>
        <dd className="mt-0.5 text-gray-900">{cr.consentToDbsCheck === true ? 'Yes' : cr.consentToDbsCheck === false ? 'No' : '—'}</dd>
      </div>
      <div>
        <dt className="text-xs font-medium text-gray-500">Declaration accepted</dt>
        <dd className="mt-0.5 text-gray-900">{cr.declarationAccepted === true ? 'Yes' : cr.declarationAccepted === false ? 'No' : '—'}</dd>
      </div>
    </dl>
  )
}

// ── Generic JSONB Block ───────────────────────────────────────────────────────

function JsonBlock({ data }: { data: unknown }) {
  if (data === null || data === undefined) {
    return <p className="text-sm text-gray-400">—</p>
  }
  if (typeof data !== 'object') {
    return <p className="text-sm text-gray-900">{String(data)}</p>
  }
  return (
    <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-xs text-gray-700 overflow-auto whitespace-pre-wrap">
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ApplicantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let data: ApiResponse
  try {
    data = await getApplicant(id)
  } catch (err) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
        {err instanceof Error ? err.message : 'Failed to load applicant.'}
      </div>
    )
  }

  const { applicant, response, answers } = data

  return (
    <div>
      {/* Back link */}
      <Link
        href="/admin/applicants"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4 transition-colors"
      >
        ← Back to applicants
      </Link>

      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-gray-900">
          {applicant.first_name ?? ''} {applicant.last_name ?? ''}
          {!applicant.first_name && !applicant.last_name && applicant.email}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">{applicant.email}</p>
      </div>

      {/* Action bar — status display + pipeline buttons */}
      <ApplicantActions applicantId={applicant.id} currentStatus={applicant.status} />

      <div className="space-y-4">

        {/* ── Personal Details ─────────────────────────────────────────────── */}
        <Section title="Personal Details">
          <Field label="First name"         value={answers.first_name ?? applicant.first_name} />
          <Field label="Last name"          value={answers.last_name ?? applicant.last_name} />
          <Field label="Email"              value={answers.email ?? applicant.email} />
          <Field label="Phone"              value={answers.phone ?? applicant.phone} />
          <Field label="Job role"           value={answers.job_role ?? applicant.job_role} />
          <Field label="Address line 1"     value={answers.address_line_1} />
          <Field label="Address line 2"     value={answers.address_line_2} />
          <Field label="Town / City"        value={answers.town_city} />
          <Field label="Postcode"           value={answers.postcode} />
          <Field label="Date of birth"      value={answers.date_of_birth} />
          <Field label="National Insurance" value={answers.national_insurance} />
        </Section>

        {/* ── Employment / Education History ────────────────────────────────── */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-gray-700">Employment / Education History</h2>
          </div>
          <div className="p-4">
            <EmploymentHistory entries={answers.employment_history} />
          </div>
        </div>

        {/* ── References ───────────────────────────────────────────────────── */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-gray-700">References</h2>
          </div>
          <div className="p-4">
            <References entries={answers.references} />
          </div>
        </div>

        {/* ── Right to Work ─────────────────────────────────────────────────── */}
        <Section title="Right to Work">
          <Field label="Right to work in UK"   value={answers.right_to_work_uk} />
          <Field label="Right to work type"    value={answers.right_to_work_type} />
          <Field label="Requires sponsorship"  value={answers.requires_sponsorship} />
          <Field label="Visa expiry date"      value={answers.visa_expiry_date} />
          <Field label="Share code"            value={answers.share_code} />
        </Section>

        {/* ── Criminal Record & DBS ─────────────────────────────────────────── */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-gray-700">Criminal Record & DBS Declaration</h2>
          </div>
          <div className="p-4">
            <CriminalRecordSection data={answers.criminal_record} />
          </div>
        </div>

        {/* ── Care Experience ───────────────────────────────────────────────── */}
        <Section title="Care Experience">
          <Field label="Previous care experience"  value={answers.previous_care_experience} />
          <Field label="Care experience details"   value={answers.care_experience_details} />
          <Field label="Preferred work setting"    value={answers.preferred_work_setting} />
          <Field label="Available start date"      value={answers.available_start_date} />
        </Section>

        {/* ── Training & Qualifications ─────────────────────────────────────── */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-gray-700">Training & Qualifications</h2>
          </div>
          <div className="p-4">
            <TrainingQualifications data={answers.training_qualifications} />
          </div>
        </div>

        {/* ── Professional Qualifications ───────────────────────────────────── */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-gray-700">Professional Qualifications</h2>
          </div>
          <div className="p-4">
            <JsonBlock data={answers.professional_qualifications} />
          </div>
        </div>

        {/* ── Professional Registration ─────────────────────────────────────── */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-gray-700">Professional Registration</h2>
          </div>
          <div className="p-4">
            <JsonBlock data={answers.professional_registration} />
          </div>
        </div>

        {/* ── Work Availability ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-gray-700">Work Availability</h2>
          </div>
          <div className="p-4">
            <JsonBlock data={answers.work_availability} />
          </div>
        </div>

        {/* ── Medical History ───────────────────────────────────────────────── */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-gray-700">Medical History</h2>
          </div>
          <div className="p-4">
            <JsonBlock data={answers.medical_history} />
          </div>
        </div>

        {/* ── Emergency Contact ─────────────────────────────────────────────── */}
        <Section title="Emergency Contact">
          <Field label="Full name"     value={answers.emergency_contact_name} />
          <Field label="Relationship"  value={answers.emergency_contact_relationship} />
          <Field label="Phone"         value={answers.emergency_contact_phone} />
          <Field label="Email"         value={answers.emergency_contact_email} />
        </Section>

        {/* ── Application Source ────────────────────────────────────────────── */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-gray-700">Application Source</h2>
          </div>
          <div className="p-4">
            <JsonBlock data={answers.application_source} />
          </div>
        </div>

        {/* ── Declarations & Consent ────────────────────────────────────────── */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-gray-700">Declaration & Consent</h2>
          </div>
          <div className="p-4 space-y-4">
            <JsonBlock data={answers.declaration_consent} />
            <JsonBlock data={answers.application_declarations} />
          </div>
        </div>

        {/* ── Meta ─────────────────────────────────────────────────────────── */}
        <Section title="Application Meta">
          <Field label="Applicant ID"    value={applicant.id} />
          <Field label="Applied"         value={formatDate(applicant.created_at)} />
          <Field label="Form status"     value={response?.status ?? '—'} />
          <Field label="Submitted"       value={formatDate(response?.submitted_at ?? null)} />
          <Field label="Last updated"    value={formatDate(response?.updated_at ?? null)} />
        </Section>

      </div>
    </div>
  )
}
