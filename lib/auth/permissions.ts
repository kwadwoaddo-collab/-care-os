// lib/auth/permissions.ts
//
// Central permission helper. Pure functions — no server-only dependencies so
// this can be imported by both server components, API routes, and unit tests.
//
// CURRENT DB ROLES: super_admin | company_admin | coordinator | care_worker
// (+ legacy 'admin' alias for company_admin — normalised by normaliseRole())
//
// FUTURE ROLE MIGRATION NOTE:
// The task spec listed additional roles (company_owner, registered_manager,
// hr_admin, auditor, finance) that do not exist in the DB user_role enum yet.
// Do not add them here until a schema migration lands. When that migration runs,
// extend ROLE_PERMISSIONS below — no other file needs to change.

import { normaliseRole, type Role } from './roles'

// ── Permission strings ────────────────────────────────────────────────────────

export const PERMISSIONS = [
  // Applicants
  'applicants:read',
  'applicants:invite',
  'applicants:update',

  // Staff
  'staff:read',
  'staff:write',

  // Documents
  'documents:read',
  'documents:upload',

  // Compliance
  'compliance:read',

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

  // Admin-only
  'notifications:read',
  'audit_log:read',
  'system:read',
] as const

export type Permission = typeof PERMISSIONS[number]

// ── Permission sets ───────────────────────────────────────────────────────────

type PermSet = ReadonlySet<Permission>

const ALL_PERMISSIONS: PermSet = new Set(PERMISSIONS)

// Coordinators handle day-to-day operations but not oversight functions.
const COORDINATOR_PERMISSIONS: PermSet = new Set<Permission>([
  'applicants:read',
  'applicants:invite',
  'applicants:update',
  'staff:read',
  // staff:write intentionally excluded — status changes require company_admin
  'documents:read',
  'documents:upload',
  'compliance:read',
  'clients:read',
  // clients:write intentionally excluded
  'care_packages:read',
  // care_packages:write intentionally excluded
  'shifts:read',
  'shifts:write',
  'incidents:read',
  'incidents:write',
  'visit_notes:read',
  'visit_notes:write',
  'timesheets:read',
  'notifications:read',
  // audit_log:read intentionally excluded — compliance/oversight only
  // system:read intentionally excluded — sysadmin only
])

// care_worker has no admin panel permissions.
const CARE_WORKER_PERMISSIONS: PermSet = new Set<Permission>()

// ── Role → permission mapping ─────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<Role, PermSet> = {
  super_admin:   ALL_PERMISSIONS,
  company_admin: ALL_PERMISSIONS,
  coordinator:   COORDINATOR_PERMISSIONS,
  care_worker:   CARE_WORKER_PERMISSIONS,
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Return true if the given role has the given permission.
 *
 * Accepts raw DB strings so callers don't need to normalise first.
 *
 * @example
 *   can('coordinator', 'audit_log:read')  // false
 *   can('company_admin', 'staff:write')   // true
 */
export function can(role: Role | string, permission: Permission): boolean {
  const normalised = normaliseRole(role as string)
  return (ROLE_PERMISSIONS[normalised] ?? CARE_WORKER_PERMISSIONS).has(permission)
}

/**
 * Return the full permission set for a role (for nav filtering etc).
 */
export function getRolePermissions(role: Role | string): PermSet {
  const normalised = normaliseRole(role as string)
  return ROLE_PERMISSIONS[normalised] ?? CARE_WORKER_PERMISSIONS
}
