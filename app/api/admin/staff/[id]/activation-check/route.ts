/**
 * GET /api/admin/staff/[id]/activation-check
 *
 * Pre-flight compliance check before activating a staff member.
 * Returns structured blockers and warnings.
 */

import { NextResponse }               from 'next/server'
import { adminClient }                 from '@/lib/supabase/admin'
import { requireAdmin }               from '@/lib/auth/requireAdmin'
import { calculateOnboardingStatus }  from '@/lib/staff/calculateOnboardingStatus'

export interface ActivationBlocker {
  type:    string
  message: string
}

export interface ActivationCheckResult {
  can_activate: boolean
  blockers:     ActivationBlocker[]
  warnings:     ActivationBlocker[]
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const { id: staffProfileId } = await params

  // Fetch staff profile
  const { data: rawProfile } = await adminClient
    .from('staff_profiles')
    .select([
      'id', 'company_id', 'status',
      'first_name', 'last_name', 'date_of_birth', 'nationality',
      'address_line_1', 'city', 'postcode',
      'emergency_contact_name', 'emergency_contact_phone',
      'ni_number', 'employment_type', 'starter_declaration',
      'bank_account_number', 'bank_sort_code', 'bank_account_name',
      'right_to_work_checked', 'dbs_checked', 'dbs_expiry_date',
      'policy_acknowledged',
    ].join(', '))
    .eq('id', staffProfileId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!rawProfile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const sp = rawProfile as unknown as Record<string, unknown>

  // Fetch documents
  const { data: rawDocs } = await adminClient
    .from('documents')
    .select('id, document_type, reviewed_status, expiry_date')
    .eq('staff_profile_id', staffProfileId)

  const docs = (rawDocs ?? []) as {
    id:              string
    document_type:   string
    reviewed_status: string | null
    expiry_date:     string | null
  }[]

  const uploadedDocumentTypes = docs.map((d) => d.document_type)
  const rejectedDocs          = docs.filter((d) => d.reviewed_status === 'rejected')
  const pendingReviewDocs     = docs.filter((d) => d.reviewed_status === null)

  const obs = calculateOnboardingStatus({
    first_name:               sp.first_name as string | null,
    last_name:                sp.last_name  as string | null,
    date_of_birth:            sp.date_of_birth as string | null,
    nationality:              sp.nationality   as string | null,
    address_line_1:           sp.address_line_1 as string | null,
    city:                     sp.city           as string | null,
    postcode:                 sp.postcode       as string | null,
    emergency_contact_name:   sp.emergency_contact_name  as string | null,
    emergency_contact_phone:  sp.emergency_contact_phone as string | null,
    ni_number:                sp.ni_number          as string | null,
    employment_type:          sp.employment_type    as string | null,
    starter_declaration:      sp.starter_declaration as string | null,
    bank_account_number:      sp.bank_account_number as string | null,
    bank_sort_code:           sp.bank_sort_code      as string | null,
    bank_account_name:        sp.bank_account_name   as string | null,
    right_to_work_checked:    sp.right_to_work_checked as boolean | null,
    dbs_checked:              sp.dbs_checked           as boolean | null,
    dbs_expiry_date:          sp.dbs_expiry_date       as string | null,
    policy_acknowledged:      sp.policy_acknowledged   as boolean | null,
    uploadedDocumentTypes,
  })

  const blockers: ActivationBlocker[] = []
  const warnings: ActivationBlocker[] = []

  // Critical blockers
  if (!obs.sections.compliance) {
    if (!sp.right_to_work_checked)
      blockers.push({ type: 'right_to_work', message: 'Right to work not verified' })
    if (!sp.dbs_checked)
      blockers.push({ type: 'dbs', message: 'DBS check not completed' })
  }

  if (!obs.sections.documents)
    blockers.push({ type: 'missing_docs', message: 'Mandatory documents not uploaded' })

  if (rejectedDocs.length > 0)
    blockers.push({
      type:    'rejected_docs',
      message: `${rejectedDocs.length} document${rejectedDocs.length !== 1 ? 's' : ''} rejected — require re-upload: ${rejectedDocs.map((d) => d.document_type.replace(/_/g, ' ')).join(', ')}`,
    })

  if (!obs.sections.policy)
    blockers.push({ type: 'policy', message: 'Policy not acknowledged by worker' })

  // Warnings (non-blocking)
  if (!obs.sections.hmrc)
    warnings.push({ type: 'hmrc', message: 'HMRC / payroll details incomplete — payroll may not be possible' })

  if (!obs.sections.banking)
    warnings.push({ type: 'banking', message: 'Bank details incomplete — salary cannot be paid' })

  if (pendingReviewDocs.length > 0)
    warnings.push({
      type:    'pending_review',
      message: `${pendingReviewDocs.length} document${pendingReviewDocs.length !== 1 ? 's' : ''} awaiting review by admin`,
    })

  // DBS expiry warning
  if (sp.dbs_expiry_date) {
    const expiryDate = new Date(sp.dbs_expiry_date as string)
    const inDays = Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (inDays < 0)
      blockers.push({ type: 'dbs_expired', message: `DBS certificate expired ${Math.abs(inDays)} days ago` })
    else if (inDays <= 30)
      warnings.push({ type: 'dbs_expiring', message: `DBS certificate expires in ${inDays} days` })
  }

  const result: ActivationCheckResult = {
    can_activate: blockers.length === 0,
    blockers,
    warnings,
  }

  return NextResponse.json(result)
}
