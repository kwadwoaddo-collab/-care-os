import Link from 'next/link'
import { notFound } from 'next/navigation'
import ApplicantActions from './ApplicantActions'
import DocumentsSection, { type Document } from './DocumentsSection'
import InterviewsSection, { type Interview } from './InterviewsSection'
import { adminFetch } from '@/lib/admin/serverFetch'

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
  const res = await adminFetch(`${baseUrl}/api/admin/applicants/${id}`, {
    cache: 'no-store',
  })
  if (res.status === 404) notFound()
  if (!res.ok) {
    throw new Error(`Failed to fetch applicant: ${res.status}`)
  }
  return res.json() as Promise<ApiResponse>
}

async function getInterviews(applicantId: string): Promise<Interview[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(
    `${baseUrl}/api/admin/interviews?applicant_id=${applicantId}`,
    { cache: 'no-store' }
  )
  if (!res.ok) return [] // Non-fatal: show empty section on error
  return res.json() as Promise<Interview[]>
}

async function getDocuments(applicantId: string): Promise<Document[]> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await fetch(
    `${baseUrl}/api/admin/documents?applicant_id=${applicantId}`,
    { cache: 'no-store' }
  )
  if (!res.ok) return [] // Non-fatal: show empty section on error
  return res.json() as Promise<Document[]>
}

