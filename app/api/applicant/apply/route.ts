import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { adminClient } from '@/lib/supabase/admin'

const FORM_NAME = 'Application: Personal Details'

const FIELD_DEFS = [
  // Section 1 — Personal Details
  { slug: 'first_name',                label: 'First name',                    field_type: 'text',     is_required: true,  sort_order: 1  },
  { slug: 'last_name',                 label: 'Last name',                     field_type: 'text',     is_required: true,  sort_order: 2  },
  { slug: 'email',                     label: 'Email',                         field_type: 'email',    is_required: true,  sort_order: 3  },
  { slug: 'phone',                     label: 'Phone',                         field_type: 'phone',    is_required: false, sort_order: 4  },
  { slug: 'job_role',                  label: 'Job role',                      field_type: 'text',     is_required: false, sort_order: 5  },
  { slug: 'address_line_1',            label: 'Address line 1',                field_type: 'text',     is_required: true,  sort_order: 6  },
  { slug: 'address_line_2',            label: 'Address line 2',                field_type: 'text',     is_required: false, sort_order: 7  },
  { slug: 'town_city',                 label: 'Town / City',                   field_type: 'text',     is_required: true,  sort_order: 8  },
  { slug: 'postcode',                  label: 'Postcode',                      field_type: 'text',     is_required: true,  sort_order: 9  },
  { slug: 'date_of_birth',             label: 'Date of birth',                 field_type: 'date',     is_required: true,  sort_order: 10 },
  { slug: 'national_insurance',        label: 'National Insurance number',     field_type: 'text',     is_required: true,  sort_order: 11 },

  // Section 2 — Employment History
  { slug: 'current_employer',          label: 'Current or most recent employer', field_type: 'text',   is_required: false, sort_order: 12 },
  { slug: 'current_job_title',         label: 'Job title',                     field_type: 'text',     is_required: false, sort_order: 13 },
  { slug: 'employment_start_date',     label: 'Start date',                    field_type: 'date',     is_required: false, sort_order: 14 },
  { slug: 'employment_end_date',       label: 'End date',                      field_type: 'date',     is_required: false, sort_order: 15 },
  { slug: 'reason_for_leaving',        label: 'Reason for leaving',            field_type: 'textarea', is_required: false, sort_order: 16 },
  { slug: 'employment_gaps',           label: 'Gaps in employment',            field_type: 'textarea', is_required: false, sort_order: 17 },
  { slug: 'employment_gap_explanation',label: 'Explanation of gaps',           field_type: 'textarea', is_required: false, sort_order: 18 },

  // Section 2 — Reference 1
  { slug: 'reference_1_name',          label: 'Reference 1 — Full name',       field_type: 'text',     is_required: true,  sort_order: 19 },
  { slug: 'reference_1_position',      label: 'Reference 1 — Position',        field_type: 'text',     is_required: false, sort_order: 20 },
  { slug: 'reference_1_company',       label: 'Reference 1 — Company',         field_type: 'text',     is_required: false, sort_order: 21 },
  { slug: 'reference_1_email',         label: 'Reference 1 — Email',           field_type: 'email',    is_required: true,  sort_order: 22 },
  { slug: 'reference_1_phone',         label: 'Reference 1 — Phone',           field_type: 'phone',    is_required: false, sort_order: 23 },
  { slug: 'reference_1_relationship',  label: 'Reference 1 — Relationship',    field_type: 'text',     is_required: false, sort_order: 24 },

  // Section 2 — Reference 2
  { slug: 'reference_2_name',          label: 'Reference 2 — Full name',       field_type: 'text',     is_required: true,  sort_order: 25 },
  { slug: 'reference_2_position',      label: 'Reference 2 — Position',        field_type: 'text',     is_required: false, sort_order: 26 },
  { slug: 'reference_2_company',       label: 'Reference 2 — Company',         field_type: 'text',     is_required: false, sort_order: 27 },
  { slug: 'reference_2_email',         label: 'Reference 2 — Email',           field_type: 'email',    is_required: true,  sort_order: 28 },
  { slug: 'reference_2_phone',         label: 'Reference 2 — Phone',           field_type: 'phone',    is_required: false, sort_order: 29 },
  { slug: 'reference_2_relationship',  label: 'Reference 2 — Relationship',    field_type: 'text',     is_required: false, sort_order: 30 },
] as const

type FieldSlug = (typeof FIELD_DEFS)[number]['slug']

export async function POST(request: NextRequest) {
  let body: { token?: unknown; answers?: unknown }

  try {
    body = await request.json() as { token?: unknown; answers?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { token, answers } = body

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

  await adminClient
    .from('form_fields')
    .upsert(fieldInserts, { onConflict: 'form_id,slug', ignoreDuplicates: true })

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
    .map(f => ({
      response_id: responseId,
      field_id:    f.id as string,
      value:       { text: typeof typedAnswers[f.slug] === 'string' ? typedAnswers[f.slug] : '' },
    }))

  const { error: answersError } = await adminClient
    .from('form_answers')
    .upsert(answerRecords, { onConflict: 'response_id,field_id' })

  if (answersError) {
    console.error('[apply] form_answers upsert failed:', answersError)
    return NextResponse.json({ error: 'Could not save answers' }, { status: 500 })
  }

  return NextResponse.json({ success: true, response_id: responseId })
}
