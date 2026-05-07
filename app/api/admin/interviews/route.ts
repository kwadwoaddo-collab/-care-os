import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const { searchParams } = new URL(request.url)
  const applicantId = searchParams.get('applicant_id')

  if (!applicantId) {
    return NextResponse.json({ error: 'applicant_id query param required' }, { status: 400 })
  }

  const { data, error } = await adminClient
    .from('interviews')
    .select('id, applicant_id, company_id, scheduled_at, interview_type, status, notes, score, recommendation, created_at')
    .eq('applicant_id', applicantId)
    .eq('company_id', companyId)
    .order('scheduled_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[admin/interviews] fetch failed:', error)
    return NextResponse.json({ error: 'Failed to fetch interviews' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { applicant_id, scheduled_at, interview_type, interviewer_name, location } = body

  if (!applicant_id || typeof applicant_id !== 'string') {
    return NextResponse.json({ error: 'applicant_id is required' }, { status: 422 })
  }

  // ── Fetch applicant (required for company_id + 404 guard) ─────────────────
  const { data: applicant, error: applicantError } = await adminClient
    .from('applicants')
    .select('id, company_id')
    .eq('id', applicant_id)
    .maybeSingle()

  if (applicantError) {
    console.error('[admin/interviews] applicant lookup failed:', applicantError)
    return NextResponse.json({ error: 'Failed to look up applicant' }, { status: 500 })
  }
  if (!applicant) {
    return NextResponse.json({ error: 'Applicant not found' }, { status: 404 })
  }

  // ── Create interview row ───────────────────────────────────────────────────
  const { data: interview, error: insertError } = await adminClient
    .from('interviews')
    .insert({
      applicant_id,
      company_id:       applicant.company_id,
      scheduled_at:     scheduled_at ?? null,
      interview_type:   interview_type ?? null,
      interviewer_name: interviewer_name ?? null,
      location:         location ?? null,
      outcome:          'pending',
    })
    .select('*')
    .single()

  if (insertError || !interview) {
    console.error('[admin/interviews] insert failed — full error:', {
      message: insertError?.message,
      code:    insertError?.code,
      details: insertError?.details,
      hint:    insertError?.hint,
    })
    return NextResponse.json(
      { error: insertError?.message ?? 'Failed to create interview' },
      { status: 500 }
    )
  }

  // ── Update applicant status → interview_scheduled ──────────────────────────
  const { error: statusError } = await adminClient
    .from('applicants')
    .update({ status: 'interview_scheduled', updated_at: new Date().toISOString() })
    .eq('id', applicant_id)

  if (statusError) {
    console.error('[admin/interviews] applicant status update failed:', statusError)
    // Non-fatal — interview was created; log and continue
  }

  // ── Audit log (fire-and-forget) ────────────────────────────────────────────
  if (applicant) {
    void (async () => {
      try {
        const { error } = await adminClient
          .from('audit_logs')
          .insert({
            company_id:  applicant.company_id as string,
            actor_id:    null,
            action:      'applicant.interview_scheduled',
            entity_type: 'applicant',
            entity_id:   applicant_id,
            metadata: {
              interview_id: interview.id,
              scheduled_at,
              timestamp:    new Date().toISOString(),
            },
          })
        if (error) console.error('[admin/interviews] audit log failed:', error)
      } catch (err) {
        console.error('[admin/interviews] audit log unexpected error:', err)
      }
    })()
  }

  return NextResponse.json({ interview }, { status: 201 })
}
