/**
 * POST /api/admin/staff/[id]/reminder
 *
 * Sends an onboarding reminder email to the staff member.
 * Fetches company name dynamically from the companies table.
 */

import { NextResponse }               from 'next/server'
import { adminClient }                 from '@/lib/supabase/admin'
import { requireAdmin }               from '@/lib/auth/requireAdmin'
import { calculateOnboardingStatus }  from '@/lib/staff/calculateOnboardingStatus'
import { sendOnboardingReminderEmail } from '@/lib/email/resend'
import { emailConfig }                from '@/lib/email/config'
import { createNotification }         from '@/lib/notifications/createNotification'

interface SpRow {
  id:                    string
  first_name:            string | null
  last_name:             string | null
  email:                 string | null
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
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const { id: staffProfileId } = await params

  // Fetch staff profile
  const { data: rawSp, error: spErr } = await adminClient
    .from('staff_profiles')
    .select([
      'id', 'first_name', 'last_name', 'email', 'company_id',
      'date_of_birth', 'nationality', 'address_line_1', 'city', 'postcode',
      'emergency_contact_name', 'emergency_contact_phone',
      'ni_number', 'employment_type', 'starter_declaration',
      'bank_account_number', 'bank_sort_code', 'bank_account_name',
      'right_to_work_checked', 'dbs_checked', 'dbs_expiry_date',
      'policy_acknowledged',
    ].join(', '))
    .eq('id', staffProfileId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (spErr || !rawSp) {
    return NextResponse.json({ error: 'Staff profile not found' }, { status: 404 })
  }

  const sp = rawSp as unknown as SpRow

  const email = sp.email
  if (!email) {
    return NextResponse.json({ error: 'Staff member has no email address' }, { status: 422 })
  }

  // Fetch documents
  const { data: docs } = await adminClient
    .from('documents')
    .select('document_type')
    .eq('staff_profile_id', staffProfileId)

  const uploadedDocumentTypes = (docs ?? []).map((d: { document_type: string }) => d.document_type)

  const obs = calculateOnboardingStatus({
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

  // Fetch company name dynamically
  const { data: company } = await adminClient
    .from('companies')
    .select('name')
    .eq('id', companyId)
    .maybeSingle()

  const companyName = (company?.name as string | null) ?? null
  const portalLink  = `${emailConfig.appUrl}/worker/onboarding`

  const result = await sendOnboardingReminderEmail({
    to:           email,
    firstName:    sp.first_name ?? 'there',
    portalLink,
    missingItems: obs.missing,
    companyName,
  })

  if (!result.success) {
    console.error('[reminder] email failed:', result.error)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }

  // In-app notification (fire-and-forget)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  void createNotification({
    recipient:      'worker',
    staffProfileId: staffProfileId,
    companyId,
    eventType:      'onboarding_reminder',
    title:          'Action needed: complete your onboarding',
    message:        obs.missing.length > 0
      ? `${obs.missing.length} item${obs.missing.length === 1 ? '' : 's'} still required.`
      : 'Please review your onboarding checklist.',
    actionUrl:      `${appUrl}/worker/onboarding`,
    entityId:       staffProfileId,
  })

  return NextResponse.json({ success: true })
}
