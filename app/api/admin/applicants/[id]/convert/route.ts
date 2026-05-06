import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'

// TODO: RESTORE AUTH — remove DEV_BYPASS_AUTH before deploying or merging to main.
const DEV_BYPASS_AUTH = process.env.NODE_ENV === 'development'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!DEV_BYPASS_AUTH) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: applicantId } = await params

  // ── 1. Fetch applicant ─────────────────────────────────────────────────────
  const { data: applicant, error: applicantError } = await adminClient
    .from('applicants')
    .select('id, company_id, first_name, last_name, email, phone, job_role, status')
    .eq('id', applicantId)
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
    return NextResponse.json({ staff_profile: existing, already_converted: true }, { status: 200 })
  }

  // ── 3. Create staff profile ────────────────────────────────────────────────
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

  // ── 4. Update applicant status → hired ────────────────────────────────────
  const { error: statusError } = await adminClient
    .from('applicants')
    .update({ status: 'hired', updated_at: new Date().toISOString() })
    .eq('id', applicantId)

  if (statusError) {
    // Non-fatal: staff profile created; log and continue
    console.error('[convert] update applicant status error:', statusError.message)
  }

  // ── 5. Audit logs (fire-and-forget) ───────────────────────────────────────
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
          metadata:    { staff_profile_id: staffProfile.id, timestamp: now },
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
