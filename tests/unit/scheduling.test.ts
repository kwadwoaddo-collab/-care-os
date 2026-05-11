/**
 * tests/unit/scheduling.test.ts
 *
 * Unit tests for lib/scheduling utilities.
 * Run with:  npm run test:unit
 */

import assert from 'node:assert/strict'
import { detectConflicts, type ConflictCheckInput } from '../../lib/scheduling/detectConflicts'
import { weeklyHoursRisk }                          from '../../lib/scheduling/weeklyHoursRisk'
import { checkLateAcknowledgement }                 from '../../lib/scheduling/lateAcknowledgement'
import { hasShiftOverlap, type ShiftSpan }          from '../../lib/shifts/hasShiftOverlap'
import { type StaffAvailability }                   from '../../lib/staff/types'

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

function makeAvailability(overrides: Partial<StaffAvailability> = {}): StaffAvailability {
  const day = { available: true, start_time: '08:00', end_time: '20:00', notes: '' }
  return {
    staff_profile_id:     'test-staff',
    monday:    { ...day },
    tuesday:   { ...day },
    wednesday: { ...day },
    thursday:  { ...day },
    friday:    { ...day },
    saturday:  { available: false, start_time: '', end_time: '', notes: '' },
    sunday:    { available: false, start_time: '', end_time: '', notes: '' },
    max_weekly_hours:     40,
    preferred_shift_type: null,
    can_work_nights:      false,
    can_work_weekends:    false,
    is_driver:            false,
    has_own_car:          false,
    work_areas:           [],
    unavailable_dates:    [],
    notes:                null,
    ...overrides,
  }
}

// Monday 2026-05-11 (the project's "today" reference)
const MONDAY_SHIFT: ShiftSpan = {
  shift_date: '2026-05-11',
  start_time: '09:00',
  end_time:   '17:00',
}

const BASE_INPUT: ConflictCheckInput = {
  targetShift:            MONDAY_SHIFT,
  staffStatus:            'active',
  availability:           makeAvailability(),
  existingShifts:         [],
  complianceExpired:      [],
  complianceExpiringSoon: [],
}

// ── hasShiftOverlap ───────────────────────────────────────────────────────────

console.log('\nhasShiftOverlap:')

test('no existing shifts — no overlap', () => {
  assert.strictEqual(hasShiftOverlap(MONDAY_SHIFT, []), false)
})

test('identical shift — overlaps', () => {
  assert.strictEqual(hasShiftOverlap(MONDAY_SHIFT, [MONDAY_SHIFT]), true)
})

test('adjacent shifts (back-to-back) — no overlap', () => {
  const morning: ShiftSpan = { shift_date: '2026-05-11', start_time: '06:00', end_time: '09:00' }
  const afternoon: ShiftSpan = { shift_date: '2026-05-11', start_time: '09:00', end_time: '14:00' }
  assert.strictEqual(hasShiftOverlap(afternoon, [morning]), false)
})

test('partially overlapping shifts — overlaps', () => {
  const existing: ShiftSpan = { shift_date: '2026-05-11', start_time: '08:00', end_time: '11:00' }
  assert.strictEqual(hasShiftOverlap(MONDAY_SHIFT, [existing]), true)
})

test('overnight shift — overlaps into next day', () => {
  const overnight: ShiftSpan = { shift_date: '2026-05-11', start_time: '22:00', end_time: '06:00' }
  const nextDayMorning: ShiftSpan = { shift_date: '2026-05-12', start_time: '04:00', end_time: '08:00' }
  assert.strictEqual(hasShiftOverlap(overnight, [nextDayMorning]), true)
})

test('overnight shift on different days — no overlap', () => {
  const overnight: ShiftSpan  = { shift_date: '2026-05-11', start_time: '22:00', end_time: '06:00' }
  const future: ShiftSpan     = { shift_date: '2026-05-13', start_time: '09:00', end_time: '17:00' }
  assert.strictEqual(hasShiftOverlap(overnight, [future]), false)
})

// ── detectConflicts ───────────────────────────────────────────────────────────

console.log('\ndetectConflicts:')

