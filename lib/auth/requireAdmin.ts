import 'server-only'

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { adminClient } from '@/lib/supabase/admin'
import { unauthorized, forbidden } from '@/lib/auth/responses'
import { isAdminRole, normaliseRole, type Role } from '@/lib/auth/roles'

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
// TODO: Remove DEV_BYPASS_AUTH before production deployment.
const DEV_BYPASS_AUTH = process.env.NODE_ENV === 'development'

// Dev fallback company — resolved once per process.
// Prefers QA company (slug = 'sprintscale-qa') when seeded, so smoke tests
// always see QA data. Falls back to the first company in the table.
let _devCompanyId: string | null = null

async function getDevCompanyId(): Promise<string> {
  if (_devCompanyId) return _devCompanyId

  // 1. Prefer the QA company so smoke tests hit QA data
  const { data: qa } = await adminClient
    .from('companies')
    .select('id')
    .eq('slug', 'sprintscale-qa')
    .maybeSingle()

  if (qa?.id) {
    _devCompanyId = qa.id as string
    return _devCompanyId
  }

  // 2. Fall back to whichever company exists (ordered for determinism)
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
  // ── Development bypass ────────────────────────────────────────────────────
  if (DEV_BYPASS_AUTH) {
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

    // Fetch profile for role + company_id
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
    console.error('[requireAdmin] unexpected error:', err)
    return { ok: false, response: unauthorized() }
  }
}

// ── Audit log helper ────────────────────────────────────────────────────────

/**
 * Build consistent audit log fields from admin context.
 * Matches the audit_logs table schema: actor_id, company_id.
 */
export function auditMeta(ctx: AdminContext) {
  return {
    actor_id:   ctx.userId,
    company_id: ctx.companyId,
  }
}
