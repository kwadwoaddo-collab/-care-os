// lib/scheduling/assignmentSafety.ts
//
// Master pre-assignment safety engine.
// Evaluates every relevant constraint before a shift is assigned and returns
// a structured, explainable outcome with severity, rule, and override path.

import type { ComplianceState }           from '@/lib/compliance/calculateCompliance'
import type { StaffAvailability, DayKey } from '@/lib/staff/types'
import { hasShiftOverlap }                from '@/lib/shifts/hasShiftOverlap'
import type { ShiftSpan }                 from '@/lib/shifts/hasShiftOverlap'
import { checkFatigue }                   from './restPeriod'
import { weeklyHoursRisk }                from './weeklyHoursRisk'

// ── Outcome types ─────────────────────────────────────────────────────────────

export type AssignmentOutcome =
  | 'safe_to_assign'
  | 'assign_with_warning'
  | 'blocked_assignment'

export interface SafetyCheck {
  id:                string
  result:            'pass' | 'warn' | 'block'
  severity:          'critical' | 'high' | 'medium' | 'low'
  rule:              string
  message:           string
  detail:            string
  recommendedAction: string
  overridePath:      string | null
  affectedItem:      string | null
  daysUntilExpiry:   number | null
}

export interface AssignmentSafetyResult {
  outcome:  AssignmentOutcome
  blocks:   SafetyCheck[]
  warnings: SafetyCheck[]
  passed:   SafetyCheck[]
  summary:  string
}

// ── Input ─────────────────────────────────────────────────────────────────────

