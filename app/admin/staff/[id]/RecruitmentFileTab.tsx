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
interface Document {
  id: string
  applicant_id?: string | null
  file_name: string
  file_path: string | null
  file_url?: string | null
  document_type: string
  created_at: string
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
  documents: Document[]
}

export default async function RecruitmentFileTab({ staffProfileId, applicantId, documents }: RecruitmentFileTabProps) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    return <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">Unauthorized</div>
  }
  const { companyId } = auth.ctx

  // Fetch applicant details
  const { data: applicant, error: applicantError } = await adminClient
    .from('applicants')
    .select('*')
    .eq('id', applicantId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (applicantError || !applicant) {
    return <div className="rounded-md bg-gray-50 border border-gray-200 p-6 text-center text-sm text-gray-500 mt-6">No linked recruitment file found for this staff member.</div>
  }

  // Fetch form response
  const { data: response } = await adminClient
    .from('form_responses')
    .select('id, status, submitted_at, created_at, updated_at')
    .eq('applicant_id', applicantId)
    .maybeSingle()

  // Fetch form answers
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

  // Fetch interviews
  const { data: interviewsRaw } = await adminClient
    .from('interviews')
    .select('*')
    .eq('applicant_id', applicantId)
    .eq('company_id', companyId)
    .order('scheduled_at', { ascending: false })

  const interviews = (interviewsRaw ?? []) as Interview[]
  let applicantDocs = documents.filter(d => d.applicant_id === applicantId)

  // Generate signed URLs for applicant docs
  applicantDocs = await Promise.all(applicantDocs.map(async (doc) => {
    if (doc.file_path) {
      const { data } = await adminClient.storage.from('documents').createSignedUrl(doc.file_path, 3600)
      return { ...doc, file_url: data?.signedUrl ?? null }
    }
    return { ...doc, file_url: null }
  }))

  return (
    <div className="space-y-6 mt-6">
      {/* Converted Notice */}
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

        <div className="xl:col-span-1 space-y-6">
          {/* Applicant Documents */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Applicant Documents</h2>
              <span className="bg-gray-200 text-gray-700 text-xs font-semibold px-2 py-0.5 rounded-full">{applicantDocs.length}</span>
            </div>
            <div className="p-4">
              {applicantDocs.length === 0 ? (
                <p className="text-sm text-gray-500">No documents uploaded during application.</p>
              ) : (
                <ul className="space-y-3">
                  {applicantDocs.map(doc => (
                    <li key={doc.id} className="flex flex-col gap-1.5 p-3 border border-gray-100 rounded-lg hover:border-blue-100 hover:bg-blue-50/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-primary truncate" title={doc.file_name}>{doc.file_name}</span>
                        {doc.file_url && (
                          <a
                            href={doc.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 shrink-0"
                            title="Download document"
                          >
                            <span className="material-symbols-outlined text-[18px]">download</span>
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{doc.document_type}</span>
                        <span className="text-gray-400">{formatDate(doc.created_at)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Interview Records */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-700">Interview Records</h2>
            </div>
            <div className="p-4">
              {interviews.length === 0 ? (
                <p className="text-sm text-gray-500">No interviews recorded.</p>
              ) : (
                <div className="space-y-4">
                  {interviews.map(inv => (
                    <div key={inv.id} className="border border-gray-200 rounded-lg p-3 space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-primary">{inv.interview_type || 'Interview'}</span>
                        <span className="text-xs text-gray-500">{formatDate(inv.scheduled_at)}</span>
                      </div>
                      {(inv.status || inv.outcome) && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-on-surface-variant font-medium">Outcome:</span>
                          <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 capitalize">{inv.outcome || inv.status}</span>
                        </div>
                      )}
                      {inv.notes && (
                        <div>
                          <p className="text-xs font-medium text-on-surface-variant mb-1">Notes</p>
                          <p className="text-xs text-gray-600 whitespace-pre-line bg-gray-50 p-2 rounded border border-gray-100">{inv.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Role & Compliance Summary */}
          <RoleComplianceStatus answers={answers} documents={documents as any} />

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
