import 'server-only'
import { adminClient } from '@/lib/supabase/admin'
import { generateStaffAuditPdf, type PdfSection, type PdfField } from './pdf-generator'
import { buildApplicationPdfSections } from './application-pdf'
import { getStaffDocuments, type StaffDocument } from '@/lib/staff/getStaffDocuments'
import { buildComplianceSnapshot } from '@/lib/compliance/buildComplianceSnapshot'

// ── Formatting helpers ──────────────────────────────────────────────────────

function fmtDate(raw: string | null | undefined): string {
  if (!raw) return '—'
  const d = new Date(raw)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
}

function fmtDateTime(raw: string | null | undefined): string {
  if (!raw) return '—'
  const d = new Date(raw)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function titleCase(raw: string | null | undefined): string {
  if (!raw) return '—'
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// ── Section builders ─────────────────────────────────────────────────────────

async function buildInterviewSection(applicantId: string | null): Promise<PdfSection | null> {
  if (!applicantId) return null

  const { data: interviews } = await adminClient
    .from('interviews')
    .select('id, scheduled_at, conducted_at, interview_type, interviewer_name, location, notes, score, outcome')
    .eq('applicant_id', applicantId)
    .order('scheduled_at', { ascending: true })

  if (!interviews || interviews.length === 0) return null

  const fields: PdfField[] = interviews.map((iv, i) => {
    const lines = [
      `Interviewer: ${iv.interviewer_name ?? '—'}`,
      `Type: ${iv.interview_type ?? '—'}    Location: ${iv.location ?? '—'}`,
      `Scheduled: ${fmtDate(iv.scheduled_at as string | null)}    Conducted: ${fmtDate(iv.conducted_at as string | null)}`,
      `Score: ${iv.score ?? '—'}    Outcome: ${titleCase(iv.outcome as string | null)}`,
      iv.notes ? `Notes: ${iv.notes}` : null,
    ].filter((l): l is string => l !== null)

    return { label: `Interview ${i + 1}`, value: lines.join('\n') }
  })

  return { title: 'Interview Notes', fields }
}

const CHECK_TYPE_LABEL: Record<string, string> = {
  dbs:              'DBS Check',
  right_to_work:    'Right to Work',
  reference:        'Reference',
  id_verification:  'ID Verification',
}

async function buildPreEmploymentSection(staffProfileId: string): Promise<PdfSection | null> {
  const { data: checks } = await adminClient
    .from('pre_employment_checks')
    .select('*')
    .eq('staff_profile_id', staffProfileId)
    .order('check_type')

  if (!checks || checks.length === 0) return null

  const fields: PdfField[] = checks.map((c) => {
    const lines = [`Status: ${titleCase(c.status as string | null)}`]

    if (c.check_type === 'dbs') {
      lines.push(`Type: ${titleCase(c.dbs_type as string | null)}`)
      if (c.dbs_certificate_number) lines.push(`Certificate: ${c.dbs_certificate_number}`)
      lines.push(`Issued: ${fmtDate(c.dbs_issue_date as string | null)}    Expires: ${fmtDate(c.dbs_expiry_date as string | null)}`)
    } else if (c.check_type === 'right_to_work') {
      lines.push(`Document: ${c.rtw_document_type ?? '—'}`)
      lines.push(`Checked: ${fmtDate(c.rtw_checked_date as string | null)}    Expires: ${fmtDate(c.rtw_expiry_date as string | null)}`)
      if (c.rtw_checked_by) lines.push(`Checked by: ${c.rtw_checked_by}`)
    } else if (c.check_type === 'reference') {
      lines.push(`Referee: ${c.ref_referee_name ?? '—'} (${c.ref_referee_role ?? '—'})`)
      if (c.ref_employer_name) lines.push(`Employer: ${c.ref_employer_name}`)
      lines.push(`Requested: ${fmtDate(c.ref_requested_date as string | null)}    Received: ${fmtDate(c.ref_received_date as string | null)}`)
    }

    if (c.notes) lines.push(`Notes: ${c.notes}`)
    if (c.completed_at) lines.push(`Completed: ${fmtDate(c.completed_at as string | null)}`)

    return { label: CHECK_TYPE_LABEL[c.check_type as string] ?? titleCase(c.check_type as string), value: lines.join('\n') }
  })

  return { title: 'Pre-Employment Checks', fields }
}

function buildComplianceSection(documents: StaffDocument[], jobRole: string | null): PdfSection {
  const snap = buildComplianceSnapshot(documents, jobRole)

  const fields: PdfField[] = [
    { label: 'Compliance State',  value: titleCase(snap.state) },
    { label: 'Compliance Score',  value: `${snap.percentage}%` },
    { label: 'Missing Documents', value: snap.missingDocuments.length > 0 ? snap.missingDocuments.map(titleCase).join(', ') : '—' },
    { label: 'Missing Training',  value: snap.missingTraining.length > 0 ? snap.missingTraining.map(titleCase).join(', ') : '—' },
    { label: 'Expired',           value: snap.expiredDocuments.length > 0 || snap.expiredTraining.length > 0 ? [...snap.expiredDocuments, ...snap.expiredTraining].map(titleCase).join(', ') : '—' },
    { label: 'Expiring Soon',     value: snap.expiringSoon.length > 0 ? snap.expiringSoon.map(titleCase).join(', ') : '—' },
  ]

  return { title: 'Compliance Status', fields }
}

function buildTrainingSection(documents: StaffDocument[]): PdfSection | null {
  const training = documents.filter((d) => d.document_type === 'training_certificate')
  if (training.length === 0) return null

  const fields: PdfField[] = training.map((d) => {
    const lines = [
      `File: ${d.file_name}`,
      `Issued: ${fmtDate(d.issue_date)}    Expires: ${fmtDate(d.expiry_date)}`,
      `Status: ${titleCase(d.reviewed_status ?? d.verification_status)}`,
    ]
    return { label: titleCase(d.training_category) || 'Training Certificate', value: lines.join('\n') }
  })

  return { title: 'Training Records', fields }
}

function buildAgreementsSection(
  documents: StaffDocument[],
  policyAcknowledged: boolean,
  policyAcknowledgedAt: string | null,
): PdfSection {
  const fields: PdfField[] = [
    {
      label: 'Onboarding Policy Acknowledgement',
      value: policyAcknowledged ? `Acknowledged ${fmtDateTime(policyAcknowledgedAt)}` : 'Not yet acknowledged',
    },
  ]

  const signed = documents.filter((d) => d.document_type === 'policy_acknowledgement')
  for (const d of signed) {
    fields.push({
      label: d.file_name,
      value: `Uploaded ${fmtDate(d.created_at)}    Status: ${titleCase(d.reviewed_status ?? d.verification_status)}`,
    })
  }

  return { title: 'Signed Agreements & Policies', fields }
}

function buildDocumentsSection(documents: StaffDocument[]): PdfSection | null {
  if (documents.length === 0) return null

  const fields: PdfField[] = documents.map((d) => {
    const lines = [
      `Type: ${titleCase(d.document_type)}`,
      `Uploaded: ${fmtDate(d.created_at)}`,
      d.expiry_date ? `Expires: ${fmtDate(d.expiry_date)}` : null,
      `Status: ${titleCase(d.reviewed_status ?? d.verification_status)}`,
    ].filter((l): l is string => l !== null)

    return { label: d.file_name, value: lines.join('\n') }
  })

  return { title: 'All Uploaded Documents', fields }
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface BuildStaffAuditPdfResult {
  ok:       boolean
  pdfBytes?: Uint8Array
  fileName?: string
  error?:   string
}

export async function buildStaffAuditPdf(staffProfileId: string, companyId: string): Promise<BuildStaffAuditPdfResult> {
  const { data: staffProfile } = await adminClient
    .from('staff_profiles')
    .select('id, applicant_id, first_name, last_name, email, job_role, policy_acknowledged, policy_acknowledged_at')
    .eq('id', staffProfileId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!staffProfile) {
    return { ok: false, error: 'Staff profile not found' }
  }

  const { data: company } = await adminClient
    .from('companies')
    .select('name')
    .eq('id', companyId)
    .maybeSingle()

  const staffName = [staffProfile.first_name, staffProfile.last_name].filter(Boolean).join(' ')
    || staffProfile.email || 'Unknown'
  const jobRole = (staffProfile.job_role as string | null) ?? null
  const applicantId = (staffProfile.applicant_id as string | null) ?? null

  const documents = await getStaffDocuments(staffProfileId, applicantId)

  const [applicationResult, interviewSection, preEmploymentSection] = await Promise.all([
    applicantId ? buildApplicationPdfSections(applicantId, companyId) : Promise.resolve(null),
    buildInterviewSection(applicantId),
    buildPreEmploymentSection(staffProfileId),
  ])

  const trainingSection  = buildTrainingSection(documents)
  const documentsSection = buildDocumentsSection(documents)

  const sections: PdfSection[] = [
    ...(applicationResult?.sections ?? []),
    ...(interviewSection ? [interviewSection] : []),
    ...(preEmploymentSection ? [preEmploymentSection] : []),
    buildComplianceSection(documents, jobRole),
    ...(trainingSection ? [trainingSection] : []),
    buildAgreementsSection(documents, Boolean(staffProfile.policy_acknowledged), (staffProfile.policy_acknowledged_at as string | null) ?? null),
    ...(documentsSection ? [documentsSection] : []),
  ]

  const pdfBytes = await generateStaffAuditPdf({
    staffName,
    email:       staffProfile.email ?? '',
    jobRole:     jobRole ?? '',
    companyName: (company?.name as string | null) ?? 'Care OS',
    generatedAt: fmtDateTime(new Date().toISOString()),
    sections,
  })

  const safeName = staffName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
  const date = new Date().toISOString().slice(0, 10)

  return { ok: true, pdfBytes, fileName: `staff-audit-${safeName}-${date}.pdf` }
}
