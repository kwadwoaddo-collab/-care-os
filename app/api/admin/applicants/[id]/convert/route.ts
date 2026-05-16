import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'

// ── Form slug → staff_profile column mapping ──────────────────────────────────
//
// The applicant application form stores data under form_answer slugs.
// The column names in staff_profiles use different names in some cases:
//
//   Slug                         → Column
//   ─────────────────────────────────────
//   national_insurance           → ni_number
//   town_city                    → city
//   address_line_1               → address_line_1  (same)
//   address_line_2               → address_line_2  (same)
//   postcode                     → postcode        (same)
//   date_of_birth                → date_of_birth   (same)
//   emergency_contact_name       → emergency_contact_name
//   emergency_contact_phone      → emergency_contact_phone
//   emergency_contact_relationship → emergency_contact_relationship
//   nationality                  → nationality
//   right_to_work_uk             → (boolean: recorded to metadata only)
//   requires_sponsorship         → (boolean: metadata only)
//
// All mappings are applied during conversion so the staff profile is
// pre-populated with data the applicant already provided.
//
const SLUG_TO_COLUMN: Record<string, string> = {
  national_insurance:                'ni_number',
  town_city:                         'city',
  address_line_1:                    'address_line_1',
  address_line_2:                    'address_line_2',
  postcode:                          'postcode',
  date_of_birth:                     'date_of_birth',
  nationality:                       'nationality',
  emergency_contact_name:            'emergency_contact_name',
  emergency_contact_phone:           'emergency_contact_phone',
  emergency_contact_relationship:    'emergency_contact_relationship',
}

// Fields that are stored as text values
const STRING_COLUMNS = new Set([
  'ni_number', 'city', 'address_line_1', 'address_line_2', 'postcode',
  'nationality', 'emergency_contact_name', 'emergency_contact_phone',
  'emergency_contact_relationship',
])

