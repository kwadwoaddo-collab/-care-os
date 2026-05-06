import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { adminClient } from '@/lib/supabase/admin'
import { sendInviteEmail } from '@/lib/email/resend'

// TODO: RESTORE AUTH — remove DEV_BYPASS_AUTH before deploying or merging to main.
const DEV_BYPASS_AUTH = process.env.NODE_ENV === 'development'

export async function POST(request: NextRequest) {
  // -------------------------------------------------------------------------
  // AUTH — temporarily bypassed for local development
  // To restore: remove the DEV_BYPASS_AUTH block, uncomment the section below,
  // and add `import { createClient } from '@/lib/supabase/server'`
  // -------------------------------------------------------------------------

  // const supabase = await createClient()
  // const { data: { user }, error: authError } = await supabase.auth.getUser()
  // if (authError || !user) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // }

  let profile: { role: string; company_id: string; id: string } | null = null

  if (DEV_BYPASS_AUTH) {
    const { data, error } = await adminClient
      .from('profiles')
      .select('id, role, company_id')
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle()

    if (error || !data) {
      return NextResponse.json(
        { error: 'Dev bypass: no admin profile found in database' },
        { status: 500 }
      )
    }

    profile = data
  } else {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse body
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { email, first_name, last_name, phone, job_role } = body

  // Validate required fields
  const errors: string[] = []

  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('email: must be a valid email address')
  }
  if (!first_name || typeof first_name !== 'string' || first_name.trim() === '') {
    errors.push('first_name: required')
  }
  if (!last_name || typeof last_name !== 'string' || last_name.trim() === '') {
    errors.push('last_name: required')
  }
  if (!job_role || typeof job_role !== 'string' || job_role.trim() === '') {
    errors.push('job_role: required')
  }
  if (phone !== undefined && phone !== null && typeof phone !== 'string') {
    errors.push('phone: must be a string')
  }

  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 422 })
  }

  const normalizedEmail = (email as string).toLowerCase().trim()

  // Block re-invite if applicant already exists with a terminal status
  const { data: existing } = await adminClient
    .from('applicants')
    .select('id, status')
    .eq('company_id', profile.company_id)
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (existing) {
    if (existing.status === 'hired') {
      return NextResponse.json({ error: 'Applicant has already been hired' }, { status: 409 })
    }
    if (existing.status === 'withdrawn') {
      return NextResponse.json(
        { error: 'Applicant has withdrawn. Re-activate them before re-inviting' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'Applicant already exists. Use Resend Invite from the table.' },
      { status: 409 }
    )
  }

  // Generate token — store only the SHA-256 hash, never the raw token
  const rawToken       = crypto.randomBytes(32).toString('hex')
  const tokenHash      = crypto.createHash('sha256').update(rawToken).digest('hex')
  const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: applicant, error: upsertError } = await adminClient
    .from('applicants')
    .upsert(
      {
        company_id:       profile.company_id,
        email:            normalizedEmail,
        first_name:       (first_name as string).trim(),
        last_name:        (last_name as string).trim(),
        phone:            phone ? (phone as string).trim() : null,
        job_role:         (job_role as string).trim(),
        status:           'applied' as const,
        invited_by:       profile.id,
        token_hash:       tokenHash,
        token_expires_at: tokenExpiresAt,
      },
      { onConflict: 'company_id,email' }
    )
    .select('id, email')
    .single()

  if (upsertError || !applicant) {
    console.error('[invite-applicant] upsert failed:', upsertError)
    return NextResponse.json({ error: 'Failed to create applicant record' }, { status: 500 })
  }

  // Audit log — fire-and-forget
  adminClient.from('audit_logs').insert({
    company_id:  profile.company_id,
    actor_id:    profile.id,
    action:      'applicant.invited',
    entity_type: 'applicant',
    entity_id:   applicant.id,
    metadata: {
      email:    applicant.email,
      job_role: (job_role as string).trim(),
    },
  })

  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const magicLink = `${appUrl}/portal/apply?token=${rawToken}`

  // Send invite email — fire-and-forget; never blocks the response
  sendInviteEmail({
    to:         normalizedEmail,
    firstName:  (first_name as string).trim(),
    jobRole:    (job_role as string).trim(),
    magicLink,
    expiresAt:  tokenExpiresAt,
  }).then((result) => {
    if (result.success) {
      adminClient.from('audit_logs').insert({
        company_id:  profile!.company_id,
        actor_id:    profile!.id,
        action:      'applicant.invite_email_sent',
        entity_type: 'applicant',
        entity_id:   applicant.id,
        metadata: { email: normalizedEmail },
      })
    } else {
      console.error('[invite-applicant] email send failed:', result.error)
      adminClient.from('audit_logs').insert({
        company_id:  profile!.company_id,
        actor_id:    profile!.id,
        action:      'applicant.invite_email_failed',
        entity_type: 'applicant',
        entity_id:   applicant.id,
        metadata: { email: normalizedEmail, error: String(result.error) },
      })
    }
  }).catch((err) => {
    console.error('[invite-applicant] unexpected email error:', err)
  })

  return NextResponse.json(
    {
      applicant_id: applicant.id,
      magic_link:   magicLink,
      expires_at:   tokenExpiresAt,
    },
    { status: 201 }
  )
}
