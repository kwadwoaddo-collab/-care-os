import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { adminClient } from '@/lib/supabase/admin'

const FORM_NAME = 'Application: Personal Details'

const FIELD_DEFS = [
  // Section 1 — Personal Details
  { slug: 'first_name',                   label: 'First name',                      field_type: 'text',     is_required: true,  sort_order: 1  },
  { slug: 'last_name',                    label: 'Last name',                       field_type: 'text',     is_required: true,  sort_order: 2  },
  { slug: 'email',                        label: 'Email',                           field_type: 'email',    is_required: true,  sort_order: 3  },
  { slug: 'phone',                        label: 'Phone',                           field_type: 'phone',    is_required: false, sort_order: 4  },
  { slug: 'job_role',                     label: 'Job role',                        field_type: 'text',     is_required: false, sort_order: 5  },
  { slug: 'address_line_1',              label: 'Address line 1',                  field_type: 'text',     is_required: true,  sort_order: 6  },
  { slug: 'address_line_2',              label: 'Address line 2',                  field_type: 'text',     is_required: false, sort_order: 7  },
  { slug: 'town_city',                    label: 'Town / City',                     field_type: 'text',     is_required: true,  sort_order: 8  },
  { slug: 'postcode',                     label: 'Postcode',                        field_type: 'text',     is_required: true,  sort_order: 9  },
  { slug: 'date_of_birth',               label: 'Date of birth',                   field_type: 'date',     is_required: true,  sort_order: 10 },
  { slug: 'national_insurance',          label: 'National Insurance number',       field_type: 'text',     is_required: true,  sort_order: 11 },

  // Section 2 — Employment / Education History (stored as single JSONB array)
  { slug: 'employment_history',          label: 'Employment / Education History',  field_type: 'textarea', is_required: false, sort_order: 12 },

  // Section 2 — Employment Gap Declarations (stored as single JSONB array)
  { slug: 'employment_gap_declarations', label: 'Employment Gap Declarations',     field_type: 'textarea', is_required: false, sort_order: 14 },

  // Section 2 — Has Never Worked flag
  { slug: 'has_never_worked',            label: 'Has never worked',                field_type: 'checkbox', is_required: false, sort_order: 15 },

  // Section 2 — Employment History Declaration
  { slug: 'employment_history_declaration', label: 'Employment history declaration', field_type: 'checkbox', is_required: false, sort_order: 16 },

  // Section 2 — References (stored as single JSONB array)
  { slug: 'references',                  label: 'References',                      field_type: 'textarea', is_required: true,  sort_order: 13 },

  // Section 3 — Right to Work
  { slug: 'right_to_work_uk',            label: 'Right to work in the UK',         field_type: 'checkbox', is_required: true,  sort_order: 31 },
  { slug: 'right_to_work_type',          label: 'Right to work type',              field_type: 'text',     is_required: false, sort_order: 32 },
  { slug: 'requires_sponsorship',        label: 'Requires visa sponsorship',       field_type: 'checkbox', is_required: false, sort_order: 33 },
  { slug: 'visa_expiry_date',            label: 'Visa expiry date',                field_type: 'date',     is_required: false, sort_order: 34 },
  { slug: 'share_code',                  label: 'Share code',                      field_type: 'text',     is_required: false, sort_order: 35 },

  // Section 3 — Criminal Record & DBS Declaration (stored as single JSONB object)
  { slug: 'criminal_record',             label: 'Criminal Record & DBS Declaration', field_type: 'textarea', is_required: false, sort_order: 36 },

  // Section 3 — Care Experience
  { slug: 'previous_care_experience',    label: 'Has previous care experience',    field_type: 'checkbox', is_required: false, sort_order: 41 },
  { slug: 'care_experience_details',     label: 'Care experience details',         field_type: 'textarea', is_required: false, sort_order: 42 },
  { slug: 'preferred_work_setting',      label: 'Preferred work setting',          field_type: 'text',     is_required: false, sort_order: 43 },
  { slug: 'available_start_date',        label: 'Available start date',            field_type: 'date',     is_required: false, sort_order: 44 },

  // Section 3 — Training and Qualifications (stored as single JSONB object)
  { slug: 'training_qualifications',     label: 'Training & Qualifications',       field_type: 'textarea', is_required: false, sort_order: 45 },

  // Section — Professional Qualifications (stored as single JSONB array)
  { slug: 'professional_qualifications', label: 'Professional Qualifications',     field_type: 'textarea', is_required: false, sort_order: 46 },

  // Section — Professional Registration (stored as single JSONB array)
  { slug: 'professional_registration',   label: 'Professional Registration',       field_type: 'textarea', is_required: false, sort_order: 47 },

  // Section — Application Source (stored as single JSONB object)
  { slug: 'application_source',          label: 'Source',                          field_type: 'textarea', is_required: false, sort_order: 48 },

  // Section — Medical History (stored as single JSONB object)
  { slug: 'medical_history',             label: 'Medical History',                 field_type: 'textarea', is_required: false, sort_order: 49 },

  // Section — Work Availability (stored as single JSONB object)
  { slug: 'work_availability',           label: 'Work Availability',               field_type: 'textarea', is_required: false, sort_order: 50 },

  // Section 3 — Emergency Contact
  { slug: 'emergency_contact_name',      label: 'Emergency contact — Full name',   field_type: 'text',     is_required: true,  sort_order: 51 },
  { slug: 'emergency_contact_relationship', label: 'Emergency contact — Relationship', field_type: 'text', is_required: false, sort_order: 52 },
  { slug: 'emergency_contact_phone',     label: 'Emergency contact — Phone',       field_type: 'phone',    is_required: true,  sort_order: 53 },
  { slug: 'emergency_contact_email',     label: 'Emergency contact — Email',       field_type: 'email',    is_required: false, sort_order: 54 },

  // Section — Declaration & Consent (stored as single JSONB object)
  { slug: 'declaration_consent',        label: 'Declaration & Consent',           field_type: 'textarea', is_required: true,  sort_order: 61 },

  // Section — Application Declarations (stored as single JSONB object)
  { slug: 'application_declarations',   label: 'Declarations',                    field_type: 'textarea', is_required: true,  sort_order: 62 },
] as const

