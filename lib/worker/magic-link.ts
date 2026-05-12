import crypto from 'crypto'
import { adminClient } from '@/lib/supabase/admin'
import { sendWorkerPortalEmail } from '@/lib/email/resend'

export interface MagicLinkResult {
  success: boolean
  error?:  string
  status:  number
}

/**
 * Generates and sends a fresh magic login link to a worker.
 * Implements token rotation (invalidates old ones) and generic success messages.
 */
export async function requestWorkerMagicLink(email: string): Promise<MagicLinkResult> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) {
    return { success: false, error: 'Email is required', status: 400 }
  }

  // 1. Fetch worker profile
  // We use adminClient to bypass RLS since this is a public auth request
  const { data: sp, error: fetchError } = await adminClient
    .from('staff_profiles')
    .select('id, company_id, first_name, last_name, job_role, status, portal_token_requested_at')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (fetchError) {
    console.error('[worker/magic-link] lookup error:', fetchError)
    return { success: false, error: 'Internal server error', status: 500 }
  }

  // Generic success message even if not found (Abuse Protection)
  if (!sp) {
    console.log(`[worker/magic-link] Email not found: ${normalizedEmail}. Returning generic success.`)
    return { success: true, status: 200 }
  }

  // 2. Status check
  if (sp.status === 'inactive' || sp.status === 'terminated') {
    console.log(`[worker/magic-link] Staff ${sp.id} is ${sp.status}. Blocking link request.`)
    return { success: true, status: 200 } // Still generic success
  }

  // 3. Throttling (Abuse Protection)
  const lastRequested = sp.portal_token_requested_at ? new Date(sp.portal_token_requested_at) : null
  const now = new Date()
  if (lastRequested && (now.getTime() - lastRequested.getTime() < 60000)) {
    console.log(`[worker/magic-link] Throttling request for ${sp.id}. Requested too recently.`)
    return { success: true, status: 200 } // Still generic success
  }

  // 4. Generate Fresh Token (Secure Token Rotation)
  const rawToken       = crypto.randomBytes(32).toString('hex')
  const tokenHash      = crypto.createHash('sha256').update(rawToken).digest('hex')
  const tokenExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString() // 24 hour expiry for re-logins

  // 5. Atomic Update (Invalidates previous worker token)
  const { error: updateError } = await adminClient
    .from('staff_profiles')
    .update({
      portal_token_hash:         tokenHash,
      portal_token_expires_at:   tokenExpiresAt,
      portal_token_requested_at: now.toISOString(),
      portal_invite_sent_at:     now.toISOString(),
    })
    .eq('id', sp.id)

  if (updateError) {
    console.error('[worker/magic-link] update failed:', updateError)
    return { success: false, error: 'Internal server error', status: 500 }
  }

  // 6. Send Email (Worker receive fresh magic login link)
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const magicLink = `${appUrl}/worker/login?token=${rawToken}`

  console.log(`[worker/magic-link] Sending link to ${normalizedEmail}...`)
  const emailResult = await sendWorkerPortalEmail({
    to:        normalizedEmail,
    firstName: (sp.first_name as string | null) ?? 'Worker',
    jobRole:   (sp.job_role   as string | null) ?? '',
    magicLink,
    expiresAt: tokenExpiresAt,
  })

  // 7. Audit Log (Part 8)
  void adminClient.from('audit_logs').insert({
    company_id:  sp.company_id,
    action:      'worker.login_link_sent',
    entity_type: 'staff_profile',
    entity_id:   sp.id,
    metadata:    { 
      email: normalizedEmail,
      ip:    'masked',
      success: emailResult.success
    },
  })

  if (!emailResult.success) {
    console.error('[worker/magic-link] email failed')
    // We still return 200 to user to prevent enumeration, but log the error
  }

  return { success: true, status: 200 }
}
