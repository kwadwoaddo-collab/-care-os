import { type ReadinessResult }                from '@/lib/staff/calculateReadiness'
import { type StaffAvailability, type DayKey } from '@/lib/staff/types'
import { hasShiftOverlap }                     from './hasShiftOverlap'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StaffProfileInput {
  id:     string
  status: string
}

export interface ShiftInput {
  id:          string
  shift_date:  string
  start_time:  string
  end_time:    string
  shift_type?: string | null
  client_id?:  string | null
}

export interface ExistingShiftInput {
  id:         string
  shift_date: string
  start_time: string
  end_time:   string
}

export interface AssignmentScoreResult {
  score:    number
  eligible: boolean
  reasons:  string[]
  warnings: string[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_NAMES: DayKey[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
]

function dayKeyFromDate(shiftDate: string): DayKey {
  const idx = new Date(shiftDate + 'T12:00:00Z').getUTCDay()
  return DAY_NAMES[idx]!
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

// ── Scoring engine ────────────────────────────────────────────────────────────

export function calculateAssignmentScore(
  staff:            StaffProfileInput,
  shift:            ShiftInput,
  availability:     StaffAvailability | null,
  readiness:        ReadinessResult,
  existingShifts:   ExistingShiftInput[],
  hasClientHistory: boolean = false
): AssignmentScoreResult {
  const reasons:  string[] = []
  const blockers: string[] = []
  const warnings: string[] = []

  // ── Hard blockers ─────────────────────────────────────────────────────────────

  if (staff.status !== 'active') {
    blockers.push('Staff is not active')
  }

  if (!readiness.ready) {
    for (const b of readiness.blockers) blockers.push(b)
  }

  if (hasShiftOverlap(shift, existingShifts)) {
    blockers.push('Overlapping shift already assigned')
  }

  const unavailableDates = availability?.unavailable_dates ?? []
  if (unavailableDates.includes(shift.shift_date)) {
    blockers.push('Marked as unavailable on this date')
  }

  const dayKey   = dayKeyFromDate(shift.shift_date)
  const dayAvail = availability ? availability[dayKey] : undefined
  const isDayAvailable = dayAvail?.available === true

  if (!isDayAvailable) {
    blockers.push(`Not available on ${dayKey}s`)
  }

  if (blockers.length > 0) {
    return { score: 0, eligible: false, reasons: [], warnings: blockers }
  }

  // ── Scoring ───────────────────────────────────────────────────────────────────

  let score = 0

  // +40 readiness (scaled)
  score += Math.round((readiness.score / 100) * 40)
  if (readiness.score >= 80)      reasons.push('High readiness score')
  else if (readiness.score >= 60) reasons.push('Good readiness score')

  // +25 availability match
  if (isDayAvailable) {
    const hasWindow  = dayAvail!.start_time && dayAvail!.end_time
    if (hasWindow) {
      const shiftStart = toMinutes(shift.start_time)
      const shiftEnd   = toMinutes(shift.end_time)
      const availStart = toMinutes(dayAvail!.start_time)
      const availEnd   = toMinutes(dayAvail!.end_time)
      const isOvernight = shift.end_time <= shift.start_time
      const timeFit = isOvernight
        ? shiftStart >= availStart
        : shiftStart >= availStart && shiftEnd <= availEnd
      if (timeFit) {
        score += 25
        reasons.push('Shift times fit within availability window')
      } else {
        score += 12
        reasons.push('Available on this day')
      }
    } else {
      score += 15
      reasons.push('Available on this day')
    }
  }

  // +15 client continuity (Task 8)
  if (hasClientHistory) {
    score += 15
    reasons.push('Has previously worked with this client')
  }

  // +10 shift type preference
  const preferredType = availability?.preferred_shift_type
  if (preferredType && shift.shift_type && preferredType === shift.shift_type) {
    score += 10
    reasons.push(`Prefers ${shift.shift_type} shifts`)
  }

  // +10 low workload / warning for high workload
  const sameDayCount = existingShifts.filter((s) => s.shift_date === shift.shift_date).length
  if (sameDayCount === 0) {
    score += 10
    reasons.push('No other shifts scheduled this day')
  } else if (sameDayCount === 1) {
    score += 5
  }
  if (sameDayCount >= 2) {
    warnings.push(`Already has ${sameDayCount} shifts on this day`)
  }

  // Overnight warning
  if (shift.end_time <= shift.start_time) {
    warnings.push('Overnight shift')
  }

  // Pass through readiness warnings
  for (const w of readiness.warnings) {
    if (!warnings.includes(w)) warnings.push(w)
  }

  return {
    score:    Math.max(0, Math.min(100, score)),
    eligible: true,
    reasons,
    warnings,
  }
}
