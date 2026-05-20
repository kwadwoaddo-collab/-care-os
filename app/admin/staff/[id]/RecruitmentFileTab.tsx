import React from 'react'
import Link from 'next/link'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import {
  Field, Section, formatDate, EmploymentHistory, EmploymentGapDeclarations,
  SaferRecruitmentStatus, References, TrainingQualifications, CriminalRecordSection,
  RoleComplianceStatus, OfficeExperienceSection, ProfessionalQualificationsSection,
  ProfessionalRegistrationSection, WorkAvailabilitySection, MedicalHistorySection,
  ApplicationSourceSection, DeclarationSection
} from '@/components/admin/ApplicationFormShared'
import DocumentComplianceHub from './DocumentComplianceHub'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ApplicantDocument {
  id: string
  document_type: string
  file_name: string
  file_path: string | null
  file_size: number | null
  mime_type: string | null
  expiry_date: string | null
  issue_date: string | null
  created_at: string
  reviewed_status: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  staff_profile_id: string | null
  applicant_id: string | null
  signed_url: string | null
}

interface StaffDocument {
  id: string
  applicant_id?: string | null
  file_name: string
  file_path: string | null
  file_url?: string | null
  document_type: string
  expiry_date?: string | null
  created_at: string
  reviewed_status?: string | null
}

interface Interview {
  id: string
  scheduled_at: string | null
  interview_type: string | null
  status: string | null
  outcome?: string | null
  score: number | null
  recommendation: string | null
  notes: string | null
  created_at: string
}

