import 'server-only'

// ── Roles ─────────────────────────────────────────────────────────────────────

export const ROLES = ['super_admin', 'company_admin', 'coordinator', 'care_worker'] as const
export type Role = typeof ROLES[number]

/**
 * Admin roles — can access /admin/* routes.
 * coordinator has same permissions as company_admin for now.
 */
export const ADMIN_ROLES = new Set<Role>(['super_admin', 'company_admin', 'coordinator'])

/**
 * Check whether a role satisfies a required level.
 * For now: company_admin and coordinator are equivalent.
 */
export function hasRole(actual: Role | string, required: Role): boolean {
  const hierarchy: Record<Role, number> = {
    super_admin:   100,
    company_admin: 50,
    coordinator:   50,
    care_worker:   10,
  }
  return (hierarchy[actual as Role] ?? 0) >= (hierarchy[required] ?? 999)
}

export function isAdminRole(role: Role | string): boolean {
  return ADMIN_ROLES.has(role as Role)
}
