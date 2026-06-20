/**
 * tests/unit/training.test.ts
 *
 * Unit tests for the training classification + compliance gate logic.
 *
 *   calculateCompliance (category-based, approval-aware)
 *   getRequiredTraining (role matrix)
 *   calculateOnboardingStatus (training hard gate)
 *
 * Run with: npm run test:unit
 */

import assert from 'node:assert/strict'
import { calculateCompliance, type ComplianceDocument } from '../../lib/compliance/calculateCompliance'
import { getRequiredTraining }                          from '../../lib/training/matrix'
import { calculateOnboardingStatus }                    from '../../lib/staff/calculateOnboardingStatus'

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

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    reviewed_status:   'pending',
    issue_date:        null,
    ...overrides,
  }
}

// ── getRequiredTraining (role matrix) ─────────────────────────────────────────

console.log('\n  getRequiredTraining\n')

test('care_worker has 13 required categories', () => {
  const r = getRequiredTraining('care_worker')
  assert.strictEqual(r.length, 13)
})

test('care_worker includes manual_handling', () => {
  const r = getRequiredTraining('care_worker')
  assert.ok(r.includes('manual_handling'))
})

test('care_worker includes safeguarding', () => {
  const r = getRequiredTraining('care_worker')
  assert.ok(r.includes('safeguarding'))
})

test('care_worker includes basic_life_support', () => {
  const r = getRequiredTraining('care_worker')
  assert.ok(r.includes('basic_life_support'))
})

test('null job_role falls back to DEFAULT_CARE_TRAINING', () => {
  const r = getRequiredTraining(null)
  assert.strictEqual(r.length, 13)
})

test('unrecognised role falls back to DEFAULT_CARE_TRAINING', () => {
  const r = getRequiredTraining('space_commander')
  assert.strictEqual(r.length, 13)
})

test('senior_care_worker has 13 categories (includes medication)', () => {
  const r = getRequiredTraining('senior_care_worker')
  assert.strictEqual(r.length, 13)
  assert.ok(r.includes('medication'))
})

// ── calculateCompliance: training resolution ──────────────────────────────────

console.log('\n  calculateCompliance — training resolution\n')

test('no documents → all 13 training categories missing', () => {
  const summary = calculateCompliance([])
  assert.strictEqual(summary.missingTraining.length, 13)
  assert.strictEqual(summary.satisfiedTraining.length, 0)
})

test('pending training cert does NOT satisfy compliance', () => {
  const doc = makeDoc({
    document_type:     'training_certificate',
    training_category: 'manual_handling',
    reviewed_status:   'pending',
  })
  const summary = calculateCompliance([doc])
  assert.ok(!summary.satisfiedTraining.includes('manual_handling'),
    'pending cert should NOT be satisfied')
  assert.ok(summary.missingTraining.includes('manual_handling') ||
    summary.expiredTraining.includes('manual_handling'),
    'manual_handling should still be in missing or expired')
})

test('rejected training cert does NOT satisfy compliance', () => {
  const doc = makeDoc({
    document_type:     'training_certificate',
    training_category: 'safeguarding',
    reviewed_status:   'rejected',
  })
  const summary = calculateCompliance([doc])
  assert.ok(!summary.satisfiedTraining.includes('safeguarding'))
})

test('approved training cert WITH category satisfies compliance', () => {
  const doc = makeDoc({
    document_type:     'training_certificate',
    training_category: 'manual_handling',
    reviewed_status:   'approved',
  })
  const summary = calculateCompliance([doc])
  assert.ok(summary.satisfiedTraining.includes('manual_handling'))
  assert.ok(!summary.missingTraining.includes('manual_handling'))
})

test('approved cert without training_category does NOT satisfy any training', () => {
  const doc = makeDoc({
    document_type:     'training_certificate',
    training_category: null,
    reviewed_status:   'approved',
  })
  const summary = calculateCompliance([doc])
  assert.strictEqual(summary.satisfiedTraining.length, 0)
  assert.strictEqual(summary.missingTraining.length, 13)
})

