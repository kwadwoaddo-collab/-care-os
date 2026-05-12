// lib/rbac/can.ts
//
// Named capability helpers — the PRIMARY interface for all RBAC checks
// in Care OS application code (routes, layouts, pages, components).
//
// DESIGN PRINCIPLES:
//   1. No hardcoded role strings in callers — use these helpers.
//   2. Role ≠ employment status. canPerformOperations() combines both.
//   3. super_admin never surfaces in tenant UI — getAssignableRoles() excludes it.
//
// All helpers accept `role: Role | string` for forwards-compatibility.
// Suspend status is a separate axis — always use canPerformOperations()
// when the action requires an active (non-suspended) account.

import { can }               from './permissions'
import {
  normaliseRole,
  hierarchyLevel,
  ASSIGNABLE_ROLES,
  type Role,
} from './roles'

// ── Role management ───────────────────────────────────────────────────────────

/** Can this role assign/remove roles for other users? */
export function canManageRoles(role: Role | string): boolean {
  return can(role, 'roles:write')
}

/**
 * Can `callerRole` assign `targetRole` to another user?
 *
 * Rules:
 * - Caller must have roles:write
 * - Target role must be in ASSIGNABLE_ROLES (super_admin is never assignable)
 * - Caller cannot assign a role at or above their own level
 *   (registered_manager cannot assign company_admin)
 */
export function canAssignRole(callerRole: Role | string, targetRole: Role | string): boolean {
  if (!can(callerRole, 'roles:write')) return false
  const target = normaliseRole(targetRole as string)
  if (!ASSIGNABLE_ROLES.includes(target)) return false
  // Privilege escalation guard: caller can only assign roles BELOW their own level
  return hierarchyLevel(callerRole) > hierarchyLevel(targetRole)
}

/**
 * Return the list of roles a given caller may assign via the UI.
 * Always excludes super_admin. Excludes roles at or above the caller's level.
 */
export function getAssignableRoles(callerRole: Role | string): Role[] {
  const callerLevel = hierarchyLevel(callerRole)
  return ASSIGNABLE_ROLES.filter((r) => hierarchyLevel(r) < callerLevel)
}

// ── Compliance & onboarding ───────────────────────────────────────────────────

/** Can review/approve documents and onboarding items. */
export function canApproveCompliance(role: Role | string): boolean {
  return can(role, 'staff:write') && can(role, 'compliance:read')
}

/** Can read compliance data (documents, training status, etc.) */
export function canViewCompliance(role: Role | string): boolean {
  return can(role, 'compliance:read')
}

// ── Shift operations ──────────────────────────────────────────────────────────

/** Can create/update/cancel shifts and manage the rota. */
export function canManageShifts(role: Role | string): boolean {
  return can(role, 'shifts:write')
}

/** Can read shift data. */
export function canViewShifts(role: Role | string): boolean {
  return can(role, 'shifts:read')
}

// ── Incidents & safeguarding ──────────────────────────────────────────────────

/** Can view incident reports. */
export function canViewIncidents(role: Role | string): boolean {
  return can(role, 'incidents:read')
}

/** Can create/update incident reports. */
export function canWriteIncidents(role: Role | string): boolean {
  return can(role, 'incidents:write')
}

/** Safeguarding-level visibility (registered_manager and above). */
export function canViewSafeguarding(role: Role | string): boolean {
  return can(role, 'safeguarding:read')
}

// ── Staff & HR ────────────────────────────────────────────────────────────────

/** Can create/update/activate staff profiles. */
export function canManageStaff(role: Role | string): boolean {
  return can(role, 'staff:write')
}

/** Can read staff profiles. */
export function canViewStaff(role: Role | string): boolean {
  return can(role, 'staff:read')
}

// ── Audit & settings ──────────────────────────────────────────────────────────

/** Can view the audit log. */
export function canViewAuditLogs(role: Role | string): boolean {
  return can(role, 'audit_log:read')
}

/** Can access company settings. */
export function canManageSettings(role: Role | string): boolean {
  return can(role, 'settings:write')
}

/** Can read system health / platform admin data. */
export function canViewSystemHealth(role: Role | string): boolean {
  return can(role, 'system:read')
}

// ── Notifications ─────────────────────────────────────────────────────────────

export function canViewNotifications(role: Role | string): boolean {
  return can(role, 'notifications:read')
}

// ── Suspended user / operational access ───────────────────────────────────────

/**
 * Returns true if a staff member's employment status allows operational actions.
 * Suspended and terminated staff may authenticate but lose operational access.
 */
export function isOperationallyActive(staffStatus: string): boolean {
  return staffStatus !== 'suspended' && staffStatus !== 'terminated'
}

/**
 * Combined check: role has operational capability AND staff is not suspended.
 * Use this for any action that requires both a capable role AND an active account.
 *
 * Example: a suspended coordinator should not be able to manage shifts.
 */
export function canPerformOperations(role: Role | string, staffStatus: string): boolean {
  return canManageShifts(role) && isOperationallyActive(staffStatus)
}
