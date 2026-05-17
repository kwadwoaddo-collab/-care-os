import { NextRequest, NextResponse } from 'next/server'
import { adminClient }           from '@/lib/supabase/admin'
import { requireAdmin }          from '@/lib/auth/requireAdmin'
import { can }                   from '@/lib/auth/permissions'
import { forbidden }             from '@/lib/auth/responses'
import { calculateCompliance }   from '@/lib/compliance/calculateCompliance'
import { getStaffDocuments }     from '@/lib/staff/getStaffDocuments'
import { explainCompliance }     from '@/lib/compliance/explainability'
import { getRequiredTraining }   from '@/lib/training/matrix'
import { REQUIRED_TRAINING }     from '@/lib/compliance/requirements'

// ── GET /api/admin/staff/[id]/compliance/explain ──────────────────────────────
//
// Returns a human-readable compliance reason breakdown for a staff member.
// Used by the "Why?" drill-down modal in the compliance dashboard and
// the staff profile compliance section.

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'compliance:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const { id } = await params

  // Fetch staff profile (scoped to company)
  const { data: staff, error: spErr } = await adminClient
    .from('staff_profiles')
    .select('id, applicant_id, job_role, status, non_compliant_since')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (spErr || !staff) {
    return NextResponse.json({ error: 'Staff profile not found' }, { status: 404 })
  }

  // Fetch all documents
  const documents = await getStaffDocuments(
    staff.id,
    staff.applicant_id as string | null
  )

  const jobRole = (staff.job_role as string | null) ?? null

  // Calculate compliance (role-aware)
  const summary = calculateCompliance(documents, jobRole)

  const requiredTrainingCategories: string[] = jobRole
    ? getRequiredTraining(jobRole)
    : [...REQUIRED_TRAINING]

  // Generate explanation
  const breakdown = explainCompliance(summary, documents, requiredTrainingCategories)

  // Fetch active override (if any)
  const now = new Date().toISOString()
  const { data: override } = await adminClient
    .from('compliance_overrides')
    .select('id, reason, expires_at, created_at, overridden_by')
    .eq('company_id', companyId)
    .eq('staff_profile_id', id)
    .is('revoked_at', null)
    .gt('expires_at', now)
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({
    staffId:    staff.id,
    jobRole,
    status:     staff.status,
    breakdown,
    activeOverride: override ?? null,
    nonCompliantSince: (staff.non_compliant_since as string | null) ?? null,
  })
}