test('no issues — no conflicts, no warnings', () => {
  const result = detectConflicts(BASE_INPUT)
  assert.strictEqual(result.hasBlock, false)
  assert.strictEqual(result.conflicts.length, 0)
  assert.strictEqual(result.warnings.length, 0)
})

test('inactive staff — blocks', () => {
  const result = detectConflicts({ ...BASE_INPUT, staffStatus: 'suspended' })
  assert.strictEqual(result.hasBlock, true)
  assert.ok(result.conflicts.some((c) => c.type === 'staff_inactive'))
})

test('shift overlap — blocks', () => {
  const result = detectConflicts({ ...BASE_INPUT, existingShifts: [MONDAY_SHIFT] })
  assert.strictEqual(result.hasBlock, true)
  assert.ok(result.conflicts.some((c) => c.type === 'shift_overlap'))
})

test('unavailable date — blocks', () => {
  const avail = makeAvailability({ unavailable_dates: ['2026-05-11'] })
  const result = detectConflicts({ ...BASE_INPUT, availability: avail })
  assert.strictEqual(result.hasBlock, true)
  assert.ok(result.conflicts.some((c) => c.type === 'unavailable_date'))
})

test('day not available — blocks', () => {
  // Saturday shift, worker not available Saturdays
  const satShift: ShiftSpan = { shift_date: '2026-05-16', start_time: '09:00', end_time: '17:00' }
  const result = detectConflicts({ ...BASE_INPUT, targetShift: satShift })
  assert.strictEqual(result.hasBlock, true)
  assert.ok(result.conflicts.some((c) => c.type === 'day_not_available'))
})

test('expired compliance — blocks', () => {
  const result = detectConflicts({ ...BASE_INPUT, complianceExpired: ['dbs', 'passport'] })
  assert.strictEqual(result.hasBlock, true)
  assert.ok(result.conflicts.some((c) => c.type === 'compliance_expired'))
})

test('expiring compliance — warns only (does not block)', () => {
  const result = detectConflicts({ ...BASE_INPUT, complianceExpiringSoon: ['dbs'] })
  assert.strictEqual(result.hasBlock, false)
  assert.ok(result.warnings.some((w) => w.type === 'compliance_expiring'))
})

test('weekly hours exceeded — warns only', () => {
  // max 40h, 38h already scheduled, 8h shift → 46h projected
  const result = detectConflicts({
    ...BASE_INPUT,
    scheduledMinutesThisWeek: 38 * 60,
  })
  assert.strictEqual(result.hasBlock, false)
  assert.ok(result.warnings.some((w) => w.type === 'weekly_hours_risk'))
})

test('weekly hours not exceeded — no warning', () => {
  // max 40h, 20h already scheduled, 8h shift → 28h projected
  const result = detectConflicts({
    ...BASE_INPUT,
    scheduledMinutesThisWeek: 20 * 60,
  })
  assert.strictEqual(result.warnings.some((w) => w.type === 'weekly_hours_risk'), false)
})

test('late ack pattern threshold — warns when >= 2', () => {
  const result = detectConflicts({ ...BASE_INPUT, lateAckCount: 3 })
  assert.ok(result.warnings.some((w) => w.type === 'missing_acknowledgement_pattern'))
})

test('late ack count below threshold — no warning', () => {
  const result = detectConflicts({ ...BASE_INPUT, lateAckCount: 1 })
  assert.strictEqual(result.warnings.some((w) => w.type === 'missing_acknowledgement_pattern'), false)
})

test('all property: contains both blocks and warnings', () => {
  const result = detectConflicts({
    ...BASE_INPUT,
    staffStatus:            'suspended',
    complianceExpiringSoon: ['dbs'],
  })
  assert.ok(result.all.some((c) => c.severity === 'block'))
  assert.ok(result.all.some((c) => c.severity === 'warn'))
})

// ── weeklyHoursRisk ───────────────────────────────────────────────────────────

console.log('\nweeklyHoursRisk:')

test('no max hours — always none risk', () => {
  const result = weeklyHoursRisk(30 * 60, '09:00', '17:00', null)
  assert.strictEqual(result.risk, 'none')
  assert.strictEqual(result.maxHours, null)
})

test('well under limit — none risk', () => {
  const result = weeklyHoursRisk(20 * 60, '09:00', '17:00', 40)
  assert.strictEqual(result.risk, 'none')
})

