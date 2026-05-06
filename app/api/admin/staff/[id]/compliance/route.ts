import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { calculateCompliance } from '@/lib/compliance/calculateCompliance'

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

  // ── Fetch staff profile ────────────────────────────────────────────────────
  const { data: staffProfile, error: spError } = await adminClient
    .from('staff_profiles')
    .select('id, applicant_id, company_id')
    .eq('id', id)
    .maybeSingle()

  if (spError) {
    console.error('[staff/compliance] fetch staff_profile error:', spError.message)
    return NextResponse.json(
      { error: 'Failed to fetch staff profile', supabase_message: spError.message },
      { status: 500 }
    )
  }

  if (!staffProfile) {
    return NextResponse.json({ error: 'Staff profile not found' }, { status: 404 })
  }

  // ── Fetch documents (via applicant_id) ────────────────────────────────────
  let documents: { id: string; document_type: string; file_name: string; expiry_date: string | null }[] = []
  if (staffProfile.applicant_id) {
    const { data, error } = await adminClient
      .from('documents')
      .select('id, document_type, file_name, expiry_date')
      .eq('applicant_id', staffProfile.applicant_id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[staff/compliance] fetch documents error:', error.message)
    } else {
      documents = data ?? []
    }
  }

  // ── Compute compliance ────────────────────────────────────────────────────
  const summary = calculateCompliance(documents)

  return NextResponse.json({ summary, documents })
}