interface RecruitmentFileTabProps {
  staffProfileId: string
  applicantId: string
  documents: StaffDocument[]
  convertedAt?: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SIGNED_URL_EXPIRY = 3600 // 1 hour

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Main Component ────────────────────────────────────────────────────────────

export default async function RecruitmentFileTab({ staffProfileId, applicantId, documents, convertedAt }: RecruitmentFileTabProps) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">Unauthorized</div>
  }
  const { companyId } = auth.ctx

  // ── 1. Fetch applicant record ──────────────────────────────────────────────
  const { data: applicant, error: applicantError } = await adminClient
    .from('applicants')
    .select('*')
    .eq('id', applicantId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (applicantError || !applicant) {
    return (
      <div className="rounded-md bg-gray-50 border border-gray-200 p-6 text-center text-sm text-gray-500 mt-6">
        No linked recruitment file found for this staff member.
      </div>
    )
  }

  // ── 2. Fetch form response + answers ───────────────────────────────────────
  const { data: response } = await adminClient
    .from('form_responses')
    .select('id, status, submitted_at, created_at, updated_at')
    .eq('applicant_id', applicantId)
    .maybeSingle()

  const answers: Record<string, unknown> = {}
  if (response) {
    const { data: rawAnswers } = await adminClient
      .from('form_answers')
      .select('value, form_fields ( slug, label, field_type, sort_order )')
      .eq('response_id', response.id)

    type RawAnswer = {
      value: Record<string, unknown> | null
      form_fields: { slug: string } | null
    }

    for (const row of (rawAnswers ?? []) as unknown as RawAnswer[]) {
      const field = row.form_fields
      if (!field?.slug) continue
      const val = row.value
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        if ('text' in val) {
          answers[field.slug] = val.text
        } else if ('checked' in val) {
          answers[field.slug] = val.checked
        } else {
          answers[field.slug] = val
        }
      } else {
        answers[field.slug] = val
      }
    }
  }

  // ── 3. Fetch interviews ────────────────────────────────────────────────────
  const { data: interviewsRaw } = await adminClient
    .from('interviews')
    .select('*')
    .eq('applicant_id', applicantId)
    .eq('company_id', companyId)
    .order('scheduled_at', { ascending: false })

  const interviews = (interviewsRaw ?? []) as Interview[]

  // ── 4. Fetch applicant-stage documents (directly from DB with signed URLs) ──
  // These are ANY documents where applicant_id = applicantId — includes docs
  // uploaded during the applicant flow that later got staff_profile_id set
  // during conversion. They are the definitive "recruitment file" uploads.
  const { data: rawApplicantDocs } = await adminClient
    .from('documents')
    .select(
      'id, document_type, file_name, file_path, file_size, mime_type, expiry_date, issue_date, created_at, reviewed_status, reviewed_at, reviewed_by, staff_profile_id, applicant_id'
    )
    .eq('applicant_id', applicantId)
    .order('created_at', { ascending: false })

  // ── 5. Fetch audit trail for conversion events ──────────────────────────────
  const { data: auditLogs } = await adminClient
    .from('audit_logs')
    .select('id, action, actor_id, metadata, created_at')
    .or(`entity_id.eq.${applicantId},entity_id.eq.${staffProfileId}`)
    .in('action', [
      'applicant.converted_to_staff',
      'staff.created',
      'applicant.status_changed',
      'staff.profile_updated',
      'document.approved',
      'document.rejected',
    ])
    .order('created_at', { ascending: false })
    .limit(20)

  // Generate signed URLs using the correct storage bucket
  const applicantDocs: ApplicantDocument[] = await Promise.all(
    (rawApplicantDocs ?? []).map(async (doc) => {
      let signed_url: string | null = null
      if (doc.file_path) {
        const { data } = await adminClient.storage
          .from('care-os-documents')
          .createSignedUrl(doc.file_path as string, SIGNED_URL_EXPIRY)
        signed_url = data?.signedUrl ?? null
      }
      return { ...(doc as unknown as ApplicantDocument), signed_url }
    })
  )

  // ── 6. Staff-stage documents (uploaded post-conversion; no applicant_id) ───
  // These are documents uploaded after the applicant became staff; they have
  // staff_profile_id but applicant_id = NULL.
  const staffOnlyDocs = documents.filter((d) => !d.applicant_id)

  // Generate signed URLs for staff-stage docs
  const staffDocsWithUrls = await Promise.all(
    staffOnlyDocs.map(async (doc) => {
      if (doc.file_path) {
        const { data } = await adminClient.storage
          .from('care-os-documents')
          .createSignedUrl(doc.file_path, SIGNED_URL_EXPIRY)
        return { ...doc, file_url: data?.signedUrl ?? null }
      }
      return { ...doc, file_url: null }
    })
  )

  return (
    <div className="space-y-6 mt-6">
      {/* ── Converted Notice ─────────────────────────────────────────────── */}
      <div className="bg-surface-container-lowest rounded-xl border border-blue-200 shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-800">
            <span className="material-symbols-outlined text-[20px]">info</span>
            <span className="text-sm font-medium">Converted from Applicant</span>
          </div>
          <Link
            href={`/admin/applicants/${applicantId}`}
            className="text-xs font-medium text-blue-700 hover:text-blue-900 underline underline-offset-2"
          >
            View original record
          </Link>
        </div>
        <div className="p-4 bg-surface-container-lowest grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-gray-700">
          <div>
            <p className="text-xs font-medium text-gray-500 mb-0.5">Converted</p>
            <p className="font-semibold text-gray-900">{formatDate(convertedAt ?? applicant?.created_at ?? null)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-0.5">Applied</p>
            <p className="text-gray-900">{formatDate(applicant?.created_at ?? null)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-0.5">Role applied for</p>
            <p className="text-gray-900">{applicant?.job_role ?? '—'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── Left column: Form data ─────────────────────────────────────── */}
        <div className="xl:col-span-2 space-y-6">
          <SaferRecruitmentStatus answers={answers} />

          <Section title="Personal Details">
            <Field label="First Name" value={answers.first_name} />
            <Field label="Last Name" value={answers.last_name} />
            <Field label="Email" value={answers.email} />
            <Field label="Phone" value={answers.phone} />
            <Field label="NI Number" value={answers.ni_number} />
            <Field label="Date of Birth" value={answers.date_of_birth} />
          </Section>

          <Section title="Address">
            <Field label="Line 1" value={answers.address_line_1} />
            <Field label="Line 2" value={answers.address_line_2} />
            <Field label="City" value={answers.city} />
            <Field label="County" value={answers.county} />
            <Field label="Postcode" value={answers.postcode} />
            <Field label="Time at address" value={answers.time_at_address} />
          </Section>

          <Section title="Right to Work & Documentation">
            <Field label="Has Right to Work" value={answers.has_right_to_work} />
            <Field label="Right to Work Status" value={answers.right_to_work_status} />
            <Field label="Share Code" value={answers.share_code} />
            <Field label="Passport Name" value={answers.passport_name} />
            <Field label="Passport Number" value={answers.passport_number} />
          </Section>

          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
              <h2 className="text-sm font-semibold text-gray-700">Employment History</h2>
            </div>
            <div className="p-4">
              <EmploymentHistory entries={answers.employment_history} />
            </div>
          </div>

          <EmploymentGapDeclarations entries={answers.employment_gap_declarations} />

          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
              <h2 className="text-sm font-semibold text-gray-700">References</h2>
            </div>
            <div className="p-4">
              <References entries={answers.references} />
            </div>
          </div>

          <CriminalRecordSection data={answers.criminal_record} />
          <MedicalHistorySection data={answers.medical_history} />
          <OfficeExperienceSection data={answers.office_experience} />
          <ProfessionalQualificationsSection data={answers.professional_qualifications} />
          <ProfessionalRegistrationSection data={answers.professional_registration} />
          <WorkAvailabilitySection data={answers.work_availability} />
          <DeclarationSection declaration={answers.declaration} declarations={answers.declarations} />
        </div>

        {/* ── Right column: Document Compliance Hub + Interviews ────────── */}
        <div className="xl:col-span-1 space-y-6">

          {/* ════════════════════════════════════════════════════════════════
              UNIFIED DOCUMENT COMPLIANCE HUB
              All documents — applicant-stage and staff-stage — in one place,
              grouped by document type for CQC audit readiness.
              ════════════════════════════════════════════════════════════════ */}
          <DocumentComplianceHub
            staffProfileId={staffProfileId}
            applicantDocs={applicantDocs}
            staffDocs={staffDocsWithUrls}
          />

          {/* ── Interview Records ─────────────────────────────────────────── */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-700">Interview Records</h2>
            </div>
            <div className="p-4">
              {interviews.length === 0 ? (
                <p className="text-sm text-gray-500">No interviews recorded.</p>
              ) : (
                <div className="space-y-4">
                  {interviews.map((inv) => (
                    <div key={inv.id} className="border border-gray-200 rounded-lg p-3 space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-primary">{inv.interview_type || 'Interview'}</span>
                        <span className="text-xs text-gray-500">{fmt(inv.scheduled_at)}</span>
                      </div>
                      {(inv.status || inv.outcome) && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-on-surface-variant font-medium">Outcome:</span>
                          <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 capitalize">
                            {inv.outcome || inv.status}
                          </span>
                        </div>
                      )}
                      {inv.notes && (
                        <div>
                          <p className="text-xs font-medium text-on-surface-variant mb-1">Notes</p>
                          <p className="text-xs text-gray-600 whitespace-pre-line bg-gray-50 p-2 rounded border border-gray-100">
                            {inv.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Role & Compliance Summary ─────────────────────────────────── */}
          <RoleComplianceStatus answers={answers} documents={[]} />

          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
              <h2 className="text-sm font-semibold text-gray-700">Training & Qualifications</h2>
            </div>
            <div className="p-4">
              <TrainingQualifications data={answers.training_qualifications} />
            </div>
          </div>

          {/* ── Recruitment Audit Trail ───────────────────────────────────── */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5 flex items-center gap-2">
              <span className="material-symbols-outlined text-gray-500 text-[16px]">history</span>
              <h2 className="text-sm font-semibold text-gray-700">Audit Trail</h2>
            </div>
            <div className="p-4">
              {!auditLogs || auditLogs.length === 0 ? (
                <p className="text-sm text-gray-400">No audit events recorded.</p>
              ) : (
                <ol className="relative border-l border-gray-200 space-y-4 ml-2">
                  {(auditLogs as Array<{ id: string; action: string; actor_id: string | null; metadata: Record<string, unknown> | null; created_at: string }>).map((log) => {
                    const ACTION_META: Record<string, { label: string; icon: string; cls: string }> = {
                      'applicant.converted_to_staff': { label: 'Converted to staff',   icon: 'check_circle', cls: 'text-green-600' },
                      'staff.created':                { label: 'Staff profile created', icon: 'person_add',   cls: 'text-blue-600' },
                      'applicant.status_changed':     { label: 'Status changed',        icon: 'update',       cls: 'text-yellow-600' },
                      'staff.profile_updated':        { label: 'Profile updated',       icon: 'edit',         cls: 'text-gray-500' },
                      'document.approved':            { label: 'Document approved',     icon: 'verified',     cls: 'text-green-600' },
                      'document.rejected':            { label: 'Document rejected',     icon: 'cancel',       cls: 'text-red-600' },
                    }
                    const meta = ACTION_META[log.action] ?? { label: log.action.replace(/\./g, ' '), icon: 'info', cls: 'text-gray-500' }
                    const mappedFields = (
                      log.metadata && typeof log.metadata === 'object' && 'fields_mapped' in log.metadata && Array.isArray(log.metadata.fields_mapped)
                        ? (log.metadata.fields_mapped as string[])
                        : []
                    )
                    return (
                      <li key={log.id} className="ml-4">
                        <div className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full border-2 border-white bg-gray-300" />
                        <div className="flex items-start gap-2">
                          <span className={`material-symbols-outlined text-[14px] mt-0.5 shrink-0 ${meta.cls}`}>{meta.icon}</span>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-primary">{meta.label}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">{fmt(log.created_at)}</p>
                            {mappedFields.length > 0 && (
                              <p className="text-[11px] text-gray-500 mt-0.5">Fields: {mappedFields.join(', ')}</p>
                            )}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
