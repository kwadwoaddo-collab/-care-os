import 'server-only'
import crypto from 'crypto'
import { adminClient } from '@/lib/supabase/admin'

export interface WorkerProfile {
  id:                   string
  company_id:           string
  applicant_id:         string | null
  first_name:           string | null
  last_name:            string | null
  email:                string | null
  status:               string
  job_role:             string | null
  start_date:           string | null
  onboarding_completed: boolean
}

export type ValidateTokenResult =
  | { ok: true;  worker: WorkerProfile }
  | { ok: false; status: number; error: string }

export async function validateWorkerToken(
  rawToken: string | null | undefined
): Promise<ValidateTokenResult> {
  if (!rawToken) {
    return { ok: false, status: 400, error: 'token is required' }
  }

  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')

  const { data: sp, error } = await adminClient
    .from('staff_profiles')
    .select('id, company_id, applicant_id, first_name, last_name, email, status, job_role, start_date, onboarding_completed, portal_token_expires_at')
    .eq('portal_token_hash', tokenHash)
    .maybeSingle()

  if (error) {
    console.error('[worker/auth] lookup error:', error.message)
    return { ok: false, status: 500, error: 'Internal error' }
  }

  if (!sp) {
    return { ok: false, status: 401, error: 'Invalid or expired token' }
  }

  const expiresAt = new Date(sp.portal_token_expires_at as string)
  if (isNaN(expiresAt.getTime()) || expiresAt < new Date()) {
    return { ok: false, status: 401, error: 'Token has expired — please request a new portal invite.' }
  }

  // Fire-and-forget: record last login time
  void adminClient
    .from('staff_profiles')
    .update({ portal_last_login_at: new Date().toISOString() })
    .eq('id', sp.id as string)

  return {
    ok: true,
    worker: {
      id:                   sp.id                   as string,
      company_id:           sp.company_id           as string,
      applicant_id:         sp.applicant_id         as string | null,
      first_name:           sp.first_name           as string | null,
      last_name:            sp.last_name            as string | null,
      email:                sp.email                as string | null,
      status:               sp.status               as string,
      job_role:             sp.job_role             as string | null,
      start_date:           sp.start_date           as string | null,
      onboarding_completed: (sp.onboarding_completed as boolean) ?? false,
    },
  }
}
