import 'server-only'

// ── Roles ─────────────────────────────────────────────────────────────────────

export const ROLES = ['super_admin', 'company_admin', 'coordinator', 'care_worker'] as const
export type Role = typeof ROLES[number]

/**
 * Admin roles — can access /admin/* routes.
 * coordinator has same permissions as company_admin for now.
 * 'admin' is the legacy DB enum value — treated as company_admin.
 */
export const ADMIN_ROLES = new Set<Role>(['super_admin', 'company_admin', 'coordinator'])

// Legacy DB role value (user_role enum: 'admin') — maps to company_admin
const LEGACY_ADMIN_ROLE = 'admin'

/**
 * Normalise a raw DB role string to a typed Role.
 * 'admin' (legacy enum value) → 'company_admin'.
 */
export function normaliseRole(raw: string): Role {
  if (raw === LEGACY_ADMIN_ROLE) return 'company_admin'
  return raw as Role
}

/**
 * Check whether a role satisfies a required level.
 * For now: company_admin and coordinator are equivalent.
 */
export function hasRole(actual: Role | string, required: Role): boolean {
  const norm = normaliseRole(actual as string)
  const hierarchy: Record<Role, number> = {
    super_admin:   100,
    company_admin: 50,
    coordinator:   50,
    care_worker:   10,
  }
  return (hierarchy[norm] ?? 0) >= (hierarchy[required] ?? 999)
}

export function isAdminRole(role: Role | string): boolean {
  if (role === LEGACY_ADMIN_ROLE) return true
  return ADMIN_ROLES.has(role as Role)
}