// ── Helper Components ─────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined || value === '') {
    return (
      <div>
        <dt className="text-xs font-medium text-on-surface-variant">{label}</dt>
        <dd className="mt-0.5 text-sm text-gray-400">—</dd>
      </div>
    )
  }
  if (typeof value === 'boolean') {
    return (
      <div>
        <dt className="text-xs font-medium text-on-surface-variant">{label}</dt>
        <dd className="mt-0.5 text-sm text-primary">{value ? 'Yes' : 'No'}</dd>
      </div>
    )
  }
  if (typeof value === 'object') {
    return (
      <div className="col-span-full">
        <dt className="text-xs font-medium text-on-surface-variant mb-1">{label}</dt>
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
      <dt className="text-xs font-medium text-on-surface-variant">{label}</dt>
      <dd className="mt-0.5 text-sm text-primary">{String(value)}</dd>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
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
  // New CQC fields
  employer_name?: string
  employer_address?: string
  job_title?: string
  start_date?: string
  end_date?: string | null
  is_current_role?: boolean
  reason_for_leaving?: string
  main_duties?: string
  manager_contact_name?: string
  employer_phone?: string
  employer_email?: string
  permission_to_contact?: boolean
  // Legacy field support
  employer?: string
  organisation?: string
  jobTitle?: string
  role_or_course?: string
  startDate?: string
  endDate?: string | null
  current?: boolean
  reasonForLeaving?: string
  description?: string
  reference_available?: boolean
}

function EmploymentHistory({ entries }: { entries: unknown }) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return <p className="text-sm text-gray-400">No entries recorded.</p>
  }
  return (
    <div className="space-y-4">
      {(entries as EmploymentEntry[]).map((entry, i) => {
        // Normalise across new + legacy field names
        const name = entry.employer_name || entry.employer || entry.organisation || '—'
        const title = entry.job_title || entry.jobTitle || entry.role_or_course
        const start = entry.start_date || entry.startDate
        const end = entry.end_date || entry.endDate
        const isCurrent = entry.is_current_role || entry.current
        const leaving = entry.reason_for_leaving || entry.reasonForLeaving
        const duties = entry.main_duties || entry.description
        const canContact = entry.permission_to_contact ?? entry.reference_available

        return (
          <div key={i} className="border border-gray-200 rounded-lg p-4 text-sm space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-primary">{name}</span>
              {entry.type && (
                <span className="text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">{entry.type}</span>
              )}
              {isCurrent && (
                <span className="text-xs bg-blue-50 text-blue-700 rounded px-1.5 py-0.5">Current</span>
              )}
              {canContact !== undefined && (
                <span className={`text-xs rounded px-1.5 py-0.5 ${canContact ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {canContact ? 'Can contact' : 'Do not contact'}
                </span>
              )}
            </div>

            {entry.employer_address && (
              <p className="text-xs text-gray-500">{entry.employer_address}</p>
            )}

            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
              {title && <><dt className="text-on-surface-variant">Job Title</dt><dd className="text-primary">{title}</dd></>}
              {start && <><dt className="text-on-surface-variant">Start</dt><dd className="text-primary">{start}</dd></>}
              {(end || isCurrent) && <><dt className="text-on-surface-variant">End</dt><dd className="text-primary">{isCurrent ? 'Present' : end}</dd></>}
              {leaving && <><dt className="text-on-surface-variant">Reason for leaving</dt><dd className="text-primary">{leaving}</dd></>}
              {entry.manager_contact_name && <><dt className="text-on-surface-variant">Manager</dt><dd className="text-primary">{entry.manager_contact_name}</dd></>}
              {entry.employer_phone && <><dt className="text-on-surface-variant">Phone</dt><dd className="text-primary">{entry.employer_phone}</dd></>}
              {entry.employer_email && <><dt className="text-on-surface-variant">Email</dt><dd className="text-primary">{entry.employer_email}</dd></>}
            </dl>

            {duties && (
              <div className="mt-1">
                <dt className="text-xs font-medium text-on-surface-variant mb-0.5">Main duties</dt>
                <dd className="text-xs text-gray-600 whitespace-pre-line">{duties}</dd>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Employment Gap Declarations Section ───────────────────────────────────────

interface GapEntry {
  from_date?: string
  to_date?: string
  gap_reason?: string
  explanation?: string
}

function EmploymentGapDeclarations({ entries }: { entries: unknown }) {
  if (!Array.isArray(entries) || entries.length === 0) return null
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-gray-700">Employment Gap Declarations</h2>
      </div>
      <div className="p-4 space-y-3">
        {(entries as GapEntry[]).map((gap, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-3 text-sm space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 rounded px-1.5 py-0.5">{gap.gap_reason || 'Unspecified'}</span>
              <span className="text-xs text-gray-500">{[gap.from_date, gap.to_date].filter(Boolean).join(' → ')}</span>
            </div>
            {gap.explanation && <p className="text-xs text-gray-600">{gap.explanation}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Safer Recruitment Status Banner ──────────────────────────────────────────

function SaferRecruitmentStatus({ answers }: { answers: Record<string, unknown> }) {
  const history = answers.employment_history
  const gaps = answers.employment_gap_declarations
  const neverWorked = answers.has_never_worked === true || (answers.has_never_worked && typeof answers.has_never_worked === 'object' && 'text' in (answers.has_never_worked as Record<string, unknown>) && (answers.has_never_worked as Record<string, string>).text === 'true')
  const declaration = answers.employment_history_declaration === true || (answers.employment_history_declaration && typeof answers.employment_history_declaration === 'object' && 'text' in (answers.employment_history_declaration as Record<string, unknown>) && (answers.employment_history_declaration as Record<string, string>).text === 'true')

  if (neverWorked) {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 flex items-center gap-1.5">
        <span>ℹ️</span> Applicant confirmed they have never been employed
      </div>
    )
  }

  const entries = Array.isArray(history) ? history as EmploymentEntry[] : []
  const gapEntries = Array.isArray(gaps) ? gaps as GapEntry[] : []

  // Check for missing dates
  const hasMissingDates = entries.some(e => !e.start_date && !e.startDate)

  if (hasMissingDates) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 flex items-center gap-1.5">
        <span>🔴</span> Missing employment dates — review required
      </div>
    )
  }

  // Detect unexplained gaps (>31 days between entries)
  const dated = entries
    .filter(e => (e.start_date || e.startDate) && (e.end_date || e.endDate || e.is_current_role || e.current))
    .map(e => ({
      start: new Date((e.start_date || e.startDate)!),
      end: (e.is_current_role || e.current) ? new Date() : new Date((e.end_date || e.endDate)!)
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime())

  let hasUnexplainedGaps = false
  for (let i = 1; i < dated.length; i++) {
    const gapMs = dated[i].start.getTime() - dated[i - 1].end.getTime()
    if (gapMs > 31 * 24 * 60 * 60 * 1000) {
      hasUnexplainedGaps = true
      break
    }
  }

  if (hasUnexplainedGaps && gapEntries.length === 0) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 flex items-center gap-1.5">
        <span>⚠️</span> Unexplained gaps detected — no gap declarations provided
      </div>
    )
  }

  if (gapEntries.length > 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 flex items-center gap-1.5">
        <span>⚠️</span> Gaps declared ({gapEntries.length}) — requires admin review
      </div>
    )
  }

  if (declaration && entries.length > 0) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-700 flex items-center gap-1.5">
        <span>✅</span> Employment history complete — declaration signed
      </div>
    )
  }

  if (entries.length > 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600 flex items-center gap-1.5">
        <span>ℹ️</span> Employment history provided — declaration not yet signed
      </div>
    )
  }

  return null
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
          <p className="font-medium text-primary">{ref.name ?? '—'}</p>
          {ref.jobTitle && <p className="text-xs text-on-surface-variant">{ref.jobTitle}</p>}
          {ref.organisation && <p className="text-xs text-gray-600">{ref.organisation}</p>}
          {ref.relationship && <p className="text-xs text-on-surface-variant">Relationship: {ref.relationship}</p>}
          {ref.email && <p className="text-xs text-gray-600">{ref.email}</p>}
          {ref.phone && <p className="text-xs text-gray-600">{ref.phone}</p>}
          {ref.canContact !== undefined && (
            <p className="text-xs text-on-surface-variant">Can contact: {ref.canContact ? 'Yes' : 'No'}</p>
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
          <span className="text-primary">{item.name ?? '—'}</span>
          <span className="text-xs text-on-surface-variant">{item.completionDate ?? (item.completed ? 'Completed' : 'Not completed')}</span>
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
        <dt className="text-xs font-medium text-on-surface-variant">Has criminal record</dt>
        <dd className="mt-0.5 text-primary">{cr.hasCriminalRecord === true ? 'Yes' : cr.hasCriminalRecord === false ? 'No' : '—'}</dd>
      </div>
      {cr.hasCriminalRecord && cr.details && (
        <div className="col-span-full">
          <dt className="text-xs font-medium text-on-surface-variant">Details</dt>
          <dd className="mt-0.5 text-primary">{cr.details}</dd>
        </div>
      )}
      <div>
        <dt className="text-xs font-medium text-on-surface-variant">On DBS barred list</dt>
        <dd className="mt-0.5 text-primary">{cr.hasDbsBarred === true ? 'Yes' : cr.hasDbsBarred === false ? 'No' : '—'}</dd>
      </div>
      <div>
        <dt className="text-xs font-medium text-on-surface-variant">Consents to DBS check</dt>
        <dd className="mt-0.5 text-primary">{cr.consentToDbsCheck === true ? 'Yes' : cr.consentToDbsCheck === false ? 'No' : '—'}</dd>
      </div>
      <div>
        <dt className="text-xs font-medium text-on-surface-variant">Declaration accepted</dt>
        <dd className="mt-0.5 text-primary">{cr.declarationAccepted === true ? 'Yes' : cr.declarationAccepted === false ? 'No' : '—'}</dd>
      </div>
    </dl>
  )
}

// ── Helpers: check if structured data is "empty" ─────────────────────────────

function isEmptyEntry(obj: Record<string, unknown>): boolean {
  return Object.values(obj).every(v => v === '' || v === null || v === undefined || v === false)
}

function isEmptyArray(data: unknown): boolean {
  if (!Array.isArray(data) || data.length === 0) return true
  return data.every(item => typeof item === 'object' && item && isEmptyEntry(item as Record<string, unknown>))
}

// ── Professional Qualifications ───────────────────────────────────────────────

interface ProfQualification { qualification_name?: string; institution?: string; date_from?: string; date_to?: string }

function ProfessionalQualificationsSection({ data }: { data: unknown }) {
  if (isEmptyArray(data)) return null
  const items = data as ProfQualification[]
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-gray-700">Professional Qualifications</h2>
      </div>
      <div className="p-4 space-y-3">
        {items.filter(q => q.qualification_name).map((q, i) => (
          <div key={i} className="border border-gray-200 rounded p-3 text-sm">
            <p className="font-medium text-primary">{q.qualification_name}</p>
            {q.institution && <p className="text-xs text-on-surface-variant mt-0.5">{q.institution}</p>}
            {(q.date_from || q.date_to) && (
              <p className="text-xs text-gray-500 mt-1">{[q.date_from, q.date_to].filter(Boolean).join(' – ')}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Professional Registration ─────────────────────────────────────────────────

interface ProfRegistration { body_name?: string; registration_number?: string; registration_status?: string; expiry_date?: string }

function ProfessionalRegistrationSection({ data }: { data: unknown }) {
  if (isEmptyArray(data)) return null
  const items = data as ProfRegistration[]
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-gray-700">Professional Registration</h2>
      </div>
      <div className="p-4 space-y-3">
        {items.filter(r => r.body_name || r.registration_number).map((r, i) => (
          <div key={i} className="border border-gray-200 rounded p-3 text-sm">
            <p className="font-medium text-primary">{r.body_name || '—'}</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1 text-xs">
              {r.registration_number && <><dt className="text-on-surface-variant">Reg #</dt><dd className="text-primary">{r.registration_number}</dd></>}
              {r.registration_status && <><dt className="text-on-surface-variant">Status</dt><dd className="text-primary">{r.registration_status}</dd></>}
              {r.expiry_date && <><dt className="text-on-surface-variant">Expiry</dt><dd className="text-primary">{r.expiry_date}</dd></>}
            </dl>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Work Availability ─────────────────────────────────────────────────────────

interface DayAvailability { available?: boolean; notes?: string }
interface WorkAvailability { monday?: DayAvailability; tuesday?: DayAvailability; wednesday?: DayAvailability; thursday?: DayAvailability; friday?: DayAvailability; saturday?: DayAvailability; sunday?: DayAvailability; general_notes?: string }

const DAYS_ORDER = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const
const DAY_LABELS: Record<string, string> = { monday:'Mon', tuesday:'Tue', wednesday:'Wed', thursday:'Thu', friday:'Fri', saturday:'Sat', sunday:'Sun' }

function WorkAvailabilitySection({ data }: { data: unknown }) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const wa = data as WorkAvailability
  const hasAny = DAYS_ORDER.some(d => wa[d]?.available || wa[d]?.notes)
  if (!hasAny) return null
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-gray-700">Work Availability</h2>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-7 gap-2">
          {DAYS_ORDER.map(day => {
            const d = wa[day]
            const available = d?.available ?? false
            return (
              <div key={day} className={`text-center rounded-lg p-2.5 border ${available ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                <p className={`text-xs font-semibold ${available ? 'text-green-700' : 'text-gray-400'}`}>{DAY_LABELS[day]}</p>
                {d?.notes && <p className="text-[10px] text-gray-500 mt-1">{d.notes}</p>}
                {!available && !d?.notes && <p className="text-[10px] text-gray-300 mt-1">Off</p>}
              </div>
            )
          })}
        </div>
        {wa.general_notes && <p className="text-xs text-on-surface-variant mt-3">{wa.general_notes}</p>}
      </div>
    </div>
  )
}

// ── Medical History ───────────────────────────────────────────────────────────

interface MedicalHistory { has_illness_impairment_disability?: boolean; needs_assistance_to_do_job?: boolean; awaiting_treatment_or_investigation?: boolean; has_student_loan?: boolean; medical_details?: string }

function MedicalHistorySection({ data }: { data: unknown }) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const mh = data as MedicalHistory
  const allNo = !mh.has_illness_impairment_disability && !mh.needs_assistance_to_do_job && !mh.awaiting_treatment_or_investigation && !mh.medical_details
  if (allNo) return null
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-gray-700">Medical History</h2>
      </div>
      <div className="p-4">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div><dt className="text-xs font-medium text-on-surface-variant">Illness / disability</dt><dd className="mt-0.5 text-primary">{mh.has_illness_impairment_disability ? 'Yes' : 'No'}</dd></div>
          <div><dt className="text-xs font-medium text-on-surface-variant">Needs assistance</dt><dd className="mt-0.5 text-primary">{mh.needs_assistance_to_do_job ? 'Yes' : 'No'}</dd></div>
          <div><dt className="text-xs font-medium text-on-surface-variant">Awaiting treatment</dt><dd className="mt-0.5 text-primary">{mh.awaiting_treatment_or_investigation ? 'Yes' : 'No'}</dd></div>
          {mh.medical_details && <div className="col-span-full"><dt className="text-xs font-medium text-on-surface-variant">Details</dt><dd className="mt-0.5 text-primary">{mh.medical_details}</dd></div>}
        </dl>
      </div>
    </div>
  )
}

// ── Application Source ────────────────────────────────────────────────────────

interface AppSource { source?: string; other_details?: string }

function ApplicationSourceSection({ data }: { data: unknown }) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const src = data as AppSource
  if (!src.source) return null
  return (
    <Section title="Application Source">
      <Field label="Source" value={src.source} />
      {src.other_details && <Field label="Details" value={src.other_details} />}
    </Section>
  )
}

