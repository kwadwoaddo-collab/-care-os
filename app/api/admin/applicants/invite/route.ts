import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { adminClient } from '@/lib/supabase/admin'
import { sendInviteEmail } from '@/lib/email/resend'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { ipRateLimit } from '@/lib/rateLimit'

export async function POST(request: NextRequest) {
  // 5 invites per 10 minutes per IP — prevents email spam
  const rl = ipRateLimit(request, 'applicant:invite', 5, 10 * 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many invitations sent — try again later' }, {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil(rl.retryAfter / 1000)) },
    })
  }

  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId, userId } = auth.ctx

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
    .eq('company_id', companyId)
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (existing) {
    if (existing.status === 'hired') {
      return NextResponse.json({ error: 'Applicant has already been hired', existingId: existing.id }, { status: 409 })
    }
    if (existing.status === 'withdrawn') {
      return NextResponse.json(
        { error: 'Applicant has withdrawn. Re-activate them before re-inviting', existingId: existing.id },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: 'Applicant already exists. Use Resend Invite from the table.', existingId: existing.id },
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
        company_id:       companyId,
        email:            normalizedEmail,
        first_name:       (first_name as string).trim(),
        last_name:        (last_name as string).trim(),
        phone:            phone ? (phone as string).trim() : null,
        job_role:         (job_role as string).trim(),
        status:           'applied' as const,
        invited_by:       userId,
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
    company_id:  companyId,
    actor_id:    userId,
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
        company_id:  companyId,
        actor_id:    userId,
        action:      'applicant.invite_email_sent',
        entity_type: 'applicant',
        entity_id:   applicant.id,
        metadata: { email: normalizedEmail },
      })
    } else {
      console.error('[invite-applicant] email send failed:', result.error)
      adminClient.from('audit_logs').insert({
        company_id:  companyId,
        actor_id:    userId,
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
