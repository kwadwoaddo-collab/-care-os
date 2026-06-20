/**
 * tests/unit/compliance-state.test.ts
 *
 * Unit tests for:
 *   - getComplianceState() (from calculateCompliance.ts)
 *   - getExpiryBand()     (from expiryBands.ts)
 *   - getDaysUntilExpiry()
 *   - worstBand()
 *   - complianceState in ComplianceSummary (via calculateCompliance())
 *   - Renewal workflow (supersession logic validation)
 *
 * Run with: npm run test:unit
 */

import assert from 'node:assert/strict'
import {
  calculateCompliance,
  getComplianceState,
  type ComplianceDocument,
} from '../../lib/compliance/calculateCompliance'
import {
  getExpiryBand,
  getDaysUntilExpiry,
  worstBand,
  BAND_DAYS,
} from '../../lib/compliance/expiryBands'

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

let idCounter = 0
function makeDoc(overrides: Partial<ComplianceDocument> = {}): ComplianceDocument {
  return {
    id:                String(++idCounter),
    document_type:     'training_certificate',
    file_name:         'cert.pdf',
    expiry_date:       null,
    training_category: null,
    reviewed_status:   'approved',
    issue_date:        null,
    ...overrides,
  }
}

const ALL_DOCS: ComplianceDocument[] = [
  makeDoc({ document_type: 'passport',      training_category: null }),
  makeDoc({ document_type: 'right_to_work', training_category: null }),
  makeDoc({ document_type: 'dbs',           training_category: null }),
  makeDoc({ training_category: 'manual_handling' }),
  makeDoc({ training_category: 'safeguarding' }),
  makeDoc({ training_category: 'basic_life_support' }),
  makeDoc({ training_category: 'infection_control' }),
  makeDoc({ training_category: 'health_safety' }),
  makeDoc({ training_category: 'fire_safety' }),
  makeDoc({ training_category: 'safeguarding_children' }),
  makeDoc({ training_category: 'medication' }),
  makeDoc({ training_category: 'mental_capacity' }),
  makeDoc({ training_category: 'food_hygiene' }),
  makeDoc({ training_category: 'lone_working' }),
  makeDoc({ training_category: 'dementia_awareness' }),
  makeDoc({ training_category: 'communication' }),
]

// ── getExpiryBand ─────────────────────────────────────────────────────────────

console.log('\n  getExpiryBand\n')

test('null → ok', () => {
  assert.strictEqual(getExpiryBand(null), 'ok')
})

test('past date → expired', () => {
  assert.strictEqual(getExpiryBand(daysFromNow(-1)), 'expired')
})

test(`within ${BAND_DAYS.critical} days → critical`, () => {
  assert.strictEqual(getExpiryBand(daysFromNow(BAND_DAYS.critical)), 'critical')
})

test(`within ${BAND_DAYS.warning} days but beyond critical → warning`, () => {
  assert.strictEqual(getExpiryBand(daysFromNow(BAND_DAYS.warning)), 'warning')
})

test(`within ${BAND_DAYS.notice} days but beyond warning → notice`, () => {
  assert.strictEqual(getExpiryBand(daysFromNow(BAND_DAYS.notice)), 'notice')
})

test('beyond notice window → ok', () => {
  assert.strictEqual(getExpiryBand(daysFromNow(BAND_DAYS.notice + 1)), 'ok')
})

test('far future → ok', () => {
  assert.strictEqual(getExpiryBand(daysFromNow(365)), 'ok')
})

// ── getDaysUntilExpiry ────────────────────────────────────────────────────────

console.log('\n  getDaysUntilExpiry\n')

test('today → ~0 (between -1 and 1)', () => {
  const days = getDaysUntilExpiry(new Date().toISOString().slice(0, 10))
  assert.ok(Math.abs(days) <= 1, `Expected near 0, got ${days}`)
})

test('tomorrow → 1', () => {
  assert.strictEqual(getDaysUntilExpiry(daysFromNow(1)), 1)
})

test('7 days from now → 7', () => {
  assert.strictEqual(getDaysUntilExpiry(daysFromNow(7)), 7)
})

test('yesterday → -1', () => {
  assert.strictEqual(getDaysUntilExpiry(daysFromNow(-1)), -1)
})

// ── worstBand ─────────────────────────────────────────────────────────────────

console.log('\n  worstBand\n')

test('empty array → ok', () => {
  assert.strictEqual(worstBand([]), 'ok')
})