test('approved cert with expired expiry_date → moves to expiredTraining', () => {
  const doc = makeDoc({
    document_type:     'training_certificate',
    training_category: 'infection_control',
    reviewed_status:   'approved',
    expiry_date:       daysFromNow(-10),  // expired yesterday
  })
  const summary = calculateCompliance([doc])
  assert.ok(summary.expiredTraining.includes('infection_control'))
  assert.ok(summary.missingTraining.includes('infection_control'),
    'expired training should appear in missingTraining (needs attention)')
  assert.ok(!summary.satisfiedTraining.includes('infection_control'))
})

test('approved cert with future expiry → satisfied', () => {
  const doc = makeDoc({
    document_type:     'training_category',
    training_category: 'health_safety',
    reviewed_status:   'approved',
    expiry_date:       daysFromNow(180),
  })
  const summary = calculateCompliance([doc])
  // document_type mismatch — should be training_certificate
  // This tests that only training_certificate docs count
  assert.ok(!summary.satisfiedTraining.includes('health_safety'))
})

test('training_certificate with valid category and future expiry → satisfied', () => {
  const doc = makeDoc({
    document_type:     'training_certificate',
    training_category: 'health_safety',
    reviewed_status:   'approved',
    expiry_date:       daysFromNow(180),
  })
  const summary = calculateCompliance([doc])
  assert.ok(summary.satisfiedTraining.includes('health_safety'))
})

test('two approved certs for same category — one expired, one valid → satisfied', () => {
  const expiredDoc = makeDoc({
    document_type:     'training_certificate',
    training_category: 'safeguarding',
    reviewed_status:   'approved',
    expiry_date:       daysFromNow(-10),
  })
  const validDoc = makeDoc({
    document_type:     'training_certificate',
    training_category: 'safeguarding',
    reviewed_status:   'approved',
    expiry_date:       daysFromNow(90),
  })
  const summary = calculateCompliance([expiredDoc, validDoc])
  assert.ok(summary.satisfiedTraining.includes('safeguarding'),
    'Should be satisfied because there is a valid cert')
})

test('all 13 mandatory certs approved → compliant=true', () => {
  const mandatoryDocs = [
    'manual_handling', 'safeguarding', 'basic_life_support',
    'infection_control', 'health_safety', 'fire_safety',
    'safeguarding_children', 'medication', 'mental_capacity',
    'food_hygiene', 'lone_working', 'dementia_awareness', 'communication'
  ].map((cat) => makeDoc({ training_category: cat, reviewed_status: 'approved' }))

  const mandatoryDocDocs = [
    makeDoc({ document_type: 'passport',      training_category: null, reviewed_status: 'approved' }),
    makeDoc({ document_type: 'right_to_work', training_category: null, reviewed_status: 'approved' }),
    makeDoc({ document_type: 'dbs',           training_category: null, reviewed_status: 'approved' }),
  ]

  const all = [...mandatoryDocs, ...mandatoryDocDocs]
  const summary = calculateCompliance(all)
  assert.strictEqual(summary.satisfiedTraining.length, 13)
  assert.strictEqual(summary.missingTraining.length, 0)
  assert.strictEqual(summary.compliant, true)
})

test('compliance percentage accounts for missing training', () => {
  const summary = calculateCompliance([])
  // 3 required docs + 5 required training = 8 total required
  // 0 satisfied → 0%
  assert.strictEqual(summary.percentage, 0)
})

test('compliance percentage increases when training approved', () => {
  const doc = makeDoc({
    document_type:     'training_certificate',
    training_category: 'manual_handling',
    reviewed_status:   'approved',
  })
  const summary = calculateCompliance([doc])
  // 1 out of 8 required satisfied
  assert.ok(summary.percentage > 0 && summary.percentage < 100)
})

// ── calculateOnboardingStatus: training hard gate ─────────────────────────────

console.log('\n  calculateOnboardingStatus — training hard gate\n')

