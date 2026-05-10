/**
 * tests/unit/permissions.test.ts
 *
 * Permission helper unit tests.
 * Run with:  npm run test:unit
 *
 * Uses plain assert + manual pass/fail counters so it works with tsx without
 * requiring a separate test framework or node:test ESM loader gymnastics.
 * Exits non-zero if any assertion fails.
 */

import assert from 'node:assert/strict'
import { can, getRolePermissions, PERMISSIONS } from '../../lib/auth/permissions'

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

test('company_admin has every permission', () => {
  for (const p of PERMISSIONS) {
    assert.ok(can('company_admin', p), `company_admin missing: ${p}`)
  }
})

test('legacy admin role maps to company_admin permissions', () => {
  assert.ok(can('admin', 'staff:read'))
  assert.ok(can('admin', 'audit_log:read'))
  assert.ok(can('admin', 'system:read'))
})

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

test('coordinator cannot access audit log', () => {
  assert.strictEqual(can('coordinator', 'audit_log:read'), false)
})

test('coordinator cannot access system health', () => {
  assert.strictEqual(can('coordinator', 'system:read'), false)
})

test('coordinator cannot write staff profiles', () => {
  assert.strictEqual(can('coordinator', 'staff:write'), false)
})

test('coordinator cannot write clients', () => {
  assert.strictEqual(can('coordinator', 'clients:write'), false)
})

test('coordinator cannot write care packages', () => {
  assert.strictEqual(can('coordinator', 'care_packages:write'), false)
})

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
  const perms = getRolePermissions('care_worker')
  assert.strictEqual(perms.size, 0)
})

test('getRolePermissions: coordinator has fewer permissions than company_admin', () => {
  const coord = getRolePermissions('coordinator')
  const admin = getRolePermissions('company_admin')
  assert.ok(coord.size < admin.size, 'coordinator should have fewer permissions')
  assert.strictEqual(coord.has('audit_log:read'), false)
  assert.strictEqual(coord.has('system:read'), false)
  assert.strictEqual(coord.has('staff:write'), false)
})

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n  ${passed + failed} tests: ${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
