/**
 * app/api/worker/onboarding/route.ts
 *
 * Returns the current worker's onboarding status, documents, and profile data.
 * Authentication: worker session token in ?token= query param.
 */

import { NextResponse }              from 'next/server'
import { adminClient }               from '@/lib/supabase/admin'
import { calculateOnboardingStatus, getNextActions } from '@/lib/staff/calculateOnboardingStatus'

interface SpRow {
  id:                    string
  first_name:            string | null
  last_name:             string | null
  email:                 string | null
  status:                string
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
  id:              string
  document_type:   string
  file_name:       string
  expiry_date:     string | null
  created_at:      string
  reviewed_status: string | null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'token required' }, { status: 400 })
  }

  // Resolve the token → staff_profile_id
  const { data: inv, error: invErr } = await adminClient
    .from('portal_invitations')
    .select('staff_profile_id, applicant_id, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (invErr || !inv) {
    return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 })
  }

  if (new Date((inv as { expires_at: string }).expires_at) < new Date()) {
    return NextResponse.json({ error: 'Session has expired' }, { status: 401 })
  }

  const profileId = (inv as { staff_profile_id: string }).staff_profile_id

  // Fetch staff profile
  const { data: rawSp, error: spErr } = await adminClient
    .from('staff_profiles')
    .select([
      'id', 'first_name', 'last_name', 'email', 'status',
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

  // Fetch uploaded documents
  const { data: rawDocs } = await adminClient
    .from('documents')
    .select('id, document_type, file_name, expiry_date, created_at, reviewed_status')
    .eq('staff_profile_id', profileId)
    .order('created_at', { ascending: false })

  const documents = (rawDocs ?? []) as unknown as DocRow[]
  const uploadedDocumentTypes = documents.map((d) => d.document_type)

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
  })

  const nextActions = getNextActions(status)

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
  })
}