// ── Declaration & Consent ─────────────────────────────────────────────────────

function DeclarationSection({ declaration, declarations }: { declaration: unknown; declarations: unknown }) {
  if (!declaration && !declarations) return null
  const decl = (declaration && typeof declaration === 'object' && !Array.isArray(declaration)) ? declaration as Record<string, unknown> : null
  if (!decl) return null
  const sig = decl.applicant_signature as string | undefined
  const date = decl.declaration_date as string | undefined
  if (!sig && !date) return null
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-gray-700">Declaration & Consent</h2>
      </div>
      <div className="p-4">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {sig && <div><dt className="text-xs font-medium text-on-surface-variant">Signed by</dt><dd className="mt-0.5 text-primary font-medium">{sig}</dd></div>}
          {date && <div><dt className="text-xs font-medium text-on-surface-variant">Date</dt><dd className="mt-0.5 text-primary">{date}</dd></div>}
          <div><dt className="text-xs font-medium text-on-surface-variant">Information true</dt><dd className="mt-0.5 text-primary">{decl.information_true ? '✓ Yes' : 'No'}</dd></div>
          <div><dt className="text-xs font-medium text-on-surface-variant">DBS check consent</dt><dd className="mt-0.5 text-primary">{decl.consent_dbs_check ? '✓ Yes' : 'No'}</dd></div>
          <div><dt className="text-xs font-medium text-on-surface-variant">Reference checks</dt><dd className="mt-0.5 text-primary">{decl.consent_reference_checks ? '✓ Yes' : 'No'}</dd></div>
          <div><dt className="text-xs font-medium text-on-surface-variant">Data processing</dt><dd className="mt-0.5 text-primary">{decl.consent_data_processing ? '✓ Yes' : 'No'}</dd></div>
        </dl>
      </div>
    </div>
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
  const [interviews, documents] = await Promise.all([
    getInterviews(applicant.id),
    getDocuments(applicant.id),
  ])

  return (
    <div>
      {/* Back link */}
      <Link
        href="/admin/applicants"
        className="inline-flex items-center gap-1.5 text-sm text-on-surface-variant hover:text-primary mb-4 transition-colors"
      >
        ← Back to applicants
      </Link>

      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-primary">
          {applicant.first_name ?? ''} {applicant.last_name ?? ''}
          {!applicant.first_name && !applicant.last_name && applicant.email}
        </h1>
        <p className="text-sm text-on-surface-variant mt-0.5">{applicant.email}</p>
      </div>

      {/* Action bar — status display + pipeline buttons */}
      <ApplicantActions applicantId={applicant.id} currentStatus={applicant.status} />

      <div className="space-y-4">

        {/* ── Documents ─────────────────────────────────────────────────────── */}
        <DocumentsSection applicantId={applicant.id} initialDocuments={documents} />

        {/* ── Interviews ────────────────────────────────────────────────────── */}
        <InterviewsSection applicantId={applicant.id} initialInterviews={interviews} />

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

        {/* ── Safer Recruitment Status ─────────────────────────────────────── */}
        <SaferRecruitmentStatus answers={answers} />

        {/* ── Employment / Education History ────────────────────────────────── */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-gray-700">Employment History</h2>
          </div>
          <div className="p-4">
            <EmploymentHistory entries={answers.employment_history} />
          </div>
        </div>

        {/* ── Employment Gap Declarations ──────────────────────────────────── */}
        <EmploymentGapDeclarations entries={answers.employment_gap_declarations} />

        {/* ── References ───────────────────────────────────────────────────── */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
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
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
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
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-gray-700">Training & Qualifications</h2>
          </div>
          <div className="p-4">
            <TrainingQualifications data={answers.training_qualifications} />
          </div>
        </div>

        {/* ── Professional Qualifications ───────────────────────────────────── */}
        <ProfessionalQualificationsSection data={answers.professional_qualifications} />

        {/* ── Professional Registration ─────────────────────────────────────── */}
        <ProfessionalRegistrationSection data={answers.professional_registration} />

        {/* ── Work Availability ─────────────────────────────────────────────── */}
        <WorkAvailabilitySection data={answers.work_availability} />

        {/* ── Medical History ───────────────────────────────────────────────── */}
        <MedicalHistorySection data={answers.medical_history} />

        {/* ── Emergency Contact ─────────────────────────────────────────────── */}
        <Section title="Emergency Contact">
          <Field label="Full name"     value={answers.emergency_contact_name} />
          <Field label="Relationship"  value={answers.emergency_contact_relationship} />
          <Field label="Phone"         value={answers.emergency_contact_phone} />
          <Field label="Email"         value={answers.emergency_contact_email} />
        </Section>

        {/* ── Application Source ────────────────────────────────────────────── */}
        <ApplicationSourceSection data={answers.application_source} />

        {/* ── Declarations & Consent ────────────────────────────────────────── */}
        <DeclarationSection declaration={answers.declaration_consent} declarations={answers.application_declarations} />

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
