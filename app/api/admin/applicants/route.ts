import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'

// TODO: RESTORE AUTH — remove DEV_BYPASS_AUTH before deploying or merging to main.
const DEV_BYPASS_AUTH = process.env.NODE_ENV === 'development'

export async function GET() {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  // DEV_BYPASS_AUTH: skip session check in development.
  // To restore: validate the session from the request cookie and confirm admin role.
  if (!DEV_BYPASS_AUTH) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Fetch applicants with their latest form_response status ──────────────────
  const { data, error } = await adminClient
    .from('applicants')
    .select(
      `id,
       first_name,
       last_name,
       email,
       job_role,
       status,
       created_at,
       form_responses ( status, submitted_at )`
    )
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[admin/applicants] fetch failed:', error)
    return NextResponse.json({ error: 'Failed to fetch applicants' }, { status: 500 })
  }

  const applicants = (data ?? []).map((row) => {
    // form_responses is an array (one-to-many); take the first entry if present
    const responses = row.form_responses as Array<{ status: string; submitted_at: string | null }> | null
    const formResponse = responses && responses.length > 0 ? responses[0] : null

    return {
      id:              row.id,
      first_name:      row.first_name,
      last_name:       row.last_name,
      email:           row.email,
      job_role:        row.job_role,
      status:          row.status,
      created_at:      row.created_at,
      form_status:     formResponse?.status ?? null,
      submitted_at:    formResponse?.submitted_at ?? null,
    }
  })

  return NextResponse.json(applicants)
}
