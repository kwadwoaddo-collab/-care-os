import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin }             from '@/lib/auth/requireAdmin'
import { adminClient }              from '@/lib/supabase/admin'
import { calculateWorkerReadiness } from '@/lib/onboarding/readiness'
import type { ReadinessStaffInput, ReadinessDocumentInput } from '@/lib/onboarding/readiness'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const staffProfileId = req.nextUrl.searchParams.get('staffProfileId')
  if (!staffProfileId) {
    return NextResponse.json({ error: 'staffProfileId required' }, { status: 400 })
  }

  const { companyId } = auth.ctx

  const { data: sp, error: spErr } = await adminClient
    .from('staff_profiles')
    .select(`
      id, first_name, last_name, job_role, status, employment_type,
      date_of_birth, address_line_1, city, postcode,
      emergency_contact_name, emergency_contact_phone,
      ni_number, starter_declaration, bank_account_number,
      bank_sort_code, bank_account_name,
      right_to_work_checked, dbs_checked, policy_acknowledged,
      non_compliant_since, applicant_id
    `)
    .eq('id', staffProfileId)
    .eq('company_id', companyId)
    .single()

  if (spErr || !sp) {
    return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
  }

  // Fetch documents
  const conditions = [`staff_profile_id.eq.${sp.id}`]
  if (sp.applicant_id) conditions.push(`applicant_id.eq.${sp.applicant_id}`)

  const { data: docs } = await adminClient
    .from('documents')
    .select('id, document_type, file_name, expiry_date, issue_date, training_category, reviewed_status, verification_status')
    .eq('company_id', companyId)
    .is('archived_at', null)
    .or(conditions.join(','))

  const documents: ReadinessDocumentInput[] = (docs ?? []).map((d) => ({
    id:                  d.id,
    document_type:       d.document_type,
    expiry_date:         d.expiry_date,
    issue_date:          d.issue_date,
    training_category:   d.training_category,
    reviewed_status:     d.reviewed_status,
    verification_status: d.verification_status,
    file_name:           d.file_name,
  }))

  const staffInput: ReadinessStaffInput = {
    id:                  sp.id,
    status:              sp.status,
    job_role:            sp.job_role,
    employment_type:     sp.employment_type,
    date_of_birth:       sp.date_of_birth,
    address_line_1:      sp.address_line_1,
    city:                sp.city,
    postcode:            sp.postcode,
    emergency_contact_name:  sp.emergency_contact_name,
    emergency_contact_phone: sp.emergency_contact_phone,
    ni_number:           sp.ni_number,
    starter_declaration: sp.starter_declaration,
    bank_account_number: sp.bank_account_number,
    bank_sort_code:      sp.bank_sort_code,
    bank_account_name:   sp.bank_account_name,
    right_to_work_checked: sp.right_to_work_checked,
    dbs_checked:         sp.dbs_checked,
    policy_acknowledged: sp.policy_acknowledged,
    non_compliant_since: sp.non_compliant_since,
  }

  const readiness = calculateWorkerReadiness({
    staff:        staffInput,
    documents,
    availability: { hasAvailability: true, maxWeeklyHours: null, workAreas: [] },
  })

  return NextResponse.json({ readiness })
}
