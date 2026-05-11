import { NextResponse }            from 'next/server'
import { adminClient }              from '@/lib/supabase/admin'
import { requireAdmin }             from '@/lib/auth/requireAdmin'
import { calculateOnboardingStatus } from '@/lib/staff/calculateOnboardingStatus'
import type { OnboardingStage }      from '@/lib/staff/calculateOnboardingStatus'

// ── Types ─────────────────────────────────────────────────────────────────────

interface StaffProfileRow {
  id:                    string
  first_name:            string | null
  last_name:             string | null
  email:                 string | null
  job_role:              string | null
  status:                string
  start_date:            string | null
  created_at:            string
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
  policy_acknowledged:    boolean | null
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
  stage:                 OnboardingStage
  payroll_ready:         boolean
  missing_count:         number
  missing_hmrc:          boolean
  missing_banking:       boolean
  missing_documents:     boolean
  missing_compliance:    boolean
  missing_policy:        boolean
  sections_complete:     number
  sections_total:        number
  is_urgent:             boolean
  stalled_days:          number | null
}

export interface OnboardingSummary {
  total:               number
  complete:            number
  incomplete:          number
  not_started:         number
  in_progress:         number
  awaiting_review:     number
  stalled_count:       number
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const { searchParams } = new URL(request.url)
  const stageFilter = searchParams.get('stage') as OnboardingStage | 'all' | null
  const q           = (searchParams.get('q') ?? '').trim().toLowerCase()

  const { data: rawProfiles, error: profilesError } = await adminClient
    .from('staff_profiles')
    .select([
      'id', 'first_name', 'last_name', 'email', 'job_role', 'status',
      'start_date', 'created_at', 'onboarding_completed', 'date_of_birth', 'nationality',
      'address_line_1', 'city', 'postcode', 'emergency_contact_name',
      'emergency_contact_phone', 'ni_number', 'starter_declaration',
      'employment_type', 'bank_account_number', 'bank_sort_code',
      'bank_account_name', 'right_to_work_checked', 'dbs_checked',
      'dbs_expiry_date', 'policy_acknowledged',
    ].join(', '))
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (profilesError) {
    console.error('[onboarding] profiles error:', profilesError.message)
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 })
  }

  const profiles = (rawProfiles ?? []) as unknown as StaffProfileRow[]

  if (profiles.length === 0) {
    const empty: OnboardingResponse = {
      data: [],
      summary: {
        total: 0, complete: 0, incomplete: 0, not_started: 0,
        in_progress: 0, awaiting_review: 0, stalled_count: 0,
        missing_hmrc: 0, missing_banking: 0, missing_documents: 0,
        missing_compliance: 0, payroll_ready: 0,
      },
    }
    return NextResponse.json(empty)
  }

  const staffIds = profiles.map((p) => p.id)

  const { data: rawDocs } = await adminClient
    .from('documents')
    .select('id, document_type, staff_profile_id, reviewed_status')
    .in('staff_profile_id', staffIds)

  const docs = (rawDocs ?? []) as {
    id: string
    document_type:    string
    staff_profile_id: string
    reviewed_status:  string | null
  }[]

  const docsByStaff: Record<string, string[]> = {}
  for (const doc of docs) {
    if (!docsByStaff[doc.staff_profile_id]) docsByStaff[doc.staff_profile_id] = []
    docsByStaff[doc.staff_profile_id].push(doc.document_type)
  }

  const STALLED_DAYS = 7

  const allRows: OnboardingRow[] = profiles.map((p) => {
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
      policy_acknowledged:      p.policy_acknowledged,
      uploadedDocumentTypes,
    })

    const sectionsComplete = Object.values(obs.sections).filter(Boolean).length
    const sectionsTotal    = Object.keys(obs.sections).length
    const isUrgent         = p.status === 'active' && !obs.ready
    const age              = daysSince(p.created_at)
    const stalledDays      = obs.stage === 'in_progress' && age >= STALLED_DAYS ? age : null

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
      stage:                obs.stage,
      payroll_ready:        obs.payroll_ready,
      missing_count:        obs.missing.length,
      missing_hmrc:         !obs.sections.hmrc,
      missing_banking:      !obs.sections.banking,
      missing_documents:    !obs.sections.documents,
      missing_compliance:   !obs.sections.compliance,
      missing_policy:       !obs.sections.policy,
      sections_complete:    sectionsComplete,
      sections_total:       sectionsTotal,
      is_urgent:            isUrgent,
      stalled_days:         stalledDays,
    }
  })

  // Server-side search
  const searched = q
    ? allRows.filter((r) => {
        const name  = `${r.first_name ?? ''} ${r.last_name ?? ''}`.toLowerCase()
        const email = (r.email ?? '').toLowerCase()
        return name.includes(q) || email.includes(q)
      })
    : allRows

  // Stage filter
  const rows = stageFilter && stageFilter !== 'all'
    ? searched.filter((r) => r.stage === stageFilter)
    : searched

  // Sort: urgent first, stalled next, then by progress ascending
  rows.sort((a, b) => {
    if (a.is_urgent !== b.is_urgent) return a.is_urgent ? -1 : 1
    const aStalled = a.stalled_days !== null
    const bStalled = b.stalled_days !== null
    if (aStalled !== bStalled) return aStalled ? -1 : 1
    return a.progress - b.progress
  })

  const stalledCount = allRows.filter((r) => r.stalled_days !== null).length

  const summary: OnboardingSummary = {
    total:              allRows.length,
    complete:           allRows.filter((r) => r.stage === 'complete').length,
    incomplete:         allRows.filter((r) => r.stage !== 'complete').length,
    not_started:        allRows.filter((r) => r.stage === 'not_started').length,
    in_progress:        allRows.filter((r) => r.stage === 'in_progress').length,
    awaiting_review:    allRows.filter((r) => r.stage === 'awaiting_review').length,
    stalled_count:      stalledCount,
    missing_hmrc:       allRows.filter((r) => r.missing_hmrc).length,
    missing_banking:    allRows.filter((r) => r.missing_banking).length,
    missing_documents:  allRows.filter((r) => r.missing_documents).length,
    missing_compliance: allRows.filter((r) => r.missing_compliance).length,
    payroll_ready:      allRows.filter((r) => r.payroll_ready).length,
  }

  const response: OnboardingResponse = { data: rows, summary }
  return NextResponse.json(response)
}