const BASE_STAFF = {
  first_name:               'Jane',
  last_name:                'Smith',
  date_of_birth:            '1990-01-01',
  nationality:              'British',
  address_line_1:           '1 Care St',
  city:                     'London',
  postcode:                 'SW1A 1AA',
  emergency_contact_name:   'Bob Smith',
  emergency_contact_phone:  '07000000000',
  ni_number:                'AB123456C',
  employment_type:          'full_time',
  starter_declaration:      'A',
  bank_account_number:      '12345678',
  bank_sort_code:           '12-34-56',
  bank_account_name:        'Jane Smith',
  right_to_work_checked:    true,
  dbs_checked:              true,
  dbs_expiry_date:          '2027-01-01',
  policy_acknowledged:      true,
  uploadedDocumentTypes:    ['passport', 'right_to_work', 'dbs', 'proof_of_address'],
  job_role:                 'care_worker',
}

const ALL_TRAINING = [
  'manual_handling', 'safeguarding', 'basic_life_support',
  'infection_control', 'health_safety', 'fire_safety',
  'safeguarding_children', 'medication', 'mental_capacity',
  'food_hygiene', 'lone_working', 'dementia_awareness', 'communication'
]

test('care_worker with no training → training section false', () => {
  const obs = calculateOnboardingStatus({ ...BASE_STAFF, approvedTrainingCategories: [] })
  assert.strictEqual(obs.sections.training, false)
})

test('care_worker with no training → ready is false (hard gate)', () => {
  const obs = calculateOnboardingStatus({ ...BASE_STAFF, approvedTrainingCategories: [] })
  assert.strictEqual(obs.ready, false)
})

test('care_worker with no training → missing includes training items', () => {
  const obs = calculateOnboardingStatus({ ...BASE_STAFF, approvedTrainingCategories: [] })
  assert.ok(obs.missing.some((m) => m.startsWith('Training:')))
})

test('care_worker with partial training (3 of 13) → still not ready', () => {
  const obs = calculateOnboardingStatus({
    ...BASE_STAFF,
    approvedTrainingCategories: ['manual_handling', 'safeguarding', 'basic_life_support'],
  })
  assert.strictEqual(obs.ready, false)
  assert.strictEqual(obs.sections.training, false)
})

test('care_worker with ALL 13 training categories → training section true', () => {
  const obs = calculateOnboardingStatus({ ...BASE_STAFF, approvedTrainingCategories: ALL_TRAINING })
  assert.strictEqual(obs.sections.training, true)
})

test('care_worker with ALL training + all other fields → ready true', () => {
  const obs = calculateOnboardingStatus({ ...BASE_STAFF, approvedTrainingCategories: ALL_TRAINING })
  assert.strictEqual(obs.ready, true)
})

test('getNextActions: complete_training present when training missing', () => {
  const { getNextActions: ga } = require('../../lib/staff/calculateOnboardingStatus')
  const obs = calculateOnboardingStatus({ ...BASE_STAFF, approvedTrainingCategories: [] })
  const actions = ga(obs) as Array<{ id: string; urgent: boolean; section: string }>
  const ta = actions.find((a) => a.id === 'complete_training')
  assert.ok(ta, 'Expected complete_training action')
  assert.strictEqual(ta!.urgent, true)
})

test('getNextActions: NO complete_training action when all training satisfied', () => {
  const { getNextActions: ga } = require('../../lib/staff/calculateOnboardingStatus')
  const obs = calculateOnboardingStatus({ ...BASE_STAFF, approvedTrainingCategories: ALL_TRAINING })
  const actions = ga(obs) as Array<{ id: string }>
  const ta = actions.find((a) => a.id === 'complete_training')
  assert.strictEqual(ta, undefined)
})

test('role with no job_role → DEFAULT_CARE_TRAINING still required', () => {
  const obs = calculateOnboardingStatus({
    ...BASE_STAFF,
    job_role: null,
    approvedTrainingCategories: [],
  })
  assert.strictEqual(obs.sections.training, false)
})

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n  ${passed + failed} tests: ${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
