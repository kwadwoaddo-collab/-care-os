// lib/rbac/roles.ts
//
// Central role definitions for Care OS.
// Pure TypeScript — no server-only dependency; safe to import in tests, client
// components, and API routes alike.
//
// ROLE HIERARCHY (highest → lowest privilege):
//   super_admin        100  — platform owner, never assignable in tenant UI
//   company_admin       80  — full tenant control
//   registered_manager  60  — operational oversight, safeguarding, CQC
//   compliance_manager  50  — documents, training, onboarding approvals
//   coordinator         40  — rota, scheduling, day-to-day operations
//   care_worker         10  — worker portal only

// ── Role constants ────────────────────────────────────────────────────────────

export const ROLES = [
  'super_admin',
  'company_admin',
  'registered_manager',
  'compliance_manager',
  'coordinator',
  'care_worker',
] as const

export type Role = typeof ROLES[number]

// ── Hierarchy levels ──────────────────────────────────────────────────────────
// Used for privilege-escalation checks: a caller can only assign roles
// strictly below their own level.

export const ROLE_HIERARCHY: Record<Role, number> = {
  super_admin:        100,
  company_admin:       80,
  registered_manager:  60,
  compliance_manager:  50,
  coordinator:         40,
  care_worker:         10,
}

export function hierarchyLevel(role: Role | string): number {
  return ROLE_HIERARCHY[normaliseRole(role)] ?? 0
}

// ── Sets ──────────────────────────────────────────────────────────────────────

/** Roles that have access to the /admin/* panel. */
export const ADMIN_ROLES = new Set<Role>([
  'super_admin',
  'company_admin',
  'registered_manager',
  'compliance_manager',
  'coordinator',
])

/**
 * Roles that are assignable from the tenant UI.
 * super_admin is NEVER assignable.
 */
export const ASSIGNABLE_ROLES: Role[] = [
  'company_admin',
  'registered_manager',
  'compliance_manager',
  'coordinator',
  'care_worker',
]

// ── Legacy normalisation ──────────────────────────────────────────────────────

/** The legacy DB enum value 'admin' maps to company_admin. */
const LEGACY_ROLE_MAP: Record<string, Role> = {
  admin:  'company_admin',
  staff:  'care_worker',
}

/**
 * Normalise a raw DB role string to a typed Role.
 * 'admin' (legacy) → 'company_admin'
 * 'staff' (legacy) → 'care_worker'
 * Unknown strings are returned as-is (cast) — callers should guard.
 */
export function normaliseRole(raw: string): Role {
  return (LEGACY_ROLE_MAP[raw] ?? raw) as Role
}

export function isAdminRole(role: Role | string): boolean {
  return ADMIN_ROLES.has(normaliseRole(role))
}

/**
 * Roles that require admin portal access AND should trigger an admin invite
 * email when first assigned. care_worker is excluded — worker portal token
 * is sufficient. registered_manager is included as it accesses the admin panel.
 */
export const ADMIN_CAPABLE_ROLES = new Set<Role>([
  'coordinator',
  'compliance_manager',
  'registered_manager',
  'company_admin',
  'super_admin',
])

/**
 * Returns true if the role should trigger admin portal provisioning / invite.
 */
export function isAdminCapableRole(role: Role | string): boolean {
  return ADMIN_CAPABLE_ROLES.has(normaliseRole(role))
}

/**
 * Check whether `actual` satisfies the required minimum level.
 * Uses numeric hierarchy so comparisons work across all 6 roles.
 */
export function hasRole(actual: Role | string, required: Role): boolean {
  return hierarchyLevel(actual) >= hierarchyLevel(required)
}
