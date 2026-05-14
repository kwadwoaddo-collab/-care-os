import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'

const ALLOWED_STATUSES = [
  'applied',
  'shortlisted',
  'interview_scheduled',
  'rejected',
  'hired',
] as const

type AllowedStatus = (typeof ALLOWED_STATUSES)[number]

function isAllowedStatus(value: unknown): value is AllowedStatus {
  return typeof value === 'string' && (ALLOWED_STATUSES as readonly string[]).includes(value)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId, userId } = auth.ctx

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { status, rejection_reason, rejection_notes } = body

  if (!isAllowedStatus(status)) {
    return NextResponse.json(
      { error: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(', ')}` },
      { status: 422 }
    )
  }

  // Build the update payload
  const updatePayload: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (status === 'rejected') {
    // We cannot update missing database columns. Just put reason in audit log metadata.
  }

  const { data: applicant, error: updateError } = await adminClient
    .from('applicants')
    .update(updatePayload)
    .eq('id', id)
    .eq('company_id', companyId)
    .select('id, first_name, last_name, email, job_role, status, company_id, created_at, updated_at')
    .maybeSingle()

  if (updateError) {
    console.error('[admin/applicants/[id]/status] update failed:', updateError)
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
  }
  if (!applicant) {
    return NextResponse.json({ error: 'Applicant not found' }, { status: 404 })
  }

  // Audit log (fire-and-forget)
  void (async () => {
    try {
      const { error } = await adminClient
        .from('audit_logs')
        .insert({
          company_id:  applicant.company_id as string,
          actor_id:    userId === 'dev-admin' ? null : userId,
          action:      `applicant.${status}`,
          entity_type: 'applicant',
          entity_id:   applicant.id as string,
          metadata: {
            status,
            applicant_id:     applicant.id,
            rejection_reason: typeof rejection_reason === 'string' ? rejection_reason.trim() || null : null,
            timestamp:        new Date().toISOString(),
          },
        })
      if (error) console.error('[admin/applicants/[id]/status] audit log failed:', error)
    } catch (err) {
      console.error('[admin/applicants/[id]/status] audit log unexpected error:', err)
    }
  })()

  return NextResponse.json({ applicant })
}