type FieldSlug = (typeof FIELD_DEFS)[number]['slug']

export async function POST(request: NextRequest) {
  let body: { token?: unknown; answers?: unknown; submit?: unknown }

  try {
    body = await request.json() as { token?: unknown; answers?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { token, answers, submit } = body
  const isSubmit = submit === true

  if (typeof token !== 'string' || !token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 })
  }

  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return NextResponse.json({ error: 'Answers are required' }, { status: 400 })
  }

  const typedAnswers = answers as Record<string, unknown>

  // ── 1. Validate token ───────────────────────────────────────────────────────

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

  const { data: applicant, error: lookupError } = await adminClient
    .from('applicants')
    .select('id, company_id, status, token_expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (lookupError) {
    console.error('[apply] token lookup failed:', lookupError)
    return NextResponse.json({ error: 'Could not validate token' }, { status: 500 })
  }
  if (!applicant) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }
  if (!applicant.token_expires_at || new Date(applicant.token_expires_at as string) < new Date()) {
    return NextResponse.json({ error: 'Token has expired' }, { status: 410 })
  }
  if (applicant.status === 'hired' || applicant.status === 'withdrawn') {
    return NextResponse.json({ error: 'Application is no longer active' }, { status: 409 })
  }

  const companyId = applicant.company_id as string
  const applicantId = applicant.id as string

  // ── 2. Ensure form exists (idempotent) ──────────────────────────────────────

  await adminClient
    .from('forms')
    .upsert(
      { company_id: companyId, name: FORM_NAME, is_template: false },
      { onConflict: 'company_id,name', ignoreDuplicates: true },
    )

  const { data: form, error: formError } = await adminClient
    .from('forms')
    .select('id')
    .eq('company_id', companyId)
    .eq('name', FORM_NAME)
    .single()

  if (formError || !form) {
    console.error('[apply] form lookup failed:', formError)
    return NextResponse.json({ error: 'Could not initialise form' }, { status: 500 })
  }

  const formId = form.id as string

  // ── 3. Ensure form fields exist (idempotent via slug constraint) ────────────

  const fieldInserts = FIELD_DEFS.map(f => ({
    form_id:        formId,
    slug:           f.slug,
    label:          f.label,
    field_type:     f.field_type,
    is_required:    f.is_required,
    sort_order:     f.sort_order,
    include_in_pdf: true,
  }))

  // Task 1: ignoreDuplicates: false ensures existing rows are updated (not skipped)
  const { error: upsertFieldsError } = await adminClient
    .from('form_fields')
    .upsert(fieldInserts, { onConflict: 'form_id,slug', ignoreDuplicates: false })
  if (upsertFieldsError) {
    console.error('[apply] form_fields upsert failed:', upsertFieldsError)
  } else {
    console.log('[apply] form_fields upsert OK, inserted/updated', fieldInserts.length, 'fields')
  }

  // Task 2: Remove any stale form_fields that are no longer in FIELD_DEFS
  // Must delete form_answers referencing stale fields first (FK constraint)
  const validSlugs = FIELD_DEFS.map(f => f.slug) as string[]
  const { data: staleFields } = await adminClient
    .from('form_fields')
    .select('id')
    .eq('form_id', formId)
    .not('slug', 'in', `(${validSlugs.join(',')})`)

  if (staleFields && staleFields.length > 0) {
    const staleIds = staleFields.map(f => f.id as string)
    // Delete answers that reference stale fields (across all responses for this form)
    await adminClient
      .from('form_answers')
      .delete()
      .in('field_id', staleIds)
    // Now safe to delete the stale fields
    const { error: deleteStaleError } = await adminClient
      .from('form_fields')
      .delete()
      .in('id', staleIds)
    if (deleteStaleError) {
      console.error('[apply] stale field cleanup failed:', deleteStaleError)
    } else {
      console.log('[apply] stale field cleanup OK — removed', staleIds.length, 'stale fields')
    }
  } else {
    console.log('[apply] no stale fields to remove')
  }

  const { data: fields, error: fieldsError } = await adminClient
    .from('form_fields')
    .select('id, slug')
    .eq('form_id', formId)
    .not('slug', 'is', null)

  if (fieldsError || !fields) {
    console.error('[apply] fields lookup failed:', fieldsError)
    return NextResponse.json({ error: 'Could not load form fields' }, { status: 500 })
  }

  // ── 4. Upsert form response ─────────────────────────────────────────────────

  const { data: response, error: responseError } = await adminClient
    .from('form_responses')
    .upsert(
      { company_id: companyId, form_id: formId, applicant_id: applicantId },
      { onConflict: 'form_id,applicant_id' },
    )
    .select('id')
    .single()

  if (responseError || !response) {
    console.error('[apply] form_response upsert failed:', responseError)
    return NextResponse.json({ error: 'Could not save response' }, { status: 500 })
  }

  const responseId = response.id as string

  // ── 5. Upsert form answers ──────────────────────────────────────────────────

  const answerRecords = fields
    .filter((f): f is { id: string; slug: FieldSlug } => typeof f.slug === 'string')
    .map(f => {
      const raw = typedAnswers[f.slug]
      // Objects and arrays (e.g. training_qualifications) are stored as raw JSONB.
      // Primitive values are wrapped in { text } for consistency with the rest of the form.
      const value =
        raw !== null && typeof raw === 'object'
          ? raw
          : { text: typeof raw === 'string' ? raw : '' }
      return { response_id: responseId, field_id: f.id as string, value }
    })

  const { error: answersError } = await adminClient
    .from('form_answers')
    .upsert(answerRecords, { onConflict: 'response_id,field_id' })

  if (answersError) {
    console.error('[apply] form_answers upsert failed:', answersError)
    return NextResponse.json({ error: 'Could not save answers' }, { status: 500 })
  }

  // ── 6. If submitting, mark form_response as submitted ──────────────────────

  if (isSubmit) {
    const { error: submitError } = await adminClient
      .from('form_responses')
      .update({ status: 'submitted', submitted_at: new Date().toISOString() })
      .eq('id', responseId)

    if (submitError) {
      console.error('[apply] submit status update failed:', submitError)
      return NextResponse.json({ error: 'Could not mark application as submitted' }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true, response_id: responseId, submitted: isSubmit })
}
