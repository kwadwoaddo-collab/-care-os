import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'

// TODO: RESTORE AUTH — remove DEV_BYPASS_AUTH before deploying or merging to main.
const DEV_BYPASS_AUTH = process.env.NODE_ENV === 'development'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  if (!DEV_BYPASS_AUTH) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // ── 1. Fetch applicant row ───────────────────────────────────────────────────
  const { data: applicant, error: applicantError } = await adminClient
    .from('applicants')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (applicantError) {
    console.error('[admin/applicants/[id]] applicant fetch failed:', applicantError)
    return NextResponse.json({ error: 'Failed to fetch applicant' }, { status: 500 })
  }
  if (!applicant) {
    return NextResponse.json({ error: 'Applicant not found' }, { status: 404 })
  }

  // ── 2. Fetch form_response ───────────────────────────────────────────────────
  const { data: response, error: responseError } = await adminClient
    .from('form_responses')
    .select('id, status, submitted_at, created_at, updated_at')
    .eq('applicant_id', id)
    .maybeSingle()

  if (responseError) {
    console.error('[admin/applicants/[id]] response fetch failed:', responseError)
    return NextResponse.json({ error: 'Failed to fetch form response' }, { status: 500 })
  }

  // ── 3. If no response yet, return with empty answers ────────────────────────
  if (!response) {
    return NextResponse.json({ applicant, response: null, answers: {} })
  }

  // ── 4. Fetch answers joined with field slugs ─────────────────────────────────
  const { data: rawAnswers, error: answersError } = await adminClient
    .from('form_answers')
    .select('value, form_fields ( slug, label, field_type, sort_order )')
    .eq('response_id', response.id)

  if (answersError) {
    console.error('[admin/applicants/[id]] answers fetch failed:', answersError)
    return NextResponse.json({ error: 'Failed to fetch answers' }, { status: 500 })
  }

  // ── 5. Build { slug: value } map ─────────────────────────────────────────────
  // value column is JSONB — primitive answers are stored as { text: "..." } or
  // { checked: true/false }; complex answers (JSONB objects/arrays) are stored raw.
  type RawAnswer = {
    value: Record<string, unknown> | null
    form_fields: {
      slug: string
      label: string
      field_type: string
      sort_order: number
    } | null
  }

  const answers: Record<string, unknown> = {}
  for (const row of (rawAnswers ?? []) as unknown as RawAnswer[]) {
    const field = row.form_fields
    if (!field?.slug) continue
    // Unwrap primitive wrappers so the UI receives clean values
    const val = row.value
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      if ('text' in val) {
        answers[field.slug] = val.text
      } else if ('checked' in val) {
        answers[field.slug] = val.checked
      } else {
        // Complex JSONB (employment_history, references, criminal_record, etc.)
        answers[field.slug] = val
      }
    } else {
      answers[field.slug] = val
    }
  }

  return NextResponse.json({ applicant, response, answers })
}
