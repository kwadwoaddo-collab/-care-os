import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'

// TODO: RESTORE AUTH — remove DEV_BYPASS_AUTH before deploying or merging to main.
const DEV_BYPASS_AUTH = process.env.NODE_ENV === 'development'

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
  // ── Auth ─────────────────────────────────────────────────────────────────────
  // DEV_BYPASS_AUTH: skip session check in development.
  // To restore: validate the session from the request cookie and confirm admin role.
  if (!DEV_BYPASS_AUTH) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // ── Parse body ───────────────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { status } = body

  if (!isAllowedStatus(status)) {
    return NextResponse.json(
      { error: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(', ')}` },
      { status: 422 }
    )
  }

  // ── Update applicant status ───────────────────────────────────────────────────
  const { data: applicant, error: updateError } = await adminClient
    .from('applicants')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, first_name, last_name, email, job_role, status, company_id, created_at, updated_at')
    .maybeSingle()

  if (updateError) {
    console.error('[admin/applicants/[id]/status] update failed:', updateError)
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
  }
  if (!applicant) {
    return NextResponse.json({ error: 'Applicant not found' }, { status: 404 })
  }

  // ── Audit log (fire-and-forget) ──────────────────────────────────────────────
  // Writes to audit_logs if the table exists. The insert is intentionally not
  // awaited so a logging failure never blocks the response.
  const action = `applicant.${status}` as string
  void (async () => {
    try {
      const { error } = await adminClient
        .from('audit_logs')
        .insert({
          company_id:  applicant.company_id as string,
          actor_id:    null, // TODO: replace with session user id once auth is restored
          action,
          entity_type: 'applicant',
          entity_id:   applicant.id as string,
          metadata: {
            status,
            applicant_id: applicant.id,
            timestamp:    new Date().toISOString(),
          },
        })
      if (error) console.error('[admin/applicants/[id]/status] audit log failed:', error)
    } catch (err) {
      console.error('[admin/applicants/[id]/status] audit log unexpected error:', err)
    }
  })()

  return NextResponse.json({ applicant })
}
