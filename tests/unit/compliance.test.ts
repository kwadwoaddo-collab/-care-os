/**
 * tests/unit/compliance.test.ts
 *
 * Unit tests for lib/compliance/status.ts — the central compliance status engine.
 * Run with:  npm run test:unit
 */

import assert from 'node:assert/strict'
import {
  getItemStatus,
  classifyItems,
  isExpired,
  isExpiringSoon,
  expiryUrgency,
  EXPIRY_WARN_DAYS,
  EXPIRY_NOTICE_DAYS,
  type ComplianceItemInput,
} from '../../lib/compliance/status'

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

// ── Date helpers ──────────────────────────────────────────────────────────────

function daysFromNow(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// ── isExpired ─────────────────────────────────────────────────────────────────

test('isExpired: null returns false', () => {
  assert.strictEqual(isExpired(null), false)
})

test('isExpired: yesterday returns true', () => {
  assert.strictEqual(isExpired(daysFromNow(-1)), true)
})

test('isExpired: tomorrow returns false', () => {
  assert.strictEqual(isExpired(daysFromNow(1)), false)
})

test('isExpired: in 30 days returns false', () => {
  assert.strictEqual(isExpired(daysFromNow(30)), false)
})

// ── isExpiringSoon ────────────────────────────────────────────────────────────

test('isExpiringSoon: null returns false', () => {
  assert.strictEqual(isExpiringSoon(null), false)
})

test('isExpiringSoon: yesterday returns false (already expired)', () => {
  assert.strictEqual(isExpiringSoon(daysFromNow(-1)), false)
})

test(`isExpiringSoon: within ${EXPIRY_NOTICE_DAYS} days returns true`, () => {
  assert.strictEqual(isExpiringSoon(daysFromNow(EXPIRY_NOTICE_DAYS - 1)), true)
})

test(`isExpiringSoon: exactly ${EXPIRY_NOTICE_DAYS} days returns true`, () => {
  assert.strictEqual(isExpiringSoon(daysFromNow(EXPIRY_NOTICE_DAYS)), true)
})

test(`isExpiringSoon: ${EXPIRY_NOTICE_DAYS + 1} days returns false`, () => {
  assert.strictEqual(isExpiringSoon(daysFromNow(EXPIRY_NOTICE_DAYS + 1)), false)
})

// ── expiryUrgency ─────────────────────────────────────────────────────────────

test('expiryUrgency: null returns null', () => {
  assert.strictEqual(expiryUrgency(null), null)
})

test('expiryUrgency: past date returns expired', () => {
  assert.strictEqual(expiryUrgency(daysFromNow(-5)), 'expired')
})

test(`expiryUrgency: within ${EXPIRY_WARN_DAYS} days returns warning`, () => {
  assert.strictEqual(expiryUrgency(daysFromNow(EXPIRY_WARN_DAYS - 1)), 'warning')
})

test(`expiryUrgency: within notice window but past warn returns notice`, () => {
  assert.strictEqual(expiryUrgency(daysFromNow(EXPIRY_WARN_DAYS + 1)), 'notice')
})

test(`expiryUrgency: beyond notice window returns null`, () => {
  assert.strictEqual(expiryUrgency(daysFromNow(EXPIRY_NOTICE_DAYS + 5)), null)
})

// ── getItemStatus ─────────────────────────────────────────────────────────────

test('getItemStatus: rejected → rejected', () => {
  const item: ComplianceItemInput = { status: 'rejected', expires_at: null }
  assert.strictEqual(getItemStatus(item), 'rejected')
})

test('getItemStatus: not_started → missing', () => {
  const item: ComplianceItemInput = { status: 'not_started', expires_at: null }
  assert.strictEqual(getItemStatus(item), 'missing')
})

test('getItemStatus: in_progress → in_review', () => {
  const item: ComplianceItemInput = { status: 'in_progress', expires_at: null }
  assert.strictEqual(getItemStatus(item), 'in_review')
})

test('getItemStatus: expired enum → expired', () => {
  const item: ComplianceItemInput = { status: 'expired', expires_at: null }
  assert.strictEqual(getItemStatus(item), 'expired')
})

test('getItemStatus: complete with past expires_at → expired', () => {
  const item: ComplianceItemInput = { status: 'complete', expires_at: daysFromNow(-10) }
  assert.strictEqual(getItemStatus(item), 'expired')
})

test('getItemStatus: complete with expiry soon → expiring_soon', () => {
  const item: ComplianceItemInput = { status: 'complete', expires_at: daysFromNow(15) }
  assert.strictEqual(getItemStatus(item), 'expiring_soon')
})

test('getItemStatus: complete with future expiry → compliant', () => {
  const item: ComplianceItemInput = { status: 'complete', expires_at: daysFromNow(90) }
  assert.strictEqual(getItemStatus(item), 'compliant')
})

test('getItemStatus: complete with no expiry → compliant', () => {
  const item: ComplianceItemInput = { status: 'complete', expires_at: null }
  assert.strictEqual(getItemStatus(item), 'compliant')
})

test('getItemStatus: rejected takes priority over expired date', () => {
  // Even with a past expiry date, rejected status returns rejected
  const item: ComplianceItemInput = { status: 'rejected', expires_at: daysFromNow(-10) }
  assert.strictEqual(getItemStatus(item), 'rejected')
})

// ── classifyItems ─────────────────────────────────────────────────────────────

test('classifyItems: empty array returns zeroes', () => {
  const counts = classifyItems([])
  assert.strictEqual(counts.total, 0)
  assert.strictEqual(counts.compliant, 0)
  assert.strictEqual(counts.expired, 0)
  assert.strictEqual(counts.missing, 0)
})

test('classifyItems: total equals items length', () => {
  const items: ComplianceItemInput[] = [
    { status: 'complete',    expires_at: daysFromNow(90) },
    { status: 'not_started', expires_at: null },
    { status: 'expired',     expires_at: null },
  ]
  const counts = classifyItems(items)
  assert.strictEqual(counts.total, 3)
})

test('classifyItems: correctly counts each status', () => {
  const items: ComplianceItemInput[] = [
    { status: 'complete',    expires_at: daysFromNow(90) },  // compliant
    { status: 'complete',    expires_at: daysFromNow(90) },  // compliant
    { status: 'complete',    expires_at: daysFromNow(15) },  // expiring_soon
    { status: 'complete',    expires_at: daysFromNow(-1) },  // expired
    { status: 'expired',     expires_at: null },             // expired
    { status: 'not_started', expires_at: null },             // missing
    { status: 'rejected',    expires_at: null },             // rejected
    { status: 'in_progress', expires_at: null },             // in_review
  ]
  const counts = classifyItems(items)
  assert.strictEqual(counts.compliant,     2)
  assert.strictEqual(counts.expiring_soon, 1)
  assert.strictEqual(counts.expired,       2)
  assert.strictEqual(counts.missing,       1)
  assert.strictEqual(counts.rejected,      1)
  assert.strictEqual(counts.in_review,     1)
  assert.strictEqual(counts.total,         8)
})

test('classifyItems: sum of all statuses equals total', () => {
  const items: ComplianceItemInput[] = [
    { status: 'complete',    expires_at: daysFromNow(90) },
    { status: 'complete',    expires_at: daysFromNow(15) },
    { status: 'not_started', expires_at: null },
    { status: 'in_progress', expires_at: null },
    { status: 'rejected',    expires_at: null },
  ]
  const c = classifyItems(items)
  const sum = c.compliant + c.expiring_soon + c.expired + c.missing + c.rejected + c.in_review
  assert.strictEqual(sum, c.total)
})

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n  ${passed + failed} tests: ${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
