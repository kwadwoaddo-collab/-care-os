import { NextRequest, NextResponse } from 'next/server'
import { adminClient }         from '@/lib/supabase/admin'
import { requireAdmin }        from '@/lib/auth/requireAdmin'
import { getComplianceTimeline } from '@/lib/staff/getComplianceTimeline'

// ── GET /api/admin/compliance/timeline?staffProfileId=xxx ─────────────────────

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const staffProfileId = request.nextUrl.searchParams.get('staffProfileId')
  if (!staffProfileId) {
    return NextResponse.json({ error: 'staffProfileId is required' }, { status: 400 })
  }

  // Verify this staff member belongs to the admin's company
  const { data: sp, error: spErr } = await adminClient
    .from('staff_profiles')
    .select('id, applicant_id')
    .eq('id', staffProfileId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (spErr || !sp) {
    return NextResponse.json({ error: 'Staff profile not found' }, { status: 404 })
  }

  const events = await getComplianceTimeline(staffProfileId, sp.applicant_id as string | null)
  return NextResponse.json({ events })
}
