import Link from 'next/link'
import { notFound } from 'next/navigation'
import ApplicantActions from './ApplicantActions'
import DocumentsSection, { type Document } from './DocumentsSection'
import InterviewsSection, { type Interview } from './InterviewsSection'
import { adminFetch } from '@/lib/admin/serverFetch'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/rbac/permissions'
import { getRoleCategory, getRequiredDocuments, getComplianceTemplate, CATEGORY_META, isSectionVisible, type ApplicationRole, type FormSection } from '@/lib/roles'

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
  rejected_at: string | null
  rejection_reason: string | null
  rejection_notes: string | null
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
import { 
  Field, Section, formatDate, EmploymentHistory, EmploymentGapDeclarations, 
  SaferRecruitmentStatus, References, TrainingQualifications, CriminalRecordSection, 
  RoleComplianceStatus, OfficeExperienceSection, ProfessionalQualificationsSection, 
  ProfessionalRegistrationSection, WorkAvailabilitySection, MedicalHistorySection, 
  ApplicationSourceSection, DeclarationSection 
} from '@/components/admin/ApplicationFormShared'
// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ApplicantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const auth = await requireAdmin()
  const canRestore = auth.ok && can(auth.ctx.role, 'applicants:update')

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
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-primary">
            {applicant.first_name ?? ''} {applicant.last_name ?? ''}
            {!applicant.first_name && !applicant.last_name && applicant.email}
          </h1>
          {(() => {
            const role = (answers.applying_for || answers.job_role) as string | undefined
            if (!role) return null
            const cat = getRoleCategory(role)
            const m = CATEGORY_META[cat]
            return <span className={`text-xs font-semibold rounded px-2 py-0.5 ${m.colour} ${m.bg} border ${m.border}`}>{role}</span>
          })()}
        </div>
        <p className="text-sm text-on-surface-variant mt-0.5">{applicant.email}</p>
      </div>

      {/* Rejection banner */}
      {applicant.status === 'rejected' && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex flex-wrap items-start gap-3">
          <span className="material-symbols-outlined text-red-500 text-lg leading-none mt-0.5">cancel</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-800">This applicant has been rejected</p>
            {applicant.rejected_at && (
              <p className="text-xs text-red-600 mt-0.5">
                Rejected on {formatDate(applicant.rejected_at)}
              </p>
            )}
            {applicant.rejection_reason && (
              <p className="text-xs text-red-700 mt-1">
                <span className="font-medium">Reason:</span> {applicant.rejection_reason}
              </p>
            )}
            {!canRestore && (
              <p className="text-xs text-red-600 mt-1 italic">Read-only — contact an admin to restore this applicant.</p>
            )}
          </div>
        </div>
      )}

      {/* Action bar — status display + pipeline buttons */}
      <ApplicantActions
        applicantId={applicant.id}
        currentStatus={applicant.status}
        rejectedAt={applicant.rejected_at}
        rejectionReason={applicant.rejection_reason}
        rejectionNotes={applicant.rejection_notes}
        canRestore={canRestore}
      />

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
          <Field label="Job role"           value={answers.applying_for ?? answers.job_role ?? applicant.job_role} />
          <Field label="Address line 1"     value={answers.address_line_1} />
          <Field label="Address line 2"     value={answers.address_line_2} />
          <Field label="Town / City"        value={answers.town_city} />
          <Field label="Postcode"           value={answers.postcode} />
          <Field label="Date of birth"      value={answers.date_of_birth} />
          <Field label="National Insurance" value={answers.national_insurance} />
        </Section>

        {/* ── Role & Compliance ─────────────────────────────────────────── */}
        <RoleComplianceStatus answers={answers} documents={documents} />

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
        {isSectionVisible((answers.applying_for ?? answers.job_role) as string | undefined, 'care_experience') && (
        <Section title="Care Experience">
          <Field label="Previous care experience"  value={answers.previous_care_experience} />
          <Field label="Care experience details"   value={answers.care_experience_details} />
          <Field label="Preferred work setting"    value={answers.preferred_work_setting} />
          <Field label="Available start date"      value={answers.available_start_date} />
        </Section>
        )}

        {/* ── Training & Qualifications ─────────────────────────────────────── */}
        {isSectionVisible((answers.applying_for ?? answers.job_role) as string | undefined, 'training_qualifications') && (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-gray-700">Training & Qualifications</h2>
          </div>
          <div className="p-4">
            <TrainingQualifications data={answers.training_qualifications} />
          </div>
        </div>
        )}

        {/* ── Professional Qualifications ───────────────────────────────────── */}
        {isSectionVisible((answers.applying_for ?? answers.job_role) as string | undefined, 'professional_qualifications') && (
        <ProfessionalQualificationsSection data={answers.professional_qualifications} />
        )}

        {/* ── Professional Registration ─────────────────────────────────────── */}
        {isSectionVisible((answers.applying_for ?? answers.job_role) as string | undefined, 'professional_registration') && (
        <ProfessionalRegistrationSection data={answers.professional_registration} />
        )}

        {/* ── Office & Administration Experience ────────────────────────────── */}
        {isSectionVisible((answers.applying_for ?? answers.job_role) as string | undefined, 'office_experience') && (
        <OfficeExperienceSection data={answers.office_experience} />
        )}

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
