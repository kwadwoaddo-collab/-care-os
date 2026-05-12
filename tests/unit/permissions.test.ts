/**
 * tests/unit/permissions.test.ts
 *
 * Permission helper unit tests — updated for 6-role RBAC matrix.
 * Run with:  npm run test:unit
 */

import assert from 'node:assert/strict'
import { can, getRolePermissions, PERMISSIONS } from '../../lib/rbac/permissions'

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓  ${name}`)
    passed++
  } catch (err) {
    console.error(`  ✗  ${name}`)
    console.error(`     ${err instanceof Error ? err.message : String(err)}`)
    failed++
  }
}

// ── super_admin ───────────────────────────────────────────────────────────────

test('super_admin has every permission', () => {
  for (const p of PERMISSIONS) {
    assert.ok(can('super_admin', p), `super_admin missing: ${p}`)
  }
})

// ── company_admin ─────────────────────────────────────────────────────────────

test('company_admin has roles:write', () => { assert.ok(can('company_admin', 'roles:write')) })
test('company_admin has settings:write', () => { assert.ok(can('company_admin', 'settings:write')) })
test('company_admin has audit_log:read', () => { assert.ok(can('company_admin', 'audit_log:read')) })
test('company_admin has system:read', () => { assert.ok(can('company_admin', 'system:read')) })

test('legacy admin role maps to company_admin permissions', () => {
  assert.ok(can('admin', 'staff:read'))
  assert.ok(can('admin', 'audit_log:read'))
  assert.ok(can('admin', 'system:read'))
  assert.ok(can('admin', 'roles:write'))
})

// ── registered_manager ───────────────────────────────────────────────────────

test('registered_manager has audit_log:read', () => { assert.ok(can('registered_manager', 'audit_log:read')) })
test('registered_manager has staff:write', () => { assert.ok(can('registered_manager', 'staff:write')) })
test('registered_manager has safeguarding:read', () => { assert.ok(can('registered_manager', 'safeguarding:read')) })
test('registered_manager has shifts:write', () => { assert.ok(can('registered_manager', 'shifts:write')) })
test('registered_manager has incidents:read', () => { assert.ok(can('registered_manager', 'incidents:read')) })
test('registered_manager lacks roles:write', () => { assert.strictEqual(can('registered_manager', 'roles:write'), false) })
test('registered_manager lacks system:read', () => { assert.strictEqual(can('registered_manager', 'system:read'), false) })
test('registered_manager lacks settings:write', () => { assert.strictEqual(can('registered_manager', 'settings:write'), false) })

// ── compliance_manager ───────────────────────────────────────────────────────

test('compliance_manager has compliance:read', () => { assert.ok(can('compliance_manager', 'compliance:read')) })
test('compliance_manager has audit_log:read', () => { assert.ok(can('compliance_manager', 'audit_log:read')) })
test('compliance_manager has documents:upload', () => { assert.ok(can('compliance_manager', 'documents:upload')) })
test('compliance_manager lacks shifts:write', () => { assert.strictEqual(can('compliance_manager', 'shifts:write'), false) })
test('compliance_manager lacks roles:write', () => { assert.strictEqual(can('compliance_manager', 'roles:write'), false) })
test('compliance_manager lacks staff:write', () => { assert.strictEqual(can('compliance_manager', 'staff:write'), false) })
test('compliance_manager lacks system:read', () => { assert.strictEqual(can('compliance_manager', 'system:read'), false) })
test('compliance_manager lacks safeguarding:read', () => { assert.strictEqual(can('compliance_manager', 'safeguarding:read'), false) })

// ── coordinator ───────────────────────────────────────────────────────────────

test('coordinator can read applicants, staff, documents, compliance', () => {
  assert.ok(can('coordinator', 'applicants:read'))
  assert.ok(can('coordinator', 'applicants:invite'))
  assert.ok(can('coordinator', 'applicants:update'))
  assert.ok(can('coordinator', 'staff:read'))
  assert.ok(can('coordinator', 'documents:read'))
  assert.ok(can('coordinator', 'documents:upload'))
  assert.ok(can('coordinator', 'compliance:read'))
})

test('coordinator can access operational features', () => {
  assert.ok(can('coordinator', 'shifts:read'))
  assert.ok(can('coordinator', 'shifts:write'))
  assert.ok(can('coordinator', 'incidents:read'))
  assert.ok(can('coordinator', 'incidents:write'))
  assert.ok(can('coordinator', 'visit_notes:read'))
  assert.ok(can('coordinator', 'visit_notes:write'))
  assert.ok(can('coordinator', 'timesheets:read'))
  assert.ok(can('coordinator', 'clients:read'))
  assert.ok(can('coordinator', 'care_packages:read'))
  assert.ok(can('coordinator', 'notifications:read'))
})

test('coordinator cannot access audit log', () => { assert.strictEqual(can('coordinator', 'audit_log:read'), false) })
test('coordinator cannot access system health', () => { assert.strictEqual(can('coordinator', 'system:read'), false) })
test('coordinator cannot write staff profiles', () => { assert.strictEqual(can('coordinator', 'staff:write'), false) })
test('coordinator cannot manage roles', () => { assert.strictEqual(can('coordinator', 'roles:write'), false) })
test('coordinator lacks safeguarding:read', () => { assert.strictEqual(can('coordinator', 'safeguarding:read'), false) })
test('coordinator cannot write clients', () => { assert.strictEqual(can('coordinator', 'clients:write'), false) })
test('coordinator cannot write care packages', () => { assert.strictEqual(can('coordinator', 'care_packages:write'), false) })

// ── care_worker ───────────────────────────────────────────────────────────────

test('care_worker has no admin permissions', () => {
  for (const p of PERMISSIONS) {
    assert.strictEqual(can('care_worker', p), false, `care_worker should not have: ${p}`)
  }
})

// ── unknown / garbage role ────────────────────────────────────────────────────

test('unknown role returns false for every permission', () => {
  for (const p of PERMISSIONS) {
    assert.strictEqual(can('unknown_role', p), false)
    assert.strictEqual(can('', p), false)
  }
})

// ── getRolePermissions ────────────────────────────────────────────────────────

test('getRolePermissions: super_admin has all permissions', () => {
  const perms = getRolePermissions('super_admin')
  assert.strictEqual(perms.size, PERMISSIONS.length)
})

test('getRolePermissions: care_worker has zero permissions', () => {
  assert.strictEqual(getRolePermissions('care_worker').size, 0)
})

test('getRolePermissions: registered_manager > coordinator, < company_admin', () => {
  const coord = getRolePermissions('coordinator')
  const rm    = getRolePermissions('registered_manager')
  const admin = getRolePermissions('company_admin')
  assert.ok(rm.size > coord.size)
  assert.ok(rm.size < admin.size)
  assert.ok(rm.has('audit_log:read'))
  assert.ok(rm.has('staff:write'))
  assert.ok(rm.has('safeguarding:read'))
  assert.strictEqual(rm.has('roles:write'), false)
})

test('getRolePermissions: compliance_manager has compliance, audit, no shifts:write', () => {
  const cm = getRolePermissions('compliance_manager')
  assert.ok(cm.has('compliance:read'))
  assert.ok(cm.has('audit_log:read'))
  assert.strictEqual(cm.has('shifts:write'), false)
  assert.strictEqual(cm.has('roles:write'), false)
})

test('getRolePermissions: coordinator has fewer than company_admin, no audit/system/roles', () => {
  const coord = getRolePermissions('coordinator')
  const admin = getRolePermissions('company_admin')
  assert.ok(coord.size < admin.size)
  assert.strictEqual(coord.has('audit_log:read'), false)
  assert.strictEqual(coord.has('system:read'), false)
  assert.strictEqual(coord.has('staff:write'), false)
  assert.strictEqual(coord.has('roles:write'), false)
})

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n  ${passed + failed} tests: ${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
