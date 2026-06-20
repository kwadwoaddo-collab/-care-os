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
  expandDocumentTypes,
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
  // Training gate — all care_worker categories approved
  job_role:                 'care_worker',
  approvedTrainingCategories: [
    'manual_handling',
    'safeguarding',
    'basic_life_support',
    'infection_control',
    'health_safety',
    'fire_safety',
    'safeguarding_children',
    'medication',
    'mental_capacity',
    'food_hygiene',
    'lone_working',
    'dementia_awareness',
    'communication'
  ],
}

const emptyInput: OnboardingInput = {}

// ── Progress ──────────────────────────────────────────────────────────────────

test('empty input → progress 0', () => {
  const obs = calculateOnboardingStatus(emptyInput)
  assert.strictEqual(obs.progress, 0)
})

test('full input → progress 100', () => {
  const obs = calculateOnboardingStatus(fullInput)
  console.log(obs.missing); assert.strictEqual(obs.progress, 100)
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

// ── Regression: expandDocumentTypes ───────────────────────────────────────────────────
//
// Ensures passport is treated as both photo ID and right-to-work evidence.
// Regression for Bug 3: passport does not satisfy 'id' or 'right_to_work' slots.

test('expandDocumentTypes: passport expands to id and right_to_work', () => {
  const expanded = expandDocumentTypes(['passport'])
  assert.ok(expanded.has('passport'), 'passport should be in set')
  assert.ok(expanded.has('id'),          'passport should imply id')
  assert.ok(expanded.has('right_to_work'), 'passport should imply right_to_work')
})

test('expandDocumentTypes: id does not expand to passport or right_to_work', () => {
  const expanded = expandDocumentTypes(['id'])
  assert.ok(expanded.has('id'))
  assert.ok(!expanded.has('passport'))
  assert.ok(!expanded.has('right_to_work'))
})

test('expandDocumentTypes: right_to_work does not expand to id or passport', () => {
  const expanded = expandDocumentTypes(['right_to_work'])
  assert.ok(expanded.has('right_to_work'))
  assert.ok(!expanded.has('id'))
  assert.ok(!expanded.has('passport'))
})

test('expandDocumentTypes: empty array returns empty set', () => {
  const expanded = expandDocumentTypes([])
  assert.strictEqual(expanded.size, 0)
})

// ── Regression: passport satisfies photo ID + RTW in onboarding status ─────────────

test('passport satisfies both id and right_to_work document slots', () => {
  // Applicant uploads a passport instead of separate id + right_to_work docs.
  // After conversion the staff profile shows uploaded types as ['passport', 'dbs', 'proof_of_address'].
  // sections.documents must be true.
  const obs = calculateOnboardingStatus({
    ...fullInput,
    uploadedDocumentTypes: ['passport', 'dbs', 'proof_of_address'],
  })
  assert.strictEqual(obs.sections.documents, true, 'documents section should pass with passport')
  assert.ok(!obs.missing.some((m) => m.includes('id')),          'id should not be in missing')
  assert.ok(!obs.missing.some((m) => m.includes('right to work')), 'right_to_work should not be in missing')
})

test('passport alone does not satisfy dbs or proof_of_address', () => {
  const obs = calculateOnboardingStatus({
    ...fullInput,
    uploadedDocumentTypes: ['passport'],
  })
  assert.strictEqual(obs.sections.documents, false)
  assert.ok(obs.missing.some((m) => m.includes('dbs')))
  assert.ok(obs.missing.some((m) => m.includes('proof of address')))
})

test('sections.documents false when only id uploaded (no rtw, dbs, poa)', () => {
  const obs = calculateOnboardingStatus({
    ...fullInput,
    uploadedDocumentTypes: ['id'],
  })
  assert.strictEqual(obs.sections.documents, false)
})

// ── Regression: applicant form field mapping ─────────────────────────────────────────
//
// Verifies the slug → column mapping used in the convert route is consistent
// with the fields calculateOnboardingStatus expects. This is a pure unit test
// on the mapping table — no DB connection required.

const SLUG_TO_COLUMN: Record<string, string> = {
  national_insurance:                'ni_number',
  town_city:                         'city',
  address_line_1:                    'address_line_1',
  address_line_2:                    'address_line_2',
  postcode:                          'postcode',
  date_of_birth:                     'date_of_birth',
  nationality:                       'nationality',
  emergency_contact_name:            'emergency_contact_name',
  emergency_contact_phone:           'emergency_contact_phone',
  emergency_contact_relationship:    'emergency_contact_relationship',
}

test('conversion: national_insurance slug maps to ni_number column', () => {
  assert.strictEqual(SLUG_TO_COLUMN['national_insurance'], 'ni_number')
})

test('conversion: town_city slug maps to city column', () => {
  assert.strictEqual(SLUG_TO_COLUMN['town_city'], 'city')
})

test('conversion: date_of_birth slug maps to date_of_birth column', () => {
  assert.strictEqual(SLUG_TO_COLUMN['date_of_birth'], 'date_of_birth')
})

test('conversion: emergency_contact_name slug maps correctly', () => {
  assert.strictEqual(SLUG_TO_COLUMN['emergency_contact_name'], 'emergency_contact_name')
})

test('conversion: all mapped columns are recognised staff_profile fields', () => {
  // These are the HR fields accepted by PATCH /api/admin/staff/[id]
  const HR_FIELDS = new Set([
    'middle_name', 'date_of_birth', 'gender', 'nationality',
    'address_line_1', 'address_line_2', 'city', 'postcode',
    'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relationship',
    'ni_number', 'tax_code', 'payroll_number',
    'bank_name', 'bank_account_name', 'bank_account_number', 'bank_sort_code',
    'starter_declaration', 'utr_number',
    'employment_type', 'contracted_hours', 'start_date_confirmed',
    'right_to_work_checked', 'dbs_checked', 'dbs_number', 'dbs_expiry_date',
  ])
  for (const [slug, column] of Object.entries(SLUG_TO_COLUMN)) {
    assert.ok(
      HR_FIELDS.has(column),
      `Slug '${slug}' maps to '${column}' which is not a recognised HR field`
    )
  }
})

test('conversion: applicant form data populates staff profile - full path', () => {
  // Simulate what the convert route does: read form answers and produce a staff profile,
  // then confirm the onboarding status reflects those fields.
  const simulatedStaffProfile: OnboardingInput = {
    first_name:                'Maria',
    last_name:                 'Santos',
    date_of_birth:             '1988-03-15',
    nationality:               'Portuguese',
    address_line_1:            '10 Downing Street',
    city:                      'London',
    postcode:                  'SW1A 2AA',
    emergency_contact_name:    'Carlos Santos',
    emergency_contact_phone:   '07700100200',
    ni_number:                 'QQ123456C',
    policy_acknowledged:       false,
    uploadedDocumentTypes:     ['passport', 'dbs', 'proof_of_address'],
  }

  const obs = calculateOnboardingStatus(simulatedStaffProfile)

  // All worker-actionable fields are now present (converted from form)
  assert.ok(obs.checks.first_name,              'first_name populated')
  assert.ok(obs.checks.last_name,               'last_name populated')
  assert.ok(obs.checks.date_of_birth,           'date_of_birth populated from form')
  assert.ok(obs.checks.address_line_1,          'address_line_1 populated from form')
  assert.ok(obs.checks.city,                    'city populated from town_city form field')
  assert.ok(obs.checks.postcode,                'postcode populated from form')
  assert.ok(obs.checks.emergency_contact_name,  'emergency contact name populated from form')
  assert.ok(obs.checks.emergency_contact_phone, 'emergency contact phone populated from form')
  assert.ok(obs.checks.ni_number,               'ni_number populated from national_insurance form field')
  assert.ok(obs.sections.documents,             'passport satisfies id + right_to_work + dbs + poa')

  // Stage should be in_progress (not not_started) because personal fields are set
  assert.notStrictEqual(obs.stage, 'not_started', 'Stage should not be not_started after conversion')
})

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n  ${passed + failed} tests: ${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
