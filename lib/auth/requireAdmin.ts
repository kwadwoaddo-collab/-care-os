import 'server-only'

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { adminClient } from '@/lib/supabase/admin'
import { unauthorized, forbidden } from '@/lib/auth/responses'
import { isAdminRole, normaliseRole, type Role } from '@/lib/auth/roles'
import { logger } from '@/lib/logger'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdminContext {
  userId:    string
  companyId: string
  role:      Role
}

export type AdminResult =
  | { ok: true;  ctx: AdminContext }
  | { ok: false; response: Response }

// ── Dev bypass configuration (single source of truth) ─────────────────────────
// Bypass is opt-in: both NODE_ENV=development AND QA_BYPASS_AUTH=true must be set.
// Set QA_BYPASS_AUTH=true in .env.local to enable — NEVER in production.
//
// Production guard: if this code path is somehow reached with NODE_ENV=production,
// throw immediately rather than silently granting access.

function validateBypassSafety(): void {
  if (process.env.NODE_ENV === 'production') {
    // This should be unreachable — shouldBypassAuth is false in production.
    // If we are here, something is seriously wrong.
    throw new Error(
      '[requireAdmin] CRITICAL: auth bypass attempted in production. ' +
      'QA_BYPASS_AUTH must never be active when NODE_ENV=production.'
    )
  }
  logger.warn('[requireAdmin] QA_BYPASS_AUTH is active — dev context returned', {
    note: 'This MUST NOT be enabled in production or Vercel env vars.',
  })
}

const shouldBypassAuth =
  process.env.NODE_ENV === 'development' &&
  process.env.QA_BYPASS_AUTH === 'true'

if (shouldBypassAuth) {
  // Emit the warning once at module-load time so it appears in dev server logs.
  logger.warn('[requireAdmin] QA auth bypass is ENABLED (NODE_ENV=development, QA_BYPASS_AUTH=true)')
}

// Dev fallback company — resolved once per process.
// Prefers QA company (slug = 'sprintscale-qa') when seeded, so smoke tests
// always see QA data. Falls back to the first company in the table.
let _devCompanyId: string | null = null

async function getDevCompanyId(): Promise<string> {
  if (_devCompanyId) return _devCompanyId

  const { data: qa } = await adminClient
    .from('companies')
    .select('id')
    .eq('slug', 'sprintscale-qa')
    .maybeSingle()

  if (qa?.id) {
    _devCompanyId = qa.id as string
    return _devCompanyId
  }

  const { data } = await adminClient
    .from('companies')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  _devCompanyId = (data?.id as string) ?? 'dev-company'
  return _devCompanyId
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Validate admin authentication and return company-scoped context.
 *
 * Usage in route handlers:
 * ```ts
 * const auth = await requireAdmin()
 * if (!auth.ok) return auth.response
 * const { userId, companyId, role } = auth.ctx
 * ```
 */
export async function requireAdmin(): Promise<AdminResult> {
  // ── QA bypass (opt-in: NODE_ENV=development + QA_BYPASS_AUTH=true) ──────────
  if (shouldBypassAuth) {
    validateBypassSafety()   // throws in production; logs warning in dev
    const companyId = await getDevCompanyId()
    return {
      ok: true,
      ctx: {
        userId:    'dev-admin',
        companyId,
        role:      'company_admin',
      },
    }
  }

  // ── Production: validate Supabase Auth session ────────────────────────────
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch { /* Server Component — handled by middleware */ }
          },
        },
      },
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { ok: false, response: unauthorized() }
    }

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('company_id, role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return { ok: false, response: unauthorized('Profile not found') }
    }

    const role = normaliseRole(profile.role as string)

    if (!isAdminRole(role)) {
      return { ok: false, response: forbidden('Insufficient permissions') }
    }

    return {
      ok: true,
      ctx: {
        userId:    user.id,
        companyId: profile.company_id as string,
        role,
      },
    }
  } catch (err) {
    logger.error('[requireAdmin] unexpected error', { error: String(err) })
    return { ok: false, response: unauthorized() }
  }
}

// ── Audit log helper ────────────────────────────────────────────────────────

export function auditMeta(ctx: AdminContext) {
  return {
    actor_id:   ctx.userId,
    company_id: ctx.companyId,
  }
}