test('all null → ok', () => {
  assert.strictEqual(worstBand([null, null]), 'ok')
})

test('mix of ok and notice → notice', () => {
  assert.strictEqual(worstBand([daysFromNow(365), daysFromNow(20)]), 'notice')
})

test('mix includes critical → critical', () => {
  assert.strictEqual(worstBand([daysFromNow(365), daysFromNow(5)]), 'critical')
})

test('has expired → expired', () => {
  assert.strictEqual(worstBand([daysFromNow(-1), daysFromNow(60)]), 'expired')
})

// ── getComplianceState ────────────────────────────────────────────────────────

console.log('\n  getComplianceState\n')

test('compliant + no expiring → compliant', () => {
  assert.strictEqual(getComplianceState(true, false, false), 'compliant')
})

test('compliant + expiring soon → warning', () => {
  assert.strictEqual(getComplianceState(true, true, false), 'warning')
})

test('non-compliant + no training gap → non_compliant', () => {
  assert.strictEqual(getComplianceState(false, false, false), 'non_compliant')
})

test('non-compliant + has training gap → blocked', () => {
  assert.strictEqual(getComplianceState(false, false, true), 'blocked')
})

test('non-compliant + expiring + training gap → blocked (training gap wins)', () => {
  assert.strictEqual(getComplianceState(false, true, true), 'blocked')
})

// ── calculateCompliance: complianceState field ────────────────────────────────

console.log('\n  calculateCompliance — complianceState field\n')

test('no docs → state is blocked (missing training + missing docs → training gap)', () => {
  const { complianceState } = calculateCompliance([])
  // missing required training means hasTrainingGap = true → blocked
  assert.strictEqual(complianceState, 'blocked')
})

test('all docs approved, nothing expiring → state is compliant', () => {
  const { complianceState } = calculateCompliance(ALL_DOCS)
  assert.strictEqual(complianceState, 'compliant')
})

test('all docs approved, one expiring soon → state is warning', () => {
  const docs = ALL_DOCS.map((d) => ({ ...d }))
  docs[0] = { ...docs[0], expiry_date: daysFromNow(15) }  // within EXPIRY_WARN_DAYS
  const { complianceState } = calculateCompliance(docs)
  assert.strictEqual(complianceState, 'warning')
})

test('missing one required doc (passport) only → state is non_compliant', () => {
  // All training satisfied, but missing passport
  const docs = ALL_DOCS.filter((d) => d.document_type !== 'passport')
  const { complianceState } = calculateCompliance(docs)
  assert.strictEqual(complianceState, 'non_compliant')
})

test('missing one required training → state is blocked', () => {
  // Has all docs but missing manual_handling training
  const docs = ALL_DOCS.filter((d) => d.training_category !== 'manual_handling')
  const { complianceState } = calculateCompliance(docs)
  assert.strictEqual(complianceState, 'blocked')
})

// ── Renewal workflow: supersession does not break compliance ──────────────────

console.log('\n  Renewal workflow\n')

test('superseded cert does NOT satisfy compliance', () => {
  // Simulates the state AFTER a renewal: old cert marked superseded
  const oldCert = makeDoc({
    training_category: 'safeguarding',
    reviewed_status:   'superseded',  // marked by renewal workflow
  })
  const summary = calculateCompliance([oldCert])
  assert.ok(!summary.satisfiedTraining.includes('safeguarding'),
    'superseded cert should not satisfy training')
  assert.ok(summary.missingTraining.includes('safeguarding'),
    'safeguarding should be missing after supersession')
})

test('new cert approved + old cert superseded → category satisfied', () => {
  const oldCert = makeDoc({
    training_category: 'safeguarding',
    reviewed_status:   'superseded',
    expiry_date:       daysFromNow(-30),
  })
  const newCert = makeDoc({
    training_category: 'safeguarding',
    reviewed_status:   'approved',
    expiry_date:       daysFromNow(365),
  })
  const summary = calculateCompliance([oldCert, newCert])
  assert.ok(summary.satisfiedTraining.includes('safeguarding'))
  assert.ok(!summary.missingTraining.includes('safeguarding'))
})

test('renewal with new cert (no expiry set) → perpetually valid', () => {
  const newCert = makeDoc({
    training_category: 'manual_handling',
    reviewed_status:   'approved',
    expiry_date:       null,  // admin chose not to set expiry
  })
  const summary = calculateCompliance([newCert])
  assert.ok(summary.satisfiedTraining.includes('manual_handling'))
})

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n  ${passed + failed} tests: ${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
