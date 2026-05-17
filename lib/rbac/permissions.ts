// lib/rbac/permissions.ts
//
// Full permission matrix for all 6 Care OS roles.
// Pure TypeScript — no server-only dependency.
//
// DESIGN: Each role has a ReadonlySet<Permission>. The `can()` helper is the
// low-level checker. Application code should prefer the named helpers in
// lib/rbac/can.ts rather than calling can() directly.
//
// Backwards-compatible: this module re-exports can() so existing
// `import { can } from '@/lib/auth/permissions'` call sites continue
// to work during the migration period.

import { normaliseRole, type Role } from './roles'

// ── Permission strings ────────────────────────────────────────────────────────

export const PERMISSIONS = [
  // Applicants
  'applicants:read',
  'applicants:invite',
  'applicants:update',
  'applicants:delete',

  // Staff
  'staff:read',
  'staff:write',
  'staff:delete',

  // Documents
  'documents:read',
  'documents:upload',

  // Compliance
  'compliance:read',

  // Safeguarding (registered_manager + above)
  'safeguarding:read',

  // Clients & care packages
  'clients:read',
  'clients:write',
  'care_packages:read',
  'care_packages:write',

  // Operational
  'shifts:read',
  'shifts:write',
  'incidents:read',
  'incidents:write',
  'visit_notes:read',
  'visit_notes:write',
  'timesheets:read',

  // Admin
  'notifications:read',
  'audit_log:read',

  // Settings (company_admin+)
  'settings:read',
  'settings:write',

  // System (super_admin + company_admin only)
  'system:read',
  'system:write',

  // Role management (company_admin + super_admin only)
  'roles:write',

  // Compliance overrides (registered_manager + company_admin + super_admin)
  'compliance:override',

  // Tenant administration (super_admin only)
  'tenants:read',
  'tenants:write',
] as const

export type Permission = typeof PERMISSIONS[number]

// ── Permission sets ───────────────────────────────────────────────────────────

type PermSet = ReadonlySet<Permission>

const ALL_PERMISSIONS: PermSet = new Set(PERMISSIONS)

// care_worker — no admin panel access
const CARE_WORKER_PERMISSIONS: PermSet = new Set<Permission>()

// coordinator — day-to-day operations; no oversight, no settings, no role mgmt
const COORDINATOR_PERMISSIONS: PermSet = new Set<Permission>([
  'applicants:read',
  'applicants:invite',
  'applicants:update',
  'staff:read',
  'documents:read',
  'documents:upload',
  'compliance:read',
  'clients:read',
  'care_packages:read',
  'shifts:read',
  'shifts:write',
  'incidents:read',
  'incidents:write',
  'visit_notes:read',
  'visit_notes:write',
  'timesheets:read',
  'notifications:read',
])

// compliance_manager — onboarding approvals, document review, training compliance
const COMPLIANCE_MANAGER_PERMISSIONS: PermSet = new Set<Permission>([
  'applicants:read',
  'applicants:invite',
  'applicants:update',
  'staff:read',
  'documents:read',
  'documents:upload',
  'compliance:read',
  'clients:read',
  'care_packages:read',
  'timesheets:read',
  'notifications:read',
  'audit_log:read',
])

// registered_manager — operational oversight, safeguarding, CQC, workforce supervision
const REGISTERED_MANAGER_PERMISSIONS: PermSet = new Set<Permission>([
  'applicants:read',
  'applicants:invite',
  'applicants:update',
  'staff:read',
  'staff:write',
  'staff:delete',
  'documents:read',
  'documents:upload',
  'compliance:read',
  'compliance:override',
  'safeguarding:read',
  'clients:read',
  'care_packages:read',
  'shifts:read',
  'shifts:write',
  'incidents:read',
  'incidents:write',
  'visit_notes:read',
  'visit_notes:write',
  'timesheets:read',
  'notifications:read',
  'audit_log:read',
])

// company_admin — full tenant control
const COMPANY_ADMIN_PERMISSIONS: PermSet = new Set<Permission>([
  'applicants:read',
  'applicants:invite',
  'applicants:update',
  'applicants:delete',
  'staff:read',
  'staff:write',
  'staff:delete',
  'documents:read',
  'documents:upload',
  'compliance:read',
  'compliance:override',
  'safeguarding:read',
  'clients:read',
  'clients:write',
  'care_packages:read',
  'care_packages:write',
  'shifts:read',
  'shifts:write',
  'incidents:read',
  'incidents:write',
  'visit_notes:read',
  'visit_notes:write',
  'timesheets:read',
  'notifications:read',
  'audit_log:read',
  'settings:read',
  'settings:write',
  'system:read',
  'system:write',
  'roles:write',
])

// ── Role → permissions map ────────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<Role, PermSet> = {
  super_admin:        ALL_PERMISSIONS,
  company_admin:      COMPANY_ADMIN_PERMISSIONS,
  registered_manager: REGISTERED_MANAGER_PERMISSIONS,
  compliance_manager: COMPLIANCE_MANAGER_PERMISSIONS,
  coordinator:        COORDINATOR_PERMISSIONS,
  care_worker:        CARE_WORKER_PERMISSIONS,
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Low-level permission check. Application code should prefer the named helpers
 * in lib/rbac/can.ts, but this remains the canonical source of truth.
 *
 * Accepts raw DB strings — normalises legacy 'admin' → 'company_admin'.
 */
export function can(role: Role | string, permission: Permission): boolean {
  const normalised = normaliseRole(role as string)
  return (ROLE_PERMISSIONS[normalised] ?? CARE_WORKER_PERMISSIONS).has(permission)
}

/**
 * Return the full permission set for a role (for nav filtering, etc.)
 */
export function getRolePermissions(role: Role | string): PermSet {
  const normalised = normaliseRole(role as string)
  return ROLE_PERMISSIONS[normalised] ?? CARE_WORKER_PERMISSIONS
}
