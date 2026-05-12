import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { adminClient } from '@/lib/supabase/admin'
import { sendWorkerPortalEmail } from '@/lib/email/resend'
import { requireAdmin } from '@/lib/auth/requireAdmin'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const { id } = await params

  const { data: sp, error: spError } = await adminClient
    .from('staff_profiles')
    .select('id, email, first_name, last_name, job_role, status, company_id')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (spError) {
    return NextResponse.json({ error: 'Failed to fetch staff profile' }, { status: 500 })
  }
  if (!sp) {
    return NextResponse.json({ error: 'Staff profile not found' }, { status: 404 })
  }

  if (sp.status === 'inactive') {
    return NextResponse.json({ error: 'Cannot send portal invite to inactive staff' }, { status: 409 })
  }
  if (!sp.email) {
    return NextResponse.json({ error: 'Staff profile has no email address' }, { status: 422 })
  }

  const rawToken       = crypto.randomBytes(32).toString('hex')
  const tokenHash      = crypto.createHash('sha256').update(rawToken).digest('hex')
  const tokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { error: updateError } = await adminClient
    .from('staff_profiles')
    .update({
      portal_token_hash:       tokenHash,
      portal_token_expires_at: tokenExpiresAt,
      portal_invite_sent_at:   new Date().toISOString(),
    })
    .eq('id', sp.id)

  if (updateError) {
    console.error('[portal-invite] token update failed:', updateError)
    return NextResponse.json({ error: 'Failed to save invite token' }, { status: 500 })
  }

  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const magicLink = `${appUrl}/worker/login?token=${rawToken}`

  void adminClient.from('audit_logs').insert({
    company_id:  companyId,
    actor_id:    auth.ctx.userId,
    action:      'staff.portal_invite_sent',
    entity_type: 'staff_profile',
    entity_id:   sp.id,
    metadata:    { email: sp.email },
  })

  console.log(`[portal-invite] Sending email to ${sp.email}...`)
  const emailResult = await sendWorkerPortalEmail({
    to:        sp.email as string,
    firstName: (sp.first_name as string | null) ?? '',
    jobRole:   (sp.job_role   as string | null) ?? '',
    magicLink,
    expiresAt: tokenExpiresAt,
  })

  if (!emailResult.success) {
    console.error('[portal-invite] email failed:', emailResult.error)
    return NextResponse.json({ error: 'Failed to send invite email via Resend' }, { status: 500 })
  }

  console.log(`[portal-invite] Email successfully sent to ${sp.email}. Resend ID: ${emailResult.id}`)

  return NextResponse.json({ 
    magic_link: magicLink, 
    expires_at: tokenExpiresAt,
    email_status: 'sent',
    email_id: emailResult.id
  })
}
