import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { calculateCompliance } from '@/lib/compliance/calculateCompliance'
import { getStaffDocuments } from '@/lib/staff/getStaffDocuments'

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

  // ── Fetch documents from both sources ─────────────────────────────────────
  const documents = await getStaffDocuments(staffProfile.id, staffProfile.applicant_id as string | null)

  // ── Compute compliance ────────────────────────────────────────────────────
  const summary = calculateCompliance(documents)

  return NextResponse.json({ summary, documents })
}
