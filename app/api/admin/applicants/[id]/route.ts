import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/rbac/permissions'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const { id } = await params

  // ── 1. Fetch applicant row ───────────────────────────────────────────────────
  const { data: applicant, error: applicantError } = await adminClient
    .from('applicants')
    .select('*')
    .eq('id', id)
    .eq('company_id', companyId)
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId, userId, role } = auth.ctx

  if (!can(role, 'applicants:delete')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { id } = await params

  // Only rejected applicants can be permanently deleted
  const { data: existing, error: fetchError } = await adminClient
    .from('applicants')
    .select('id, status, company_id, first_name, last_name')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (fetchError) {
    console.error('[admin/applicants/[id]] DELETE fetch failed:', fetchError)
    return NextResponse.json({ error: 'Failed to fetch applicant' }, { status: 500 })
  }
  if (!existing) {
    return NextResponse.json({ error: 'Applicant not found' }, { status: 404 })
  }
  if (existing.status !== 'rejected') {
    return NextResponse.json({ error: 'Only rejected applicants can be permanently deleted' }, { status: 422 })
  }

  // Attempt soft delete if deleted_at is available, fallback to hard delete
  const { error: softDeleteError } = await adminClient
    .from('applicants')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', companyId)

  if (softDeleteError) {
    console.warn('[admin/applicants/[id]] Soft delete failed, falling back to hard delete. Error:', softDeleteError)
    const { error: hardDeleteError } = await adminClient
      .from('applicants')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId)

    if (hardDeleteError) {
      console.error('[admin/applicants/[id]] DELETE hard-delete failed:', hardDeleteError)
      return NextResponse.json({ error: 'Failed to delete applicant' }, { status: 500 })
    }
  }

  // Audit log (fire-and-forget)
  void (async () => {
    try {
      const { error } = await adminClient
        .from('audit_logs')
        .insert({
          company_id:  companyId,
          actor_id:    userId === 'dev-admin' ? null : userId,
          action:      'applicant.permanently_deleted',
          entity_type: 'applicant',
          entity_id:   id,
          metadata: {
            first_name: existing.first_name,
            last_name:  existing.last_name,
            timestamp:  new Date().toISOString(),
          },
        })
      if (error) console.error('[admin/applicants/[id]] DELETE audit log failed:', error)
    } catch (err) {
      console.error('[admin/applicants/[id]] DELETE audit log unexpected error:', err)
    }
  })()

  return NextResponse.json({ success: true })
}
