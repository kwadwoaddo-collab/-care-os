import React from 'react'
import { getRoleCategory, getRequiredDocuments, getComplianceTemplate, CATEGORY_META } from '@/lib/roles'
import type { Document } from '@/app/admin/applicants/[id]/DocumentsSection'

// ── Helper Components ─────────────────────────────────────────────────────────

export function Field({ label, value }: { label: string; value: unknown }) {
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

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
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

export function formatDate(iso: string | null): string {
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

export function EmploymentHistory({ entries }: { entries: unknown }) {
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

export function EmploymentGapDeclarations({ entries }: { entries: unknown }) {
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

export function SaferRecruitmentStatus({ answers }: { answers: Record<string, unknown> }) {
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
  // New field names
  full_name?: string
  position?: string
  organisation?: string
  email?: string
  phone?: string
  relationship?: string
  reference_type?: string
  is_most_recent_employer?: boolean
  permission_to_contact?: boolean
  // Legacy field names
  name?: string
  jobTitle?: string
  canContact?: boolean
}

export function References({ entries }: { entries: unknown }) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return <p className="text-sm text-gray-400">No references recorded.</p>
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {(entries as Reference[]).map((ref, i) => {
        const name = ref.full_name || ref.name || '—'
        const title = ref.position || ref.jobTitle
        const canContact = ref.permission_to_contact ?? ref.canContact
        return (
          <div key={i} className="border border-gray-200 rounded p-3 text-sm space-y-1">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-primary">{name}</p>
              {ref.reference_type && (
                <span className="text-[10px] bg-gray-100 text-gray-600 rounded px-1.5 py-0.5 whitespace-nowrap">{ref.reference_type}</span>
              )}
            </div>
            {title && <p className="text-xs text-on-surface-variant">{title}</p>}
            {ref.organisation && <p className="text-xs text-gray-600">{ref.organisation}</p>}
            {ref.relationship && <p className="text-xs text-on-surface-variant">Relationship: {ref.relationship}</p>}
            {ref.email && <p className="text-xs text-gray-600">{ref.email}</p>}
            {ref.phone && <p className="text-xs text-gray-600">{ref.phone}</p>}
            <div className="flex items-center gap-2 flex-wrap pt-0.5">
              {ref.is_most_recent_employer && (
                <span className="text-[10px] bg-blue-50 text-blue-700 rounded px-1.5 py-0.5">Most recent employer</span>
              )}
              {canContact !== undefined && (
                <span className={`text-[10px] rounded px-1.5 py-0.5 ${canContact ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {canContact ? 'Can contact' : 'Do not contact'}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Training & Qualifications Section ────────────────────────────────────────

interface TrainingItemNew {
  name?: string
  selected?: boolean
  completed_date?: string | null
  // legacy
  completed?: boolean
  completionDate?: string | null
}

interface TrainingQualificationsData {
  // new schema
  default?: TrainingItemNew[]
  other?: TrainingItemNew[]
  // legacy schema
  items?: TrainingItemNew[]
}

export function TrainingQualifications({ data }: { data: unknown }) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return <p className="text-sm text-gray-400">No training data recorded.</p>
  }
  const tq = data as TrainingQualificationsData
  const defaultItems = (tq.default ?? tq.items ?? []).filter(
    (i) => i.selected || i.completed || i.completed_date || i.completionDate
  )
  const otherItems = (tq.other ?? [])
  const allItems = [...defaultItems, ...otherItems]
  if (allItems.length === 0) {
    return <p className="text-sm text-gray-400">No training items completed.</p>
  }
  return (
    <div className="space-y-1">
      {allItems.map((item, i) => (
        <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-100 last:border-0">
          <span className="text-primary">{item.name ?? '—'}</span>
          <span className="text-xs text-on-surface-variant">
            {item.completed_date || item.completionDate || (item.selected || item.completed ? 'Completed' : 'Not completed')}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Criminal Record Section ───────────────────────────────────────────────────

interface CriminalRecord {
  // New detailed fields
  has_convictions?: boolean
  conviction_details?: string
  has_unfiltered_convictions?: boolean
  unfiltered_details?: string
  has_investigations?: boolean
  investigation_details?: string
  overseas_police_check?: boolean
  overseas_details?: string
  has_dbs?: boolean
  dbs_number?: string
  dbs_date?: string
  dbs_organisation?: string
  dbs_update_service?: boolean
  dbs_update_number?: string
  // Legacy fields
  hasCriminalRecord?: boolean
  details?: string
  hasDbsBarred?: boolean
  consentToDbsCheck?: boolean
  declarationAccepted?: boolean
}

export function CriminalRecordSection({ data }: { data: unknown }) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return <p className="text-sm text-gray-400">No declaration recorded.</p>
  }
  const cr = data as CriminalRecord

  // New detailed schema
  if (cr.has_convictions !== undefined || cr.has_dbs !== undefined) {
    return (
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div><dt className="text-xs font-medium text-on-surface-variant">Unspent convictions</dt><dd className="mt-0.5 text-primary">{cr.has_convictions ? 'Yes' : 'No'}</dd></div>
        {cr.has_convictions && cr.conviction_details && (
          <div className="col-span-full"><dt className="text-xs font-medium text-on-surface-variant">Conviction details</dt><dd className="mt-0.5 text-primary">{cr.conviction_details}</dd></div>
        )}
        <div><dt className="text-xs font-medium text-on-surface-variant">Unfiltered convictions</dt><dd className="mt-0.5 text-primary">{cr.has_unfiltered_convictions ? 'Yes' : 'No'}</dd></div>
        <div><dt className="text-xs font-medium text-on-surface-variant">Under investigation</dt><dd className="mt-0.5 text-primary">{cr.has_investigations ? 'Yes' : 'No'}</dd></div>
        {cr.has_investigations && cr.investigation_details && (
          <div className="col-span-full"><dt className="text-xs font-medium text-on-surface-variant">Investigation details</dt><dd className="mt-0.5 text-primary">{cr.investigation_details}</dd></div>
        )}
        <div><dt className="text-xs font-medium text-on-surface-variant">Overseas police check required</dt><dd className="mt-0.5 text-primary">{cr.overseas_police_check ? 'Yes' : 'No'}</dd></div>
        {cr.overseas_police_check && cr.overseas_details && (
          <div className="col-span-full"><dt className="text-xs font-medium text-on-surface-variant">Overseas details</dt><dd className="mt-0.5 text-primary">{cr.overseas_details}</dd></div>
        )}
        <div><dt className="text-xs font-medium text-on-surface-variant">Holds current DBS</dt><dd className="mt-0.5 text-primary">{cr.has_dbs ? 'Yes' : 'No'}</dd></div>
        {cr.has_dbs && (
          <>
            {cr.dbs_number && <div><dt className="text-xs font-medium text-on-surface-variant">DBS number</dt><dd className="mt-0.5 text-primary">{cr.dbs_number}</dd></div>}
            {cr.dbs_date && <div><dt className="text-xs font-medium text-on-surface-variant">DBS issue date</dt><dd className="mt-0.5 text-primary">{cr.dbs_date}</dd></div>}
            {cr.dbs_organisation && <div className="col-span-full"><dt className="text-xs font-medium text-on-surface-variant">Issuing organisation</dt><dd className="mt-0.5 text-primary">{cr.dbs_organisation}</dd></div>}
          </>
        )}
        <div><dt className="text-xs font-medium text-on-surface-variant">DBS Update Service</dt><dd className="mt-0.5 text-primary">{cr.dbs_update_service ? 'Yes' : 'No'}</dd></div>
        {cr.dbs_update_service && cr.dbs_update_number && (
          <div><dt className="text-xs font-medium text-on-surface-variant">Update Service number</dt><dd className="mt-0.5 text-primary">{cr.dbs_update_number}</dd></div>
        )}
      </dl>
    )
  }

  // Legacy schema fallback
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

// ── Role Compliance Status ────────────────────────────────────────────────

export function RoleComplianceStatus({ answers, documents }: { answers: Record<string, unknown>; documents: Document[] }) {
  const role = (answers.applying_for || answers.job_role) as string | undefined
  if (!role) return null
  const category = getRoleCategory(role)
  const meta = CATEGORY_META[category]
  const template = getComplianceTemplate(role)
  const requiredDocs = getRequiredDocuments(role)
  const uploadedTypes = documents.map(d => (d.document_type ?? '').toLowerCase())

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center gap-3">
        <h2 className="text-sm font-semibold text-gray-700">Role & Compliance</h2>
        <span className={`text-xs font-semibold rounded px-2 py-0.5 ${meta.colour} ${meta.bg} border ${meta.border}`}>
          {meta.label} — {role}
        </span>
      </div>
      <div className="p-4 space-y-4">
        {/* Compliance template */}
        <div>
          <p className="text-xs font-medium text-on-surface-variant mb-2">{template.name}</p>
          <ul className="space-y-1">
            {template.items.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-primary">
                <span className="text-gray-400 mt-0.5">◦</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        {/* Required documents checklist */}
        <div>
          <p className="text-xs font-medium text-on-surface-variant mb-2">Required Documents</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {requiredDocs.map((doc, i) => {
              const found = uploadedTypes.some(t => t.includes(doc.toLowerCase().split(' ')[0]))
              return (
                <div key={i} className={`flex items-center gap-2 text-sm rounded px-2 py-1 ${found ? 'text-green-700 bg-green-50' : 'text-amber-700 bg-amber-50'}`}>
                  <span>{found ? '✓' : '○'}</span>
                  {doc}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Office Experience Section ─────────────────────────────────────────────

interface OfficeExperience { office_software?: string; scheduling_experience?: string; customer_service?: string; administration_experience?: string; hr_payroll_systems?: string }

export function OfficeExperienceSection({ data }: { data: unknown }) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const oe = data as OfficeExperience
  const hasContent = oe.office_software || oe.scheduling_experience || oe.customer_service || oe.administration_experience || oe.hr_payroll_systems
  if (!hasContent) return null
  const items: [string, string | undefined][] = [
    ['Office Software', oe.office_software],
    ['Scheduling / Rostering', oe.scheduling_experience],
    ['Customer Service', oe.customer_service],
    ['Administration', oe.administration_experience],
    ['HR / Payroll / Compliance', oe.hr_payroll_systems],
  ]
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-gray-700">Office & Administration Experience</h2>
      </div>
      <div className="p-4">
        <dl className="space-y-3">
          {items.filter(([, v]) => v).map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs font-medium text-on-surface-variant">{label}</dt>
              <dd className="mt-0.5 text-sm text-primary">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

// ── Helpers: check if structured data is "empty" ─────────────────────────────

export function isEmptyEntry(obj: Record<string, unknown>): boolean {
  return Object.values(obj).every(v => v === '' || v === null || v === undefined || v === false)
}

export function isEmptyArray(data: unknown): boolean {
  if (!Array.isArray(data) || data.length === 0) return true
  return data.every(item => typeof item === 'object' && item && isEmptyEntry(item as Record<string, unknown>))
}

// ── Professional Qualifications ───────────────────────────────────────────────

interface ProfQualification { qualification_name?: string; institution?: string; date_from?: string; date_to?: string }

export function ProfessionalQualificationsSection({ data }: { data: unknown }) {
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

export function ProfessionalRegistrationSection({ data }: { data: unknown }) {
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

export function WorkAvailabilitySection({ data }: { data: unknown }) {
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

export function MedicalHistorySection({ data }: { data: unknown }) {
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

export function ApplicationSourceSection({ data }: { data: unknown }) {
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

export function DeclarationSection({ declaration, declarations }: { declaration: unknown; declarations: unknown }) {
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

