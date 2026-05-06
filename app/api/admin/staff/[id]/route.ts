import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'

// TODO: RESTORE AUTH — remove DEV_BYPASS_AUTH before deploying or merging to main.
const DEV_BYPASS_AUTH = process.env.NODE_ENV === 'development'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!DEV_BYPASS_AUTH) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // ── Staff profile ──────────────────────────────────────────────────────────
  const { data: staffProfile, error: spError } = await adminClient
    .from('staff_profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (spError) {
    console.error('[admin/staff/[id]] fetch error:', spError.message)
    return NextResponse.json(
      { error: 'Failed to fetch staff profile', supabase_message: spError.message },
      { status: 500 }
    )
  }

  if (!staffProfile) {
    return NextResponse.json({ error: 'Staff profile not found' }, { status: 404 })
  }

  // ── Linked applicant (if any) ──────────────────────────────────────────────
  let applicant: Record<string, unknown> | null = null
  if (staffProfile.applicant_id) {
    const { data } = await adminClient
      .from('applicants')
      .select('id, first_name, last_name, email, phone, job_role, status, created_at')
      .eq('id', staffProfile.applicant_id)
      .maybeSingle()
    applicant = data ?? null
  }

  // ── Documents linked to applicant ─────────────────────────────────────────
  let documents: unknown[] = []
  if (staffProfile.applicant_id) {
    const { data } = await adminClient
      .from('documents')
      .select('id, document_type, file_name, file_path, file_size, mime_type, expiry_date, created_at')
      .eq('applicant_id', staffProfile.applicant_id)
      .order('created_at', { ascending: false })
    documents = data ?? []
  }

  // ── Compliance items (if any) ─────────────────────────────────────────────
  const { data: complianceItems } = await adminClient
    .from('compliance_items')
    .select('id, item_type, status, expires_at, completed_at, notes')
    .eq('staff_profile_id', id)
    .order('item_type')

  return NextResponse.json({
    staff_profile:    staffProfile,
    applicant,
    documents,
    compliance_items: complianceItems ?? [],
  })
}
