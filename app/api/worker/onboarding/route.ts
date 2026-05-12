/**
 * app/api/worker/onboarding/route.ts
 *
 * Returns the current worker's onboarding status, documents, and profile data.
 *
 * Auth: worker session token in ?token= query param.
 *
 * FIXED (2026-05-12):
 *   This route previously authenticated via the legacy `portal_invitations` table,
 *   which is a separate one-time-use token table no longer used for active sessions.
 *   All other worker API routes (validate, documents, shifts, timesheets, availability)
 *   authenticate via `staff_profiles.portal_token_hash` using `validateWorkerToken()`.
 *   This mismatch caused "Invalid or expired session" even for authenticated workers.
 *
 *   Fix: replaced portal_invitations lookup with validateWorkerToken() (identical to
 *   every other worker route), and passed approvedTrainingCategories + job_role to
 *   calculateOnboardingStatus so training gate and compliance state are accurate.
 */

import { NextResponse }               from 'next/server'
import { adminClient }                from '@/lib/supabase/admin'
import { validateWorkerToken }        from '@/lib/worker/auth'
import { calculateOnboardingStatus, getNextActions } from '@/lib/staff/calculateOnboardingStatus'
import { calculateCompliance }        from '@/lib/compliance/calculateCompliance'

interface SpRow {
  id:                    string
  first_name:            string | null
  last_name:             string | null
  email:                 string | null
  status:                string
  job_role:              string | null
  applicant_id:          string | null
  date_of_birth:         string | null
  nationality:           string | null
  address_line_1:        string | null
  city:                  string | null
  postcode:              string | null
  emergency_contact_name:  string | null
  emergency_contact_phone: string | null
  ni_number:              string | null
  employment_type:        string | null
  starter_declaration:    string | null
  bank_account_number:    string | null
  bank_sort_code:         string | null
  bank_account_name:      string | null
  right_to_work_checked:  boolean | null
  dbs_checked:            boolean | null
  dbs_expiry_date:        string | null
  policy_acknowledged:    boolean | null
  policy_acknowledged_at: string | null
  onboarding_completed:   boolean | null
}

interface DocRow {
  id:                string
  document_type:     string
  file_name:         string
  expiry_date:       string | null
  issue_date:        string | null
  created_at:        string
  reviewed_status:   string | null
  training_category: string | null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  // ── Auth: same validateWorkerToken as every other worker route ────────────
  const auth = await validateWorkerToken(token)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const profileId = auth.worker.id

  // ── Fetch staff profile ───────────────────────────────────────────────────
  const { data: rawSp, error: spErr } = await adminClient
    .from('staff_profiles')
    .select([
      'id', 'first_name', 'last_name', 'email', 'status', 'job_role', 'applicant_id',
      'date_of_birth', 'nationality', 'address_line_1', 'city', 'postcode',
      'emergency_contact_name', 'emergency_contact_phone',
      'ni_number', 'employment_type', 'starter_declaration',
      'bank_account_number', 'bank_sort_code', 'bank_account_name',
      'right_to_work_checked', 'dbs_checked', 'dbs_expiry_date',
      'policy_acknowledged', 'policy_acknowledged_at',
      'onboarding_completed',
    ].join(', '))
    .eq('id', profileId)
    .maybeSingle()

  if (spErr || !rawSp) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const sp = rawSp as unknown as SpRow

  // ── Fetch documents (staff_profile_id OR applicant_id) ───────────────────
  // Include training_category so we can derive approvedTrainingCategories.
  const [staffDocsRes, applicantDocsRes] = await Promise.all([
    adminClient
      .from('documents')
      .select('id, document_type, file_name, expiry_date, created_at, reviewed_status, training_category')
      .eq('staff_profile_id', profileId)
      .order('created_at', { ascending: false }),

    sp.applicant_id
      ? adminClient
          .from('documents')
          .select('id, document_type, file_name, expiry_date, created_at, reviewed_status, training_category')
          .eq('applicant_id', sp.applicant_id)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ])

  // Merge, dedupe by id (staff-linked docs take precedence)
  const seen    = new Set<string>()
  const allDocs: DocRow[] = []
  for (const d of [...(staffDocsRes.data ?? []), ...(applicantDocsRes.data ?? [])] as DocRow[]) {
    if (!seen.has(d.id)) { seen.add(d.id); allDocs.push(d) }
  }

  const uploadedDocumentTypes = allDocs.map((d) => d.document_type)

  // Extract approved training categories for the training gate
  const now = new Date()
  const approvedTrainingCategories = allDocs
    .filter((d) =>
      d.document_type     === 'training_certificate' &&
      d.reviewed_status   === 'approved' &&
      d.training_category !== null &&
      // Exclude expired certs — they don't satisfy the gate
      (!d.expiry_date || new Date(d.expiry_date) >= now)
    )
    .map((d) => d.training_category as string)

  const status = calculateOnboardingStatus({
    first_name:              sp.first_name,
    last_name:               sp.last_name,
    date_of_birth:           sp.date_of_birth,
    nationality:             sp.nationality,
    address_line_1:          sp.address_line_1,
    city:                    sp.city,
    postcode:                sp.postcode,
    emergency_contact_name:  sp.emergency_contact_name,
    emergency_contact_phone: sp.emergency_contact_phone,
    ni_number:               sp.ni_number,
    employment_type:         sp.employment_type,
    starter_declaration:     sp.starter_declaration,
    bank_account_number:     sp.bank_account_number,
    bank_sort_code:          sp.bank_sort_code,
    bank_account_name:       sp.bank_account_name,
    right_to_work_checked:   sp.right_to_work_checked,
    dbs_checked:             sp.dbs_checked,
    dbs_expiry_date:         sp.dbs_expiry_date,
    policy_acknowledged:     sp.policy_acknowledged,
    uploadedDocumentTypes,
    approvedTrainingCategories,
    job_role:                sp.job_role,
  })

  const nextActions = getNextActions(status)

  // Surface docs with training_category for per-category status in the UI
  const documents = allDocs.map((d) => ({
    id:                d.id,
    document_type:     d.document_type,
    training_category: d.training_category,
    file_name:         d.file_name,
    expiry_date:       d.expiry_date,
    created_at:        d.created_at,
    reviewed_status:   d.reviewed_status,
  }))

  // Per-category training breakdown for the onboarding checklist UI
  const compliance = calculateCompliance(allDocs)
  const trainingBreakdown = {
    satisfied: compliance.satisfiedTraining,
    missing:   compliance.missingTraining,
    expired:   compliance.expiredTraining,
    // Pending: has a cert in pending review but not yet approved
    pending:   allDocs
      .filter((d) =>
        d.document_type   === 'training_certificate' &&
        d.training_category &&
        d.reviewed_status === 'pending' &&
        !compliance.satisfiedTraining.includes(d.training_category)
      )
      .map((d) => d.training_category as string)
      .filter((cat, i, arr) => arr.indexOf(cat) === i), // dedupe
  }

  return NextResponse.json({
    profile: {
      id:                  sp.id,
      first_name:          sp.first_name,
      last_name:           sp.last_name,
      email:               sp.email,
      status:              sp.status,
      policy_acknowledged: sp.policy_acknowledged,
    },
    status,
    nextActions,
    documents,
    trainingBreakdown,
  })
}
