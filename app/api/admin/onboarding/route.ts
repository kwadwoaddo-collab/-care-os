import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { calculateOnboardingStatus } from '@/lib/staff/calculateOnboardingStatus'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StaffProfileRow {
  id:                    string
  first_name:            string | null
  last_name:             string | null
  email:                 string | null
  job_role:              string | null
  status:                string
  start_date:            string | null
  onboarding_completed:  boolean | null
  date_of_birth:         string | null
  nationality:           string | null
  address_line_1:        string | null
  city:                  string | null
  postcode:              string | null
  emergency_contact_name:  string | null
  emergency_contact_phone: string | null
  ni_number:              string | null
  starter_declaration:    string | null
  employment_type:        string | null
  bank_account_number:    string | null
  bank_sort_code:         string | null
  bank_account_name:      string | null
  right_to_work_checked:  boolean | null
  dbs_checked:            boolean | null
  dbs_expiry_date:        string | null
}

export interface OnboardingRow {
  id:                    string
  first_name:            string | null
  last_name:             string | null
  email:                 string | null
  job_role:              string | null
  status:                string
  start_date:            string | null
  onboarding_completed:  boolean | null
  progress:              number
  payroll_ready:         boolean
  missing_count:         number
  missing_hmrc:          boolean
  missing_banking:       boolean
  missing_documents:     boolean
  missing_compliance:    boolean
  sections_complete:     number
  sections_total:        number
  is_urgent:             boolean
}

export interface OnboardingSummary {
  total:               number
  complete:            number
  incomplete:          number
  missing_hmrc:        number
  missing_banking:     number
  missing_documents:   number
  missing_compliance:  number
  payroll_ready:       number
}

export interface OnboardingResponse {
  data:    OnboardingRow[]
  summary: OnboardingSummary
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const { data: rawProfiles, error: profilesError } = await adminClient
    .from('staff_profiles')
    .select('id, first_name, last_name, email, job_role, status, start_date, onboarding_completed, date_of_birth, nationality, address_line_1, city, postcode, emergency_contact_name, emergency_contact_phone, ni_number, starter_declaration, employment_type, bank_account_number, bank_sort_code, bank_account_name, right_to_work_checked, dbs_checked, dbs_expiry_date')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (profilesError) {
    console.error('[onboarding] profiles error:', profilesError.message)
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 })
  }

  const profiles = (rawProfiles ?? []) as StaffProfileRow[]

  if (profiles.length === 0) {
    const empty: OnboardingResponse = {
      data: [],
      summary: { total: 0, complete: 0, incomplete: 0, missing_hmrc: 0, missing_banking: 0, missing_documents: 0, missing_compliance: 0, payroll_ready: 0 },
    }
    return NextResponse.json(empty)
  }

  const staffIds = profiles.map((p) => p.id)

  // Batch-fetch all documents for these staff profiles
  const { data: rawDocs } = await adminClient
    .from('documents')
    .select('id, document_type, staff_profile_id')
    .in('staff_profile_id', staffIds)

  const docs = (rawDocs ?? []) as { id: string; document_type: string; staff_profile_id: string }[]

  // Index docs by staff profile id
  const docsByStaff: Record<string, string[]> = {}
  for (const doc of docs) {
    if (!docsByStaff[doc.staff_profile_id]) docsByStaff[doc.staff_profile_id] = []
    docsByStaff[doc.staff_profile_id].push(doc.document_type)
  }

  // Build result
  const rows: OnboardingRow[] = profiles.map((p) => {
    const uploadedDocumentTypes = docsByStaff[p.id] ?? []

    const obs = calculateOnboardingStatus({
      first_name:               p.first_name,
      last_name:                p.last_name,
      date_of_birth:            p.date_of_birth,
      nationality:              p.nationality,
      address_line_1:           p.address_line_1,
      city:                     p.city,
      postcode:                 p.postcode,
      emergency_contact_name:   p.emergency_contact_name,
      emergency_contact_phone:  p.emergency_contact_phone,
      ni_number:                p.ni_number,
      employment_type:          p.employment_type,
      starter_declaration:      p.starter_declaration,
      bank_account_number:      p.bank_account_number,
      bank_sort_code:           p.bank_sort_code,
      bank_account_name:        p.bank_account_name,
      right_to_work_checked:    p.right_to_work_checked,
      dbs_checked:              p.dbs_checked,
      dbs_expiry_date:          p.dbs_expiry_date,
      uploadedDocumentTypes,
    })

    const sectionsComplete = Object.values(obs.sections).filter(Boolean).length
    const sectionsTotal    = Object.keys(obs.sections).length
    const isUrgent         = p.status === 'active' && !obs.ready

    return {
      id:                   p.id,
      first_name:           p.first_name,
      last_name:            p.last_name,
      email:                p.email,
      job_role:             p.job_role,
      status:               p.status,
      start_date:           p.start_date,
      onboarding_completed: p.onboarding_completed,
      progress:             obs.progress,
      payroll_ready:        obs.payroll_ready,
      missing_count:        obs.missing.length,
      missing_hmrc:         !obs.sections.hmrc,
      missing_banking:      !obs.sections.banking,
      missing_documents:    !obs.sections.documents,
      missing_compliance:   !obs.sections.compliance,
      sections_complete:    sectionsComplete,
      sections_total:       sectionsTotal,
      is_urgent:            isUrgent,
    }
  })

  const summary: OnboardingSummary = {
    total:              rows.length,
    complete:           rows.filter((r) => r.onboarding_completed).length,
    incomplete:         rows.filter((r) => !r.onboarding_completed).length,
    missing_hmrc:       rows.filter((r) => r.missing_hmrc).length,
    missing_banking:    rows.filter((r) => r.missing_banking).length,
    missing_documents:  rows.filter((r) => r.missing_documents).length,
    missing_compliance: rows.filter((r) => r.missing_compliance).length,
    payroll_ready:      rows.filter((r) => r.payroll_ready).length,
  }

  const response: OnboardingResponse = { data: rows, summary }
  return NextResponse.json(response)
}