// Fields that are stored as DATE (ISO strings)
const DATE_COLUMNS = new Set(['date_of_birth'])

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const { id: applicantId } = await params

  // ── 1. Fetch applicant ─────────────────────────────────────────────────────
  const { data: applicant, error: applicantError } = await adminClient
    .from('applicants')
    .select('id, company_id, first_name, last_name, email, phone, job_role, status')
    .eq('id', applicantId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (applicantError) {
    console.error('[convert] fetch applicant error:', applicantError)
    return NextResponse.json(
      { error: 'Failed to fetch applicant', supabase_message: applicantError.message },
      { status: 500 }
    )
  }

  if (!applicant) {
    return NextResponse.json({ error: 'Applicant not found' }, { status: 404 })
  }

  // ── 2. Idempotency: return existing staff profile if already converted ─────
  const { data: existing, error: existingError } = await adminClient
    .from('staff_profiles')
    .select('*')
    .eq('applicant_id', applicantId)
    .maybeSingle()

  if (existingError) {
    console.error('[convert] check existing error:', existingError)
    return NextResponse.json(
      { error: 'Failed to check existing profile', supabase_message: existingError.message },
      { status: 500 }
    )
  }

  if (existing) {
    return NextResponse.json(
      {
        error:         'Applicant has already been converted to staff.',
        staff_profile: existing,
      },
      { status: 409 }
    )
  }

  // ── 3. Fetch form answers for this applicant ───────────────────────────────
  //
  // The application form stores data in form_answers keyed by form_fields.slug.
  // We read them here so the staff profile is pre-populated on creation,
  // avoiding the "fields blank after conversion" UX issue.

  const formAnswers: Record<string, string | null> = {}

  const { data: response } = await adminClient
    .from('form_responses')
    .select('id')
    .eq('applicant_id', applicantId)
    .maybeSingle()

  if (response?.id) {
    const { data: rawAnswers } = await adminClient
      .from('form_answers')
      .select('value, form_fields ( slug )')
      .eq('response_id', response.id)

    type RawAnswer = {
      value: Record<string, unknown> | null
      form_fields: { slug: string } | null
    }

    for (const row of (rawAnswers ?? []) as unknown as RawAnswer[]) {
      const slug = row.form_fields?.slug
      if (!slug || !(slug in SLUG_TO_COLUMN)) continue

      const val: unknown = row.value
      let text: string | null = null
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        const obj = val as Record<string, unknown>
        if ('text' in obj && typeof obj.text === 'string') {
          text = obj.text.trim() || null
        } else if ('checked' in obj) {
          // boolean answers — skip (not mapped to string columns)
          continue
        }
      } else if (typeof val === 'string') {
        text = val.trim() || null
      }

      const column = SLUG_TO_COLUMN[slug]
      formAnswers[column] = text
    }
  }

  // ── 4. Build mapped staff profile fields from form answers ─────────────────

  const mappedFields: Record<string, unknown> = {}
  for (const [column, value] of Object.entries(formAnswers)) {
    if (value === null) continue

    if (DATE_COLUMNS.has(column)) {
      // DATE columns: store the ISO date string; DB accepts YYYY-MM-DD
      mappedFields[column] = value
    } else if (STRING_COLUMNS.has(column)) {
      mappedFields[column] = value
    }
  }

  // ── 5. Create staff profile ────────────────────────────────────────────────
  const { data: staffProfile, error: insertError } = await adminClient
    .from('staff_profiles')
    .insert({
      company_id:   applicant.company_id,
      applicant_id: applicant.id,
      first_name:   applicant.first_name ?? null,
      last_name:    applicant.last_name  ?? null,
      email:        applicant.email,
      phone:        applicant.phone      ?? null,
      job_role:     applicant.job_role   ?? null,
      status:       'pre_employment',
      // Pre-populate from form answers
      ...mappedFields,
    })
    .select('*')
    .single()

  if (insertError || !staffProfile) {
    console.error('[convert] insert staff_profile error — code:',    insertError?.code)
    console.error('[convert] insert staff_profile error — message:', insertError?.message)
    console.error('[convert] insert staff_profile error — details:', insertError?.details)
    return NextResponse.json(
      {
        error:            'Failed to create staff profile',
        supabase_code:    insertError?.code    ?? null,
        supabase_message: insertError?.message ?? null,
        supabase_details: insertError?.details ?? null,
      },
      { status: 500 }
    )
  }

  // ── 6. Migrate applicant-owned documents to staff profile ──────────────────
  //
  // Documents uploaded during the applicant flow have applicant_id set and
  // staff_profile_id = NULL. The document approval route checks staff_profile_id,
  // so these documents cannot be approved unless we link them.
  //
  // We set staff_profile_id on all of the applicant's documents so they are
  // fully approvable from the staff profile. The applicant_id remains set for
  // audit purposes.

  const { error: docMigrateError } = await adminClient
    .from('documents')
    .update({ staff_profile_id: staffProfile.id })
    .eq('applicant_id', applicantId)
    .is('staff_profile_id', null)   // only touch unlinked docs

  if (docMigrateError) {
    // Non-fatal: log and continue. Documents still visible via applicant_id
    // fallback in getStaffDocuments; they just won't be approvable until fixed.
    console.error('[convert] document migration error:', docMigrateError.message)
  }

  // ── 7. Update applicant status → hired ────────────────────────────────────
  const { error: statusError } = await adminClient
    .from('applicants')
    .update({ status: 'hired', updated_at: new Date().toISOString() })
    .eq('id', applicantId)

  if (statusError) {
    // Non-fatal: staff profile created; log and continue
    console.error('[convert] update applicant status error:', statusError.message)
  }

  // ── 8. Audit logs (fire-and-forget) ───────────────────────────────────────
  void (async () => {
    try {
      const now = new Date().toISOString()
      const { error } = await adminClient.from('audit_logs').insert([
        {
          company_id:  applicant.company_id,
          actor_id:    null,
          action:      'applicant.converted_to_staff',
          entity_type: 'applicant',
          entity_id:   applicant.id,
          metadata:    {
            staff_profile_id: staffProfile.id,
            fields_mapped: Object.keys(mappedFields),
            timestamp: now,
          },
        },
        {
          company_id:  applicant.company_id,
          actor_id:    null,
          action:      'staff.created',
          entity_type: 'staff_profile',
          entity_id:   staffProfile.id,
          metadata:    { applicant_id: applicant.id, timestamp: now },
        },
      ])
      if (error) console.error('[convert] audit log error:', error.message)
    } catch (err) {
      console.error('[convert] audit log unexpected error:', err)
    }
  })()

  return NextResponse.json({ staff_profile: staffProfile }, { status: 201 })
}
