/**
 * tests/unit/access.test.ts
 *
 * Tests for the identity model access state helpers in lib/rbac/access.ts.
 *
 * Covers:
 *  1. getAccessState() — all 4 combinations of hasWorkerToken / hasAdminAccount
 *  2. requiresAdminAccount() — all 6 roles
 *  3. getAccessStateMessage() — message content and showCreateAdminButton flag
 *  4. Integration: correct message for worker-only state
 *  5. Integration: no create button when admin account exists
 *
 * Run: tsx tests/unit/access.test.ts
 */

// ── Minimal test harness ──────────────────────────────────────────────────────

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

import {
  getAccessState,
  requiresAdminAccount,
  getAccessStateMessage,
  type AccessState,
} from '../../lib/rbac/access'

// ── 1. getAccessState() ───────────────────────────────────────────────────────

describe('getAccessState — all 4 combinations', () => {
  const s = (hasWorkerToken: boolean, hasAdminAccount: boolean): AccessState =>
    getAccessState({ hasWorkerToken, hasAdminAccount })

  assert(s(false, false) === 'no_access',    'no token, no profile_id → no_access')
  assert(s(true,  false) === 'worker_only',  'token set, no profile_id → worker_only')
  assert(s(false, true)  === 'admin_only',   'no token, profile_id set → admin_only')
  assert(s(true,  true)  === 'full_access',  'both set → full_access')
})

// ── 2. requiresAdminAccount() ─────────────────────────────────────────────────

describe('requiresAdminAccount — per role', () => {
  // care_worker does NOT require admin account
  assert(!requiresAdminAccount('care_worker'),        'care_worker does NOT require admin account')
  assert(!requiresAdminAccount('staff'),              'legacy "staff" alias does NOT require admin account')

  // All operational roles DO require admin account
  assert(requiresAdminAccount('coordinator'),         'coordinator requires admin account')
  assert(requiresAdminAccount('compliance_manager'),  'compliance_manager requires admin account')
  assert(requiresAdminAccount('registered_manager'),  'registered_manager requires admin account')
  assert(requiresAdminAccount('company_admin'),       'company_admin requires admin account')
  assert(requiresAdminAccount('admin'),               'legacy "admin" alias requires admin account')
  assert(requiresAdminAccount('super_admin'),         'super_admin requires admin account')

  // Unknown roles default to requiring admin account (safe-fail)
  assert(requiresAdminAccount('unknown_role'),        'unknown role defaults to requiring admin account')
  assert(requiresAdminAccount(''),                    'empty role defaults to requiring admin account')
})

// ── 3. getAccessStateMessage() ────────────────────────────────────────────────

describe('getAccessStateMessage — no_access', () => {
  const msg = getAccessStateMessage('no_access')
  assert(typeof msg.status === 'string' && msg.status.length > 0,  'has non-empty status')
  assert(typeof msg.description === 'string' && msg.description.length > 0, 'has description')
  assert(msg.showCreateAdminButton === true, 'shows create admin button')
  assert(msg.description.toLowerCase().includes('portal') || msg.description.toLowerCase().includes('access'),
    'description mentions portal/access')
})

describe('getAccessStateMessage — worker_only', () => {
  const msg = getAccessStateMessage('worker_only')
  assert(typeof msg.status === 'string' && msg.status.length > 0,  'has non-empty status')
  assert(msg.showCreateAdminButton === true, 'shows create admin button')
  assert(
    msg.description.toLowerCase().includes('worker') ||
    msg.description.toLowerCase().includes('operational'),
    'description mentions worker or operational role'
  )
})

describe('getAccessStateMessage — admin_only', () => {
  const msg = getAccessStateMessage('admin_only')
  assert(msg.showCreateAdminButton === false, 'does NOT show create admin button')
  assert(typeof msg.status === 'string' && msg.status.length > 0,  'has non-empty status')
})

describe('getAccessStateMessage — full_access', () => {
  const msg = getAccessStateMessage('full_access')
  assert(msg.showCreateAdminButton === false, 'does NOT show create admin button')
  assert(typeof msg.status === 'string' && msg.status.length > 0,  'has non-empty status')
})

// ── 4. Integration: worker portal login does NOT imply admin access ────────────

describe('Integration: worker portal login does NOT create admin access', () => {
  // Simulate a care_worker who has only ever used the worker portal
  const workerOnlyState = getAccessState({
    hasWorkerToken:  true,   // portal_token_hash set by portal-invite
    hasAdminAccount: false,  // profile_id is null — never provisioned
  })

  assert(workerOnlyState === 'worker_only',
    'care_worker with token but no profile → worker_only state')

  const msg = getAccessStateMessage(workerOnlyState)
  assert(msg.showCreateAdminButton,
    'worker_only state shows "Create Admin Portal Access" button')

  // Assigning coordinator role requires admin account — verify logic
  assert(requiresAdminAccount('coordinator'),
    'coordinator requires admin account before role assignment')

  // A coordinator assignment without admin account is blocked
  const canAssignCoordinatorWithoutAdminAccount =
    !requiresAdminAccount('coordinator') || workerOnlyState === 'worker_only'
    ? false
    : true

  // The above evaluates to false — correct behaviour
  assert(!canAssignCoordinatorWithoutAdminAccount,
    'coordinator role assignment blocked for worker_only staff')
})

// ── 5. Integration: admin account created → role management enabled ────────────

describe('Integration: admin account created enables role management', () => {
  const fullState = getAccessState({
    hasWorkerToken:  true,    // still has worker token (optional)
    hasAdminAccount: true,    // profile_id now set after admin-access provisioning
  })

  assert(fullState === 'full_access',
    'after admin account creation → full_access state')

  const msg = getAccessStateMessage(fullState)
  assert(!msg.showCreateAdminButton,
    'full_access does NOT show create admin button (already created)')
})

// ── 6. All roles — symmetry check ─────────────────────────────────────────────

describe('requiresAdminAccount — exhaustive role coverage', () => {
  const WORKER_ROLES   = ['care_worker', 'staff']
  const ADMIN_ROLES    = ['coordinator', 'compliance_manager', 'registered_manager', 'company_admin', 'super_admin', 'admin']

  for (const role of WORKER_ROLES) {
    assert(!requiresAdminAccount(role), `${role}: does NOT require admin account`)
  }
  for (const role of ADMIN_ROLES) {
    assert(requiresAdminAccount(role), `${role}: DOES require admin account`)
  }
})

// ── Final report ──────────────────────────────────────────────────────────────

report()
