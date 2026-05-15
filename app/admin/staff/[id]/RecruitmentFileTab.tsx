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
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SIGNED_URL_EXPIRY = 3600 // 1 hour

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fileSize(bytes: number | null | undefined): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function docTypeLabel(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function ReviewBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null
  const cls: Record<string, string> = {
    approved:   'bg-green-50 text-green-700 ring-green-600/20',
    rejected:   'bg-red-50 text-red-700 ring-red-600/20',
    pending:    'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
    under_review: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  }
  const base = cls[status] ?? 'bg-gray-50 text-gray-600 ring-gray-400/20'
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide ring-1 ring-inset uppercase ${base}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default async function RecruitmentFileTab({ staffProfileId, applicantId, documents }: RecruitmentFileTabProps) {
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

  // ── 5. Staff-stage documents (uploaded post-conversion; no applicant_id) ───
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
        <div className="p-4 bg-white flex flex-col gap-1 text-sm text-gray-700">
          <p>
            <span className="font-medium text-gray-900">Conversion Date: </span>
            {formatDate(applicant?.updated_at || applicant?.created_at)}
          </p>
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

        {/* ── Right column: Documents & interviews ──────────────────────── */}
        <div className="xl:col-span-1 space-y-6">

          {/* ════════════════════════════════════════════════════════════════
              APPLICANT UPLOADED DOCUMENTS
              Documents uploaded during the applicant stage (before conversion).
              ════════════════════════════════════════════════════════════════ */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
            {/* Section header */}
            <div className="bg-indigo-50 border-b border-indigo-200 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-indigo-700 text-[18px]">folder_open</span>
                <div>
                  <h2 className="text-sm font-semibold text-indigo-800">Applicant Uploaded Documents</h2>
                  <p className="text-[10px] text-indigo-600 mt-0.5">Uploaded during the application stage</p>
                </div>
              </div>
              <span className="bg-indigo-100 text-indigo-700 text-xs font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset ring-indigo-300">
                {applicantDocs.length}
              </span>
            </div>

            <div className="p-4">
              {applicantDocs.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <span className="material-symbols-outlined text-[32px] text-on-surface-variant/40">folder_off</span>
                  <p className="text-sm text-on-surface-variant">No applicant-stage documents were uploaded.</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {applicantDocs.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex flex-col gap-2 p-3 border border-indigo-100 rounded-lg bg-indigo-50/30 hover:bg-indigo-50/60 transition-colors"
                    >
                      {/* Document name + action buttons */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="material-symbols-outlined text-[16px] text-indigo-500 shrink-0">description</span>
                          <span
                            className="text-sm font-medium text-primary truncate"
                            title={doc.file_name}
                          >
                            {doc.file_name}
                          </span>
                        </div>
                        {/* View + Download buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          {doc.signed_url && (
                            <>
                              <a
                                href={doc.signed_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-indigo-700 bg-indigo-100 hover:bg-indigo-200 transition-colors"
                                title="View document"
                              >
                                <span className="material-symbols-outlined text-[14px]">visibility</span>
                                View
                              </a>
                              <a
                                href={doc.signed_url}
                                download={doc.file_name}
                                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                                title="Download document"
                              >
                                <span className="material-symbols-outlined text-[14px]">download</span>
                                Download
                              </a>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Metadata row */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                        {/* Document type */}
                        <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">
                          {docTypeLabel(doc.document_type)}
                        </span>

                        {/* Upload date */}
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">upload</span>
                          {fmt(doc.created_at)}
                        </span>

                        {/* Expiry date */}
                        {doc.expiry_date && (
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">event</span>
                            Exp: {fmt(doc.expiry_date)}
                          </span>
                        )}

                        {/* File size */}
                        {doc.file_size && (
                          <span className="text-gray-400">{fileSize(doc.file_size)}</span>
                        )}
                      </div>

                      {/* Review status */}
                      {doc.reviewed_status && (
                        <div className="flex items-center gap-2">
                          <ReviewBadge status={doc.reviewed_status} />
                          {doc.reviewed_at && (
                            <span className="text-[10px] text-on-surface-variant">
                              {fmt(doc.reviewed_at)}
                            </span>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════════
              STAFF DOCUMENTS
              Documents uploaded after the person was converted to staff.
              Only shown if there are any.
              ════════════════════════════════════════════════════════════════ */}
          {staffDocsWithUrls.length > 0 && (
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-gray-500 text-[18px]">badge</span>
                  <div>
                    <h2 className="text-sm font-semibold text-gray-700">Staff Documents</h2>
                    <p className="text-[10px] text-gray-500 mt-0.5">Uploaded after becoming staff</p>
                  </div>
                </div>
                <span className="bg-gray-200 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {staffDocsWithUrls.length}
                </span>
              </div>
              <div className="p-4">
                <ul className="space-y-3">
                  {staffDocsWithUrls.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex flex-col gap-1.5 p-3 border border-gray-100 rounded-lg hover:border-gray-200 hover:bg-gray-50/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-primary truncate" title={doc.file_name}>
                          {doc.file_name}
                        </span>
                        {doc.file_url && (
                          <div className="flex items-center gap-1 shrink-0">
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                              title="View document"
                            >
                              <span className="material-symbols-outlined text-[14px]">visibility</span>
                              View
                            </a>
                            <a
                              href={doc.file_url}
                              download={doc.file_name}
                              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                              title="Download document"
                            >
                              <span className="material-symbols-outlined text-[14px]">download</span>
                            </a>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                        <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                          {docTypeLabel(doc.document_type)}
                        </span>
                        <span>{fmt(doc.created_at)}</span>
                        {doc.expiry_date && <span>Exp: {fmt(doc.expiry_date)}</span>}
                      </div>
                      {doc.reviewed_status && (
                        <ReviewBadge status={doc.reviewed_status} />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

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
        </div>
      </div>
    </div>
  )
}
