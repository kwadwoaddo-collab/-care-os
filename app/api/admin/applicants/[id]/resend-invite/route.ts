import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { adminClient } from '@/lib/supabase/admin'
import { sendInviteEmail } from '@/lib/email/resend'

// TODO: RESTORE AUTH — remove DEV_BYPASS_AUTH before deploying or merging to main.
const DEV_BYPASS_AUTH = process.env.NODE_ENV === 'development'

const TERMINAL_STATUSES = ['hired', 'rejected', 'withdrawn']

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!DEV_BYPASS_AUTH) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Resolve admin profile for audit log
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, role, company_id')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle()

  if (profileError || !profile) {
    return NextResponse.json(
      { error: 'Dev bypass: no admin profile found in database' },
      { status: 500 }
    )
  }

  const { id } = await params

  // Fetch applicant + their form response status
  const { data: applicant, error: fetchError } = await adminClient
    .from('applicants')
    .select('id, email, first_name, last_name, job_role, status, company_id, form_responses(status)')
    .eq('id', id)
    .eq('company_id', profile.company_id)
    .maybeSingle()

  if (fetchError) {
    console.error('[resend-invite] fetch failed:', fetchError)
    return NextResponse.json({ error: 'Failed to fetch applicant' }, { status: 500 })
  }
  if (!applicant) {
    return NextResponse.json({ error: 'Applicant not found' }, { status: 404 })
  }

  if (TERMINAL_STATUSES.includes(applicant.status)) {
    return NextResponse.json(
      { error: `Cannot resend invite — applicant is ${applicant.status}` },
      { status: 409 }
    )
  }

  const formResponses = applicant.form_responses as Array<{ status: string }> | null
  const formStatus = formResponses && formResponses.length > 0 ? formResponses[0].status : null

  if (formStatus === 'submitted') {
    return NextResponse.json(
      { error: 'Application already submitted — no invite needed' },
      { status: 409 }
    )
  }

  // Generate new token
  const rawToken       = crypto.randomBytes(32).toString('hex')
  const tokenHash      = crypto.createHash('sha256').update(rawToken).digest('hex')
  const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { error: updateError } = await adminClient
    .from('applicants')
    .update({ token_hash: tokenHash, token_expires_at: tokenExpiresAt })
    .eq('id', applicant.id)

  if (updateError) {
    console.error('[resend-invite] token update failed:', updateError)
    return NextResponse.json({ error: 'Failed to update invite token' }, { status: 500 })
  }

  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const magicLink = `${appUrl}/portal/apply?token=${rawToken}`

  // Audit log — fire-and-forget
  adminClient.from('audit_logs').insert({
    company_id:  profile.company_id,
    actor_id:    profile.id,
    action:      'applicant.invite_resent',
    entity_type: 'applicant',
    entity_id:   applicant.id,
    metadata:    { email: applicant.email },
  })

  // Send email — fire-and-forget
  sendInviteEmail({
    to:        applicant.email,
    firstName: applicant.first_name ?? '',
    jobRole:   applicant.job_role ?? '',
    magicLink,
    expiresAt: tokenExpiresAt,
  }).then((result) => {
    if (!result.success) {
      console.error('[resend-invite] email send failed:', result.error)
    }
  }).catch((err) => {
    console.error('[resend-invite] unexpected email error:', err)
  })

  return NextResponse.json({ magic_link: magicLink, expires_at: tokenExpiresAt })
}
