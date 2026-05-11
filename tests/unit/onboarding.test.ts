/**
 * tests/unit/onboarding.test.ts
 *
 * Unit tests for lib/staff/calculateOnboardingStatus.ts
 * Run with:  npm run test:unit
 */

import assert from 'node:assert/strict'
import {
  calculateOnboardingStatus,
  getNextActions,
  type OnboardingInput,
} from '../../lib/staff/calculateOnboardingStatus'

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

// ── Fixtures ──────────────────────────────────────────────────────────────────

const fullInput: OnboardingInput = {
  first_name:               'Jane',
  last_name:                'Smith',
  date_of_birth:            '1990-01-01',
  nationality:              'British',
  address_line_1:           '123 Care Lane',
  city:                     'London',
  postcode:                 'SW1A 1AA',
  emergency_contact_name:   'John Smith',
  emergency_contact_phone:  '07700900000',
  ni_number:                'AB123456C',
  employment_type:          'full_time',
  starter_declaration:      'A',
  bank_account_number:      '12345678',
  bank_sort_code:           '20-00-00',
  bank_account_name:        'Jane Smith',
  right_to_work_checked:    true,
  dbs_checked:              true,
  dbs_expiry_date:          '2027-01-01',
  policy_acknowledged:      true,
  uploadedDocumentTypes:    ['id', 'right_to_work', 'dbs', 'proof_of_address'],
}

const emptyInput: OnboardingInput = {}

// ── Progress ──────────────────────────────────────────────────────────────────

test('empty input → progress 0', () => {
  const obs = calculateOnboardingStatus(emptyInput)
  assert.strictEqual(obs.progress, 0)
})

test('full input → progress 100', () => {
  const obs = calculateOnboardingStatus(fullInput)
  assert.strictEqual(obs.progress, 100)
})

test('partial input → progress between 0 and 100', () => {
  const obs = calculateOnboardingStatus({ first_name: 'Jane', last_name: 'Smith' })
  assert.ok(obs.progress > 0 && obs.progress < 100, `Expected between 0 and 100, got ${obs.progress}`)
})

// ── Ready flag ────────────────────────────────────────────────────────────────

test('empty input → ready false', () => {
  const obs = calculateOnboardingStatus(emptyInput)
  assert.strictEqual(obs.ready, false)
})

test('full input → ready true', () => {
  const obs = calculateOnboardingStatus(fullInput)
  assert.strictEqual(obs.ready, true)
})

test('full input but policy_acknowledged false → not ready', () => {
  const obs = calculateOnboardingStatus({ ...fullInput, policy_acknowledged: false })
  assert.strictEqual(obs.ready, false)
  assert.ok(obs.missing.includes('Policy acknowledgement'))
})

// ── Stage computation ─────────────────────────────────────────────────────────

test('empty input → stage not_started', () => {
  const obs = calculateOnboardingStatus(emptyInput)
  assert.strictEqual(obs.stage, 'not_started')
})

test('full input → stage complete', () => {
  const obs = calculateOnboardingStatus(fullInput)
  assert.strictEqual(obs.stage, 'complete')
})

test('worker tasks done but no HMRC → stage awaiting_review', () => {
  // Worker done = personal + address + emergency + documents + policy
  // But HMRC/banking/employment/compliance incomplete → ready=false but workerDone=true
  const obs = calculateOnboardingStatus({
    first_name:               'Jane',
    last_name:                'Smith',
    date_of_birth:            '1990-01-01',
    nationality:              'British',
    address_line_1:           '123 Care Lane',
    city:                     'London',
    postcode:                 'SW1A 1AA',
    emergency_contact_name:   'John Smith',
    emergency_contact_phone:  '07700900000',
    policy_acknowledged:      true,
    uploadedDocumentTypes:    ['id', 'right_to_work', 'dbs', 'proof_of_address'],
    // Missing HMRC, banking, employment, compliance
  })
  assert.strictEqual(obs.stage, 'awaiting_review')
})

test('partial personal details → stage in_progress', () => {
  const obs = calculateOnboardingStatus({ first_name: 'Jane', last_name: 'Smith' })
  assert.strictEqual(obs.stage, 'in_progress')
})

// ── Sections ──────────────────────────────────────────────────────────────────

test('sections.policy true when policy_acknowledged', () => {
  const obs = calculateOnboardingStatus({ ...fullInput })
  assert.strictEqual(obs.sections.policy, true)
})

test('sections.policy false when policy_acknowledged false', () => {
  const obs = calculateOnboardingStatus({ ...fullInput, policy_acknowledged: false })
  assert.strictEqual(obs.sections.policy, false)
})

test('sections.policy false when policy_acknowledged null', () => {
  const obs = calculateOnboardingStatus({ ...fullInput, policy_acknowledged: null })
  assert.strictEqual(obs.sections.policy, false)
})

test('sections.documents true when all mandatory types uploaded', () => {
  const obs = calculateOnboardingStatus({
    ...fullInput,
    uploadedDocumentTypes: ['id', 'right_to_work', 'dbs', 'proof_of_address'],
  })
  assert.strictEqual(obs.sections.documents, true)
})

test('sections.documents false when mandatory type missing', () => {
  const obs = calculateOnboardingStatus({
    ...fullInput,
    uploadedDocumentTypes: ['id'], // missing rtw, dbs, proof_of_address
  })
  assert.strictEqual(obs.sections.documents, false)
})

// ── Payroll ready ─────────────────────────────────────────────────────────────

test('full input → payroll_ready true', () => {
  const obs = calculateOnboardingStatus(fullInput)
  assert.strictEqual(obs.payroll_ready, true)
})

test('missing NI → payroll_ready false', () => {
  const obs = calculateOnboardingStatus({ ...fullInput, ni_number: null })
  assert.strictEqual(obs.payroll_ready, false)
})

test('missing bank → payroll_ready false', () => {
  const obs = calculateOnboardingStatus({ ...fullInput, bank_account_number: null })
  assert.strictEqual(obs.payroll_ready, false)
})

// ── getNextActions ────────────────────────────────────────────────────────────

test('getNextActions: empty input returns non-empty list', () => {
  const obs     = calculateOnboardingStatus(emptyInput)
  const actions = getNextActions(obs)
  assert.ok(actions.length > 0, 'Expected at least one next action')
})

test('getNextActions: full input returns empty list', () => {
  const obs     = calculateOnboardingStatus(fullInput)
  const actions = getNextActions(obs)
  assert.strictEqual(actions.length, 0)
})

test('getNextActions: policy not acknowledged → acknowledge_policy action present', () => {
  const obs     = calculateOnboardingStatus({ ...fullInput, policy_acknowledged: false })
  const actions = getNextActions(obs)
  assert.ok(actions.some((a) => a.id === 'acknowledge_policy'))
})

test('getNextActions: urgent actions appear for missing docs', () => {
  const obs     = calculateOnboardingStatus({ ...fullInput, uploadedDocumentTypes: [] })
  const actions = getNextActions(obs)
  const urgentActions = actions.filter((a) => a.urgent)
  assert.ok(urgentActions.length > 0, 'Expected at least one urgent action for missing docs')
})

// ── Missing array ─────────────────────────────────────────────────────────────

test('missing array contains Policy acknowledgement when not acknowledged', () => {
  const obs = calculateOnboardingStatus({ ...fullInput, policy_acknowledged: false })
  assert.ok(obs.missing.includes('Policy acknowledgement'))
})

test('missing array is empty when fully complete', () => {
  const obs = calculateOnboardingStatus(fullInput)
  assert.strictEqual(obs.missing.length, 0)
})

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n  ${passed + failed} tests: ${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