test('over 90% but not over limit — close risk', () => {
  // 38h scheduled + 4h shift = 42h projected < max 40h but wait...
  // 90% of 40 = 36. 30h + 8h = 38h > 36h, so close
  const result = weeklyHoursRisk(30 * 60, '09:00', '17:00', 40)
  assert.strictEqual(result.risk, 'close')
})

test('over limit — over risk', () => {
  // 38h already + 8h = 46h > 40h
  const result = weeklyHoursRisk(38 * 60, '09:00', '17:00', 40)
  assert.strictEqual(result.risk, 'over')
  assert.ok(result.message !== null)
})

test('overnight shift duration handled correctly', () => {
  // 22:00–06:00 = 8h
  const result = weeklyHoursRisk(0, '22:00', '06:00', 40)
  assert.strictEqual(result.projectedHours, 8)
})

test('projected hours is accurate', () => {
  // 10h already + 8h = 18h
  const result = weeklyHoursRisk(10 * 60, '09:00', '17:00', 40)
  assert.strictEqual(result.projectedHours, 18)
})

// ── checkLateAcknowledgement ──────────────────────────────────────────────────

console.log('\ncheckLateAcknowledgement:')

test('empty history — no pattern', () => {
  const result = checkLateAcknowledgement([])
  assert.strictEqual(result.hasPattern, false)
  assert.strictEqual(result.totalChecked, 0)
})

test('all acknowledged on time — no pattern', () => {
  function daysAgo(n: number) {
    const d = new Date(); d.setDate(d.getDate() - n)
    return d.toISOString().slice(0, 10)
  }
  // Shifts 5 and 10 days ago, acknowledged 2 days before each shift
  const shifts = [
    {
      shift_date:        daysAgo(5),
      start_time:        '09:00',
      worker_ack_status: 'accepted',
      worker_ack_at:     new Date(Date.now() - 7 * 86_400_000).toISOString(),
    },
    {
      shift_date:        daysAgo(10),
      start_time:        '09:00',
      worker_ack_status: 'accepted',
      worker_ack_at:     new Date(Date.now() - 12 * 86_400_000).toISOString(),
    },
  ]
  const result = checkLateAcknowledgement(shifts)
  assert.strictEqual(result.hasPattern, false)
  assert.strictEqual(result.lateCount, 0)
})

test('two past shifts with no response — pattern detected', () => {
  // Use dynamic dates 5 and 10 days ago to stay inside the 30-day window
  function daysAgo(n: number) {
    const d = new Date(); d.setDate(d.getDate() - n)
    return d.toISOString().slice(0, 10)
  }
  const shifts = [
    { shift_date: daysAgo(5),  start_time: '09:00', worker_ack_status: null, worker_ack_at: null },
    { shift_date: daysAgo(10), start_time: '09:00', worker_ack_status: null, worker_ack_at: null },
  ]
  const result = checkLateAcknowledgement(shifts)
  assert.strictEqual(result.hasPattern, true)
  assert.strictEqual(result.noResponseCount, 2)
  assert.ok(result.message !== null)
})

test('shifts outside window — not counted', () => {
  const shifts = [
    {
      shift_date:        '2025-01-01',
      start_time:        '09:00',
      worker_ack_status: null,
      worker_ack_at:     null,
    },
    {
      shift_date:        '2025-02-01',
      start_time:        '09:00',
      worker_ack_status: null,
      worker_ack_at:     null,
    },
  ]
  const result = checkLateAcknowledgement(shifts, 30)
  assert.strictEqual(result.totalChecked, 0)
  assert.strictEqual(result.hasPattern, false)
})

test('one declined — counted correctly', () => {
  const d = new Date(); d.setDate(d.getDate() - 3)
  const shifts = [
    {
      shift_date:        d.toISOString().slice(0, 10),
      start_time:        '09:00',
      worker_ack_status: 'declined',
      worker_ack_at:     null,
    },
  ]
  const result = checkLateAcknowledgement(shifts)
  assert.strictEqual(result.declinedCount, 1)
  assert.strictEqual(result.hasPattern, false)
})

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n  ${passed + failed} tests: ${passed} passed, ${failed} failed\n`)
if (failed > 0) process.exit(1)
