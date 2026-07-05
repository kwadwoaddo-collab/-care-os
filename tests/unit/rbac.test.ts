/**
 * tests/unit/rbac.test.ts
 *
 * Comprehensive RBAC tests covering:
 *  1. Full 6-role × permission matrix
 *  2. Named capability helpers
 *  3. Assignable roles (super_admin never included)
 *  4. Privilege escalation protection
 *  5. Last-admin protection logic
 *  6. Suspended user operational blocking
 *  7. Role hierarchy ordering
 *  8. Tenant isolation logic
 *
 * Run: tsx tests/unit/rbac.test.ts
 */

// ── Minimal test harness ─────────────────────────────────────────────────────

let passed = 0
let failed = 0

function describe(suite: string, fn: () => void): void {
  console.log(`\n──────────────────────────────────────────`)
  console.log(`  ${suite}`)
  console.log(`──────────────────────────────────────────`)
  fn()
}

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✅  ${message}`)
    passed++
  } else {
    console.error(`  ❌  ${message}`)
    failed++
  }
}

function report(): void {
  console.log(`\n══════════════════════════════════════════`)
  console.log(`  Results: ${passed} passed, ${failed} failed`)
  console.log(`══════════════════════════════════════════\n`)
  if (failed > 0) process.exit(1)
}

// ── Imports ───────────────────────────────────────────────────────────────────

import { can } from '../../lib/rbac/permissions'
import {
  ASSIGNABLE_ROLES,
  hierarchyLevel,
  normaliseRole,
  hasRole,
  isAdminRole,
} from '../../lib/rbac/roles'
import {
  canManageRoles,
  canAssignRole,
  getAssignableRoles,
  canApproveCompliance,
  canManageShifts,
  canViewIncidents,
  canViewSafeguarding,
  canViewAuditLogs,
  canManageSettings,
  isOperationallyActive,
  canPerformOperations,
} from '../../lib/rbac/can'

// ── 1. Permission Matrix ──────────────────────────────────────────────────────

describe('Permission matrix — roles:write', () => {
  assert(can('super_admin',        'roles:write'), 'super_admin has roles:write')
  assert(can('company_admin',      'roles:write'), 'company_admin has roles:write')
  assert(!can('registered_manager','roles:write'), 'registered_manager lacks roles:write')
  assert(!can('compliance_manager','roles:write'), 'compliance_manager lacks roles:write')
  assert(!can('coordinator',       'roles:write'), 'coordinator lacks roles:write')
  assert(!can('care_worker',       'roles:write'), 'care_worker lacks roles:write')
})

describe('Permission matrix — audit_log:read', () => {
  assert(can('super_admin',        'audit_log:read'), 'super_admin has audit_log:read')
  assert(can('company_admin',      'audit_log:read'), 'company_admin has audit_log:read')
  assert(can('registered_manager', 'audit_log:read'), 'registered_manager has audit_log:read')
  assert(can('compliance_manager', 'audit_log:read'), 'compliance_manager has audit_log:read')
  assert(!can('coordinator',       'audit_log:read'), 'coordinator lacks audit_log:read')
  assert(!can('care_worker',       'audit_log:read'), 'care_worker lacks audit_log:read')
})

describe('Permission matrix — staff:write', () => {
  assert(can('super_admin',        'staff:write'), 'super_admin has staff:write')
  assert(can('company_admin',      'staff:write'), 'company_admin has staff:write')
  assert(can('registered_manager', 'staff:write'), 'registered_manager has staff:write')
  assert(!can('compliance_manager','staff:write'), 'compliance_manager lacks staff:write')
  assert(!can('coordinator',       'staff:write'), 'coordinator lacks staff:write')
  assert(!can('care_worker',       'staff:write'), 'care_worker lacks staff:write')
})

describe('Permission matrix — compliance:read', () => {
  assert(can('super_admin',        'compliance:read'), 'super_admin has compliance:read')
  assert(can('company_admin',      'compliance:read'), 'company_admin has compliance:read')
  assert(can('registered_manager', 'compliance:read'), 'registered_manager has compliance:read')
  assert(can('compliance_manager', 'compliance:read'), 'compliance_manager has compliance:read')
  assert(can('coordinator',        'compliance:read'), 'coordinator has compliance:read')
  assert(!can('care_worker',       'compliance:read'), 'care_worker lacks compliance:read')
})

describe('Permission matrix — safeguarding:read', () => {
  assert(can('super_admin',        'safeguarding:read'), 'super_admin has safeguarding:read')
  assert(can('company_admin',      'safeguarding:read'), 'company_admin has safeguarding:read')
  assert(can('registered_manager', 'safeguarding:read'), 'registered_manager has safeguarding:read')
  assert(!can('compliance_manager','safeguarding:read'), 'compliance_manager lacks safeguarding:read')
  assert(!can('coordinator',       'safeguarding:read'), 'coordinator lacks safeguarding:read')
  assert(!can('care_worker',       'safeguarding:read'), 'care_worker lacks safeguarding:read')
})

describe('Permission matrix — shifts:write', () => {
  assert(can('super_admin',        'shifts:write'), 'super_admin has shifts:write')
  assert(can('company_admin',      'shifts:write'), 'company_admin has shifts:write')
  assert(can('registered_manager', 'shifts:write'), 'registered_manager has shifts:write')
  assert(!can('compliance_manager','shifts:write'), 'compliance_manager lacks shifts:write')
  assert(can('coordinator',        'shifts:write'), 'coordinator has shifts:write')
  assert(!can('care_worker',       'shifts:write'), 'care_worker lacks shifts:write')
})

describe('Permission matrix — system:read', () => {
  assert(can('super_admin',        'system:read'), 'super_admin has system:read')
  assert(can('company_admin',      'system:read'), 'company_admin has system:read')
  assert(!can('registered_manager','system:read'), 'registered_manager lacks system:read')
  assert(!can('compliance_manager','system:read'), 'compliance_manager lacks system:read')
  assert(!can('coordinator',       'system:read'), 'coordinator lacks system:read')
  assert(!can('care_worker',       'system:read'), 'care_worker lacks system:read')
})

describe('Permission matrix — settings:write', () => {
  assert(can('super_admin',        'settings:write'), 'super_admin has settings:write')
  assert(can('company_admin',      'settings:write'), 'company_admin has settings:write')
  assert(!can('registered_manager','settings:write'), 'registered_manager lacks settings:write')
  assert(!can('compliance_manager','settings:write'), 'compliance_manager lacks settings:write')
  assert(!can('coordinator',       'settings:write'), 'coordinator lacks settings:write')
  assert(!can('care_worker',       'settings:write'), 'care_worker lacks settings:write')
})

describe('Permission matrix — care_worker has NO permissions', () => {
  for (const role of ['care_worker'] as const) {
    const testPerms = ['staff:read', 'compliance:read', 'shifts:read', 'audit_log:read', 'roles:write'] as const
    for (const p of testPerms) {
      assert(!can(role, p), `care_worker lacks ${p}`)
    }
  }
})

// ── 2. Named Capability Helpers ───────────────────────────────────────────────

describe('Capability helpers — canManageRoles', () => {
  assert(canManageRoles('company_admin'),      'company_admin can manage roles')
  assert(canManageRoles('super_admin'),        'super_admin can manage roles')
  assert(!canManageRoles('registered_manager'),'registered_manager cannot manage roles')
  assert(!canManageRoles('compliance_manager'),'compliance_manager cannot manage roles')
  assert(!canManageRoles('coordinator'),       'coordinator cannot manage roles')
  assert(!canManageRoles('care_worker'),       'care_worker cannot manage roles')
})

describe('Capability helpers — canApproveCompliance', () => {
  assert(canApproveCompliance('company_admin'),       'company_admin can approve compliance')
  assert(canApproveCompliance('registered_manager'),  'registered_manager can approve compliance')
  assert(!canApproveCompliance('compliance_manager'), 'compliance_manager cannot approve (no staff:write)')
  assert(!canApproveCompliance('coordinator'),        'coordinator cannot approve compliance')
})

describe('Capability helpers — canManageShifts', () => {
  assert(canManageShifts('company_admin'),       'company_admin can manage shifts')
  assert(canManageShifts('registered_manager'),  'registered_manager can manage shifts')
  assert(!canManageShifts('compliance_manager'), 'compliance_manager cannot manage shifts')
  assert(canManageShifts('coordinator'),         'coordinator can manage shifts')
  assert(!canManageShifts('care_worker'),        'care_worker cannot manage shifts')
})

describe('Capability helpers — canViewIncidents', () => {
  assert(canViewIncidents('company_admin'),       'company_admin can view incidents')
  assert(canViewIncidents('registered_manager'),  'registered_manager can view incidents')
  assert(!canViewIncidents('compliance_manager'), 'compliance_manager cannot view incidents')
  assert(canViewIncidents('coordinator'),         'coordinator can view incidents')
  assert(!canViewIncidents('care_worker'),        'care_worker cannot view incidents')
})

describe('Capability helpers — canViewSafeguarding', () => {
  assert(canViewSafeguarding('super_admin'),        'super_admin has safeguarding access')
  assert(canViewSafeguarding('company_admin'),      'company_admin has safeguarding access')
  assert(canViewSafeguarding('registered_manager'), 'registered_manager has safeguarding access')
  assert(!canViewSafeguarding('compliance_manager'),'compliance_manager lacks safeguarding access')
  assert(!canViewSafeguarding('coordinator'),       'coordinator lacks safeguarding access')
})

describe('Capability helpers — canViewAuditLogs', () => {
  assert(canViewAuditLogs('company_admin'),       'company_admin can view audit logs')
  assert(canViewAuditLogs('registered_manager'),  'registered_manager can view audit logs')
  assert(canViewAuditLogs('compliance_manager'),  'compliance_manager can view audit logs')
  assert(!canViewAuditLogs('coordinator'),        'coordinator cannot view audit logs')
})

describe('Capability helpers — canManageSettings', () => {
  assert(canManageSettings('company_admin'),       'company_admin can manage settings')
  assert(!canManageSettings('registered_manager'), 'registered_manager cannot manage settings')
  assert(!canManageSettings('coordinator'),        'coordinator cannot manage settings')
})

// ── 3. Assignable Roles ───────────────────────────────────────────────────────

describe('ASSIGNABLE_ROLES — super_admin exclusion', () => {
  assert(!ASSIGNABLE_ROLES.includes('super_admin'), 'super_admin is NOT in ASSIGNABLE_ROLES')
  assert(ASSIGNABLE_ROLES.includes('company_admin'),      'company_admin IS assignable')
  assert(ASSIGNABLE_ROLES.includes('registered_manager'), 'registered_manager IS assignable')
  assert(ASSIGNABLE_ROLES.includes('compliance_manager'), 'compliance_manager IS assignable')
  assert(ASSIGNABLE_ROLES.includes('coordinator'),        'coordinator IS assignable')
  assert(ASSIGNABLE_ROLES.includes('care_worker'),        'care_worker IS assignable')
  assert(ASSIGNABLE_ROLES.length === 5, `ASSIGNABLE_ROLES has exactly 5 entries (got ${ASSIGNABLE_ROLES.length})`)
})

describe('getAssignableRoles — per-caller filtering', () => {
  const companyAdminRoles = getAssignableRoles('company_admin')
  assert(!companyAdminRoles.includes('super_admin'),  'company_admin cannot assign super_admin')
  assert(!companyAdminRoles.includes('company_admin'),'company_admin cannot assign company_admin (same level)')
  assert(companyAdminRoles.includes('registered_manager'), 'company_admin can assign registered_manager')
  assert(companyAdminRoles.includes('coordinator'),        'company_admin can assign coordinator')
  assert(companyAdminRoles.includes('care_worker'),        'company_admin can assign care_worker')

  const regManagerRoles = getAssignableRoles('registered_manager')
  assert(!regManagerRoles.includes('super_admin'),         'registered_manager cannot assign super_admin')
  assert(!regManagerRoles.includes('company_admin'),       'registered_manager cannot assign company_admin')
  assert(!regManagerRoles.includes('registered_manager'),  'registered_manager cannot assign self-level')
  assert(regManagerRoles.includes('compliance_manager'),   'registered_manager can assign compliance_manager')
  assert(regManagerRoles.includes('coordinator'),          'registered_manager can assign coordinator')
  assert(regManagerRoles.includes('care_worker'),          'registered_manager can assign care_worker')

  const coordinatorRoles = getAssignableRoles('coordinator')
  assert(coordinatorRoles.includes('care_worker'),           'coordinator can assign care_worker')
  assert(!coordinatorRoles.includes('coordinator'),          'coordinator cannot assign same level')
  assert(!coordinatorRoles.includes('compliance_manager'),   'coordinator cannot assign compliance_manager')

  const workerRoles = getAssignableRoles('care_worker')
  assert(workerRoles.length === 0, 'care_worker has no assignable roles')
})

// ── 4. Privilege Escalation ───────────────────────────────────────────────────

describe('canAssignRole — privilege escalation guards', () => {
  // Valid assignments (only company_admin and super_admin have roles:write)
  assert(canAssignRole('company_admin', 'coordinator'),        'company_admin → coordinator allowed')
  assert(canAssignRole('company_admin', 'care_worker'),        'company_admin → care_worker allowed')
  assert(canAssignRole('company_admin', 'registered_manager'), 'company_admin → registered_manager allowed')
  assert(canAssignRole('company_admin', 'compliance_manager'), 'company_admin → compliance_manager allowed')
  assert(canAssignRole('super_admin', 'coordinator'),          'super_admin → coordinator allowed')
  assert(canAssignRole('super_admin', 'company_admin'),        'super_admin → company_admin allowed')

  // registered_manager lacks roles:write — CANNOT assign anyone
  assert(!canAssignRole('registered_manager', 'coordinator'),   'registered_manager cannot assign (no roles:write)')
  assert(!canAssignRole('registered_manager', 'care_worker'),   'registered_manager cannot assign (no roles:write)')
  assert(!canAssignRole('registered_manager', 'company_admin'), 'registered_manager cannot assign company_admin')

  // Blocked escalations
  assert(!canAssignRole('coordinator', 'company_admin'),         'coordinator cannot assign company_admin')
  assert(!canAssignRole('coordinator', 'registered_manager'),    'coordinator cannot assign registered_manager')
  assert(!canAssignRole('coordinator', 'compliance_manager'),    'coordinator cannot assign compliance_manager')
  assert(!canAssignRole('compliance_manager', 'company_admin'), 'compliance_manager cannot assign company_admin')
  assert(!canAssignRole('registered_manager', 'company_admin'), 'registered_manager cannot assign company_admin')
  assert(!canAssignRole('care_worker', 'care_worker'),           'care_worker cannot assign anyone')

  // super_admin blocked regardless
  assert(!canAssignRole('company_admin', 'super_admin'), 'company_admin cannot assign super_admin')
  assert(!canAssignRole('super_admin', 'super_admin'),   'super_admin cannot assign super_admin')
})

// ── 5. Last-Admin Protection ──────────────────────────────────────────────────

describe('Last-admin protection logic', () => {
  // Pure function simulating the API check
  function wouldRemoveLastAdmin(
    currentRole: string,
    targetRole: string,
    adminCount: number
  ): boolean {
    const isRemovingAdmin = currentRole === 'company_admin' && targetRole !== 'company_admin'
    return isRemovingAdmin && adminCount <= 1
  }

  assert(wouldRemoveLastAdmin('company_admin', 'coordinator', 1),
    'Removing the only company_admin → blocked')
  assert(!wouldRemoveLastAdmin('company_admin', 'coordinator', 2),
    'Removing when 2 admins exist → allowed')
  assert(!wouldRemoveLastAdmin('coordinator', 'care_worker', 1),
    'Removing non-admin does not trigger last-admin check')
  assert(!wouldRemoveLastAdmin('company_admin', 'company_admin', 1),
    'Assigning same company_admin role → no change, no block')
})

// ── 6. Suspended User Checks ──────────────────────────────────────────────────

describe('isOperationallyActive', () => {
  assert(isOperationallyActive('active'),        'active staff is operationally active')
  assert(isOperationallyActive('pre_employment'), 'pre_employment staff is active (onboarding)')
  assert(!isOperationallyActive('suspended'),    'suspended staff is NOT operationally active')
  assert(!isOperationallyActive('terminated'),   'terminated staff is NOT operationally active')
  // Note: 'inactive' is not a valid staff_status enum value in this system
})

describe('canPerformOperations (role + status combined)', () => {
  assert(canPerformOperations('coordinator', 'active'),
    'active coordinator can perform operations')
  assert(canPerformOperations('registered_manager', 'active'),
    'active registered_manager can perform operations')
  assert(!canPerformOperations('coordinator', 'suspended'),
    'suspended coordinator cannot perform operations')
  assert(!canPerformOperations('coordinator', 'terminated'),
    'terminated coordinator cannot perform operations')
  assert(!canPerformOperations('compliance_manager', 'active'),
    'active compliance_manager cannot perform operations (no shifts:write)')
  assert(!canPerformOperations('care_worker', 'active'),
    'active care_worker cannot perform operations')
})

// ── 7. Role Hierarchy ─────────────────────────────────────────────────────────

describe('hierarchyLevel ordering', () => {
  assert(hierarchyLevel('super_admin')        > hierarchyLevel('company_admin'),      'super_admin > company_admin')
  assert(hierarchyLevel('company_admin')      > hierarchyLevel('registered_manager'), 'company_admin > registered_manager')
  assert(hierarchyLevel('registered_manager') > hierarchyLevel('compliance_manager'), 'registered_manager > compliance_manager')
  assert(hierarchyLevel('compliance_manager') > hierarchyLevel('coordinator'),        'compliance_manager > coordinator')
  assert(hierarchyLevel('coordinator')        > hierarchyLevel('care_worker'),        'coordinator > care_worker')
  assert(hierarchyLevel('care_worker')        > 0,                                   'care_worker > unknown/empty')
  assert(hierarchyLevel('unknown_role')       === 0,                                 'unknown role has level 0')
})

describe('hasRole — minimum level checks', () => {
  assert(hasRole('super_admin', 'company_admin'),       'super_admin satisfies company_admin requirement')
  assert(hasRole('company_admin', 'registered_manager'),'company_admin satisfies registered_manager requirement')
  assert(hasRole('company_admin', 'coordinator'),       'company_admin satisfies coordinator requirement')
  assert(!hasRole('coordinator', 'registered_manager'), 'coordinator does NOT satisfy registered_manager')
  assert(!hasRole('coordinator', 'company_admin'),      'coordinator does NOT satisfy company_admin')
  assert(!hasRole('care_worker', 'coordinator'),        'care_worker does NOT satisfy coordinator')
  assert(hasRole('registered_manager', 'compliance_manager'), 'registered_manager satisfies compliance_manager')
  assert(!hasRole('compliance_manager', 'registered_manager'),'compliance_manager does NOT satisfy registered_manager')
})

// ── 8. Legacy Role Normalisation ──────────────────────────────────────────────

describe('normaliseRole — legacy aliases', () => {
  assert(normaliseRole('admin')       === 'company_admin', 'admin → company_admin')
  assert(normaliseRole('staff')       === 'care_worker',   'staff → care_worker')
  assert(normaliseRole('company_admin') === 'company_admin','company_admin unchanged')
  assert(normaliseRole('coordinator') === 'coordinator',   'coordinator unchanged')
  assert(normaliseRole('super_admin') === 'super_admin',   'super_admin unchanged')

  // Legacy 'admin' permissions pass through correctly
  assert(canManageRoles(normaliseRole('admin')),  'legacy admin can manage roles')
  assert(canViewAuditLogs(normaliseRole('admin')), 'legacy admin can view audit logs')
})

// ── 9. Admin Role Detection ───────────────────────────────────────────────────

describe('isAdminRole', () => {
  assert(isAdminRole('super_admin'),        'super_admin is admin role')
  assert(isAdminRole('company_admin'),      'company_admin is admin role')
  assert(isAdminRole('registered_manager'), 'registered_manager is admin role')
  assert(isAdminRole('compliance_manager'), 'compliance_manager is admin role')
  assert(isAdminRole('coordinator'),        'coordinator is admin role')
  assert(!isAdminRole('care_worker'),       'care_worker is NOT admin role')
  assert(isAdminRole('admin'),              'legacy admin alias is admin role')
})

// ── 10. Tenant Isolation Logic ────────────────────────────────────────────────

describe('Tenant isolation logic', () => {
  // Simulates the API-level check: profile must belong to caller's company
  function isSameCompany(profileCompanyId: string, callerCompanyId: string): boolean {
    return profileCompanyId === callerCompanyId
  }

  const COMPANY_A = 'company-uuid-aaa'
  const COMPANY_B = 'company-uuid-bbb'

  assert(isSameCompany(COMPANY_A, COMPANY_A),   'Same company → tenant check passes')
  assert(!isSameCompany(COMPANY_B, COMPANY_A),  'Different company → tenant check fails')
  assert(!isSameCompany('', COMPANY_A),          'Empty company_id → tenant check fails')

  // Cross-company role change should be blocked regardless of caller's capability
  function canChangeRoleCrossCompany(
    callerRole: string,
    profileCompanyId: string,
    callerCompanyId: string
  ): boolean {
    if (!isSameCompany(profileCompanyId, callerCompanyId)) return false
    return canManageRoles(callerRole)
  }

  assert(!canChangeRoleCrossCompany('company_admin', COMPANY_B, COMPANY_A),
    'company_admin blocked for cross-company change')
  assert(!canChangeRoleCrossCompany('super_admin', COMPANY_B, COMPANY_A),
    'super_admin blocked for cross-company change (tenant isolation enforced at API level)')
  assert(canChangeRoleCrossCompany('company_admin', COMPANY_A, COMPANY_A),
    'company_admin allowed for same-company change')
})

// ── Final report ──────────────────────────────────────────────────────────────

report()