export interface SafetyInput {
  staffStatus:              string
  jobRole:                  string | null
  onboardingComplete:       boolean
  targetShift:              ShiftSpan
  complianceState:          ComplianceState
  compliancePercent:        number
  expiredDocuments:         string[]
  missingDocuments:         string[]
  expiredTraining:          string[]
  missingTraining:          string[]
  expiringSoon:             Array<{ key: string; label: string; daysUntilExpiry: number }>
  activeOverride:           boolean
  availability:             StaffAvailability | null
  existingShifts:           ShiftSpan[]
  scheduledMinutesThisWeek: number
  lateAckCount?:            number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const WEEKLY_HARD_BLOCK_H = 60
const WEEKLY_WARN_H       = 48

const DAY_NAMES: DayKey[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function dayKeyFromDate(shiftDate: string): DayKey {
  return DAY_NAMES[new Date(shiftDate + 'T12:00:00Z').getUTCDay()]!
}

function safetyCheck(
  id:                string,
  result:            SafetyCheck['result'],
  severity:          SafetyCheck['severity'],
  rule:              string,
  message:           string,
  detail:            string,
  recommendedAction: string,
  overridePath:      string | null = null,
  affectedItem:      string | null = null,
  daysUntilExpiry:   number | null = null,
): SafetyCheck {
  return { id, result, severity, rule, message, detail, recommendedAction, overridePath, affectedItem, daysUntilExpiry }
}

// ── Main engine ───────────────────────────────────────────────────────────────

export function evaluateAssignmentSafety(input: SafetyInput): AssignmentSafetyResult {
  const checks: SafetyCheck[] = []

  const {
    staffStatus, onboardingComplete, targetShift,
    complianceState, compliancePercent,
    expiredDocuments, missingDocuments, expiredTraining, missingTraining, expiringSoon,
    activeOverride, availability, existingShifts,
    scheduledMinutesThisWeek, lateAckCount,
  } = input

  // ── 1. Staff status ────────────────────────────────────────────────────────

  if (staffStatus === 'terminated' || staffStatus === 'inactive') {
    checks.push(safetyCheck(
      'staff_inactive', 'block', 'critical', 'staff_inactive',
      'Worker is no longer active',
      `Staff status is "${staffStatus}". Terminated or inactive workers cannot be assigned to shifts.`,
      'Review the worker record. Reinstate only if appropriate.',
    ))
  } else if (staffStatus === 'suspended') {
    checks.push(safetyCheck(
      'staff_suspended', 'block', 'critical', 'staff_suspended',
      'Worker is currently suspended',
      'Suspended workers cannot be assigned until the suspension is lifted.',
      'Review the suspension. Lift via Admin → Staff → Change Status if resolved.',
    ))
  } else {
    checks.push(safetyCheck('staff_active', 'pass', 'low', 'staff_inactive', 'Staff is active', `Status: ${staffStatus}.`, ''))
  }

  // ── 2. Onboarding ──────────────────────────────────────────────────────────

  if (staffStatus === 'pre_employment') {
    checks.push(safetyCheck(
      'pre_employment_block', 'block', 'high', 'onboarding_complete',
      'Worker is in pre-employment — onboarding not yet complete',
      'All onboarding steps must be completed and approved before shift assignment is allowed.',
      'Complete the onboarding checklist at Admin → Staff → Onboarding.',
    ))
  } else if (!onboardingComplete) {
    checks.push(safetyCheck(
      'onboarding_incomplete', 'warn', 'medium', 'onboarding_complete',
      'Onboarding marked as incomplete',
      'Worker is active but their onboarding record is not fully signed off.',
      'Review onboarding at Admin → Staff → [Worker] → Onboarding and complete any outstanding steps.',
    ))
  } else {
    checks.push(safetyCheck('onboarding_ok', 'pass', 'low', 'onboarding_complete', 'Onboarding complete', 'All onboarding steps are complete.', ''))
  }

  // ── 3. Compliance state ────────────────────────────────────────────────────

  const hasComplianceBlock = (complianceState === 'blocked' || complianceState === 'non_compliant') && !activeOverride

  if (hasComplianceBlock) {
    const allItems = [
      ...missingDocuments.map((k) => `${k.replace(/_/g, ' ')} (missing)`),
      ...expiredDocuments.map((k) => `${k.replace(/_/g, ' ')} (expired)`),
      ...missingTraining.map((k) => `${k.replace(/_/g, ' ')} training (${expiredTraining.includes(k) ? 'expired' : 'missing'})`),
    ]
    const preview = allItems.slice(0, 3).join(', ') + (allItems.length > 3 ? ` and ${allItems.length - 3} more` : '')
    checks.push(safetyCheck(
      'compliance_blocked', 'block', 'critical', 'compliance_state',
      complianceState === 'blocked'
        ? 'Mandatory training missing or expired'
        : 'Required compliance documents missing or expired',
      `Blocking items: ${preview}.`,
      'Go to Admin → Staff → [Worker] → Documents and upload or renew the required items.',
      'A compliance_manager or company_admin can grant a temporary override at Admin → Staff → [Worker] → Compliance.',
    ))
  } else if (activeOverride) {
    checks.push(safetyCheck(
      'compliance_override', 'warn', 'high', 'compliance_override',
      'Compliance override is active — deploying under exception',
      `This worker has a compliance gap (${compliancePercent}%) but an admin has granted a temporary deployment override.`,
      'Ensure the underlying compliance issue is being actively resolved before the override expires.',
    ))
  } else {
    checks.push(safetyCheck('compliance_ok', 'pass', 'low', 'compliance_state', 'Compliance checks passed', `Compliance score: ${compliancePercent}%.`, ''))
  }

  // ── 4. Expiring items ──────────────────────────────────────────────────────

  for (const item of expiringSoon) {
    const d = item.daysUntilExpiry
    if (d <= 3) {
      checks.push(safetyCheck(
        `expiry_critical_${item.key}`, 'warn', 'high', 'compliance_expiry',
        `${item.label} expires in ${d} day${d !== 1 ? 's' : ''}`,
        `${item.label} will expire very soon. Once expired, this worker will be automatically blocked from new assignments.`,
        `Renew ${item.label} and upload the updated document immediately.`,
        null, item.label, d,
      ))
    } else if (d <= 7) {
      checks.push(safetyCheck(
        `expiry_7d_${item.key}`, 'warn', 'medium', 'compliance_expiry',
        `${item.label} expires in ${d} days`,
        `${item.label} expires within 7 days. If not renewed before the shift date, this worker may be blocked.`,
        `Arrange renewal of ${item.label} before it expires.`,
        null, item.label, d,
      ))
    } else if (d <= 14) {
      checks.push(safetyCheck(
        `expiry_14d_${item.key}`, 'warn', 'low', 'compliance_expiry',
        `${item.label} expires in ${d} days`,
        `${item.label} expires in under two weeks. Plan renewal soon.`,
        `Book renewal for ${item.label}.`,
        null, item.label, d,
      ))
    }
  }

  // ── 5. Shift overlap ──────────────────────────────────────────────────────

  if (hasShiftOverlap(targetShift, existingShifts)) {
    checks.push(safetyCheck(
      'shift_overlap', 'block', 'high', 'shift_overlap',
      'Overlapping shift already assigned',
      'Worker already has a scheduled shift that overlaps with this one.',
      'Review the worker\'s shifts and resolve the conflict before assigning.',
    ))
  } else {
    checks.push(safetyCheck('no_overlap', 'pass', 'low', 'shift_overlap', 'No scheduling conflicts', 'No overlapping shifts.', ''))
  }

  // ── 6. Availability ────────────────────────────────────────────────────────

  const unavailableDates = availability?.unavailable_dates ?? []
  if (unavailableDates.includes(targetShift.shift_date)) {
    checks.push(safetyCheck(
      'unavailable_date', 'block', 'high', 'availability_date',
      `Worker marked unavailable on ${targetShift.shift_date}`,
      'Worker has explicitly blocked this date in their availability.',
      'Confirm with the worker and update their availability record if they are available.',
    ))
  } else {
    const dayKey   = dayKeyFromDate(targetShift.shift_date)
    const dayAvail = availability ? availability[dayKey] : undefined

    if (!dayAvail?.available) {
      checks.push(safetyCheck(
        'day_not_available', 'block', 'medium', 'availability_day',
        `No availability set for ${dayKey}s`,
        `Worker has not set availability for ${dayKey}s. They may not be available on this day.`,
        'Confirm with the worker and update their availability at Admin → Staff → [Worker] → Availability.',
      ))
    } else {
      checks.push(safetyCheck('day_available', 'pass', 'low', 'availability_day', `Available on ${dayKey}s`, 'Worker has set availability for this day.', ''))
    }
  }

  // ── 7. Weekly hours ────────────────────────────────────────────────────────

  const hoursRisk = weeklyHoursRisk(
    scheduledMinutesThisWeek,
    targetShift.start_time,
    targetShift.end_time,
    availability?.max_weekly_hours ?? null,
  )

  if (hoursRisk.projectedHours >= WEEKLY_HARD_BLOCK_H) {
    checks.push(safetyCheck(
      'hours_hard_block', 'block', 'high', 'weekly_hours',
      `Projected ${hoursRisk.projectedHours}h this week — exceeds ${WEEKLY_HARD_BLOCK_H}h limit`,
      `Assigning this shift would put the worker at ${hoursRisk.projectedHours}h this week, exceeding the ${WEEKLY_HARD_BLOCK_H}h operational threshold.`,
      'Review the worker\'s weekly schedule and remove shifts to bring hours within limits.',
      'A registered_manager or company_admin can override hour limits in exceptional circumstances.',
    ))
  } else if (hoursRisk.risk === 'over' && hoursRisk.maxHours) {
    checks.push(safetyCheck(
      'hours_over_max', 'warn', 'high', 'weekly_hours',
      `Would exceed ${hoursRisk.maxHours}h weekly limit (projected: ${hoursRisk.projectedHours}h)`,
      `Worker's availability sets a ${hoursRisk.maxHours}h weekly maximum. This shift would exceed it by ${Math.round(hoursRisk.projectedHours - hoursRisk.maxHours)}h.`,
      'Confirm with the worker whether they consent to working additional hours this week.',
    ))
  } else if (hoursRisk.projectedHours >= WEEKLY_WARN_H) {
    checks.push(safetyCheck(
      'hours_approaching_48', 'warn', 'medium', 'weekly_hours',
      `Worker already scheduled ${hoursRisk.projectedHours}h this week`,
      `Projected hours of ${hoursRisk.projectedHours}h approach the 48h Working Time threshold. Worker may need to have opted out of the limit.`,
      'Verify the worker has signed an opt-out agreement if working beyond 48h.',
    ))
  } else if (hoursRisk.risk === 'close') {
    checks.push(safetyCheck(
      'hours_close_to_max', 'warn', 'low', 'weekly_hours',
      `Approaching weekly limit (${hoursRisk.projectedHours}h / ${hoursRisk.maxHours ?? '—'}h)`,
      'Projected hours are within 10% of the worker\'s set weekly maximum.',
      'Monitor shift load this week.',
    ))
  } else {
    checks.push(safetyCheck('hours_ok', 'pass', 'low', 'weekly_hours', `Weekly hours: ${hoursRisk.projectedHours}h projected`, 'Hours within acceptable limits.', ''))
  }

  // ── 8. Rest period & fatigue ───────────────────────────────────────────────

  const fatigue = checkFatigue(targetShift, existingShifts)

  if (fatigue.restPeriod.level === 'block') {
    checks.push(safetyCheck(
      'rest_block', 'block', 'high', 'rest_period',
      fatigue.restPeriod.message ?? 'Insufficient rest between shifts',
      'Worker has less than the minimum required rest period between consecutive shifts.',
      'Remove or reschedule one of the conflicting shifts to provide adequate rest.',
      'A registered_manager may override in genuine emergency circumstances.',
    ))
  } else if (fatigue.restPeriod.level === 'warn') {
    checks.push(safetyCheck(
      'rest_warn', 'warn', 'medium', 'rest_period',
      fatigue.restPeriod.message ?? 'Short rest period between shifts',
      'Worker would have less than 11 hours of rest between shifts (UK Working Time Regulations recommendation).',
      'Consider rescheduling to provide the recommended 11-hour rest period.',
    ))
  } else {
    checks.push(safetyCheck('rest_ok', 'pass', 'low', 'rest_period', 'Adequate rest period', 'Sufficient rest between shifts.', ''))
  }

  if (fatigue.consecutiveDays.level === 'block') {
    checks.push(safetyCheck(
      'consec_days_block', 'block', 'high', 'consecutive_days',
      fatigue.consecutiveDays.message ?? 'Too many consecutive days worked',
      'Worker has exceeded the maximum consecutive working days limit (UK Working Time Regulations).',
      'Schedule at least one full rest day before assigning further shifts.',
    ))
  } else if (fatigue.consecutiveDays.level === 'warn') {
    checks.push(safetyCheck(
      'consec_days_warn', 'warn', 'medium', 'consecutive_days',
      fatigue.consecutiveDays.message ?? 'Many consecutive days worked',
      'Worker is approaching the consecutive working days limit.',
      'Plan a rest day within the coming days to comply with Working Time Regulations.',
    ))
  } else {
    checks.push(safetyCheck('consec_days_ok', 'pass', 'low', 'consecutive_days', `Consecutive days: ${fatigue.consecutiveDays.consecutiveDays}`, 'Within acceptable limits.', ''))
  }

  if (fatigue.nightDayFlip) {
    checks.push(safetyCheck(
      'night_day_flip', 'warn', 'medium', 'night_day_transition',
      'Night shift followed by early day shift',
      'Worker recently finished a night shift and this day shift starts within 9 hours — an increased fatigue risk.',
      'Consider assigning a different worker or adjusting the day shift start time.',
    ))
  }

  // ── 9. Late acknowledgement pattern ───────────────────────────────────────

  if (lateAckCount !== undefined && lateAckCount >= 3) {
    checks.push(safetyCheck(
      'late_ack_pattern', 'warn', 'medium', 'attendance_reliability',
      `${lateAckCount} recent shifts without timely acknowledgement`,
      'Worker has a pattern of late or missing shift acknowledgements, creating operational uncertainty.',
      'Follow up with the worker about shift communication. Consider a different worker for critical shifts.',
    ))
  } else if (lateAckCount !== undefined && lateAckCount >= 2) {
    checks.push(safetyCheck(
      'late_ack_warn', 'warn', 'low', 'attendance_reliability',
      `${lateAckCount} recent shifts without timely acknowledgement`,
      'Worker has missed timely acknowledgement on some recent shifts.',
      'Remind the worker to acknowledge shifts promptly through the worker portal.',
    ))
  }

  // ── 10. Same-day workload ─────────────────────────────────────────────────

  const sameDayCount = existingShifts.filter((s) => s.shift_date === targetShift.shift_date).length
  if (sameDayCount >= 2) {
    checks.push(safetyCheck(
      'multiple_shifts_today', 'warn', 'medium', 'workload',
      `Worker already has ${sameDayCount} shifts on this day`,
      `Assigning this shift would give the worker ${sameDayCount + 1} shifts in a single day.`,
      'Review daily shift load and confirm the worker has capacity for this additional shift.',
    ))
  }

  // ── Build result ──────────────────────────────────────────────────────────

  const blocks   = checks.filter((c) => c.result === 'block')
  const warnings = checks.filter((c) => c.result === 'warn')
  const passed   = checks.filter((c) => c.result === 'pass')

  let outcome: AssignmentOutcome
  let summary: string

  if (blocks.length > 0) {
    outcome = 'blocked_assignment'
    summary = `Blocked: ${blocks[0]!.message}`
  } else if (warnings.length > 0) {
    outcome = 'assign_with_warning'
    summary = `${warnings.length} warning${warnings.length !== 1 ? 's' : ''}: ${warnings[0]!.message}`
  } else {
    outcome = 'safe_to_assign'
    summary = 'All safety checks passed'
  }

  return { outcome, blocks, warnings, passed, summary }
}
