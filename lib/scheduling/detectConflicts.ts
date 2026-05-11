import { hasShiftOverlap, type ShiftSpan } from '@/lib/shifts/hasShiftOverlap'
import { type StaffAvailability, type DayKey } from '@/lib/staff/types'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConflictSeverity = 'block' | 'warn'

export type ConflictType =
  | 'shift_overlap'
  | 'unavailable_date'
  | 'day_not_available'
  | 'compliance_expired'
  | 'compliance_expiring'
  | 'staff_inactive'
  | 'weekly_hours_risk'
  | 'missing_acknowledgement_pattern'

export interface ConflictDetail {
  type:     ConflictType
  message:  string
  severity: ConflictSeverity
}

export interface ConflictResult {
  hasBlock:  boolean
  conflicts: ConflictDetail[]
  warnings:  ConflictDetail[]
  all:       ConflictDetail[]
}

export interface ConflictCheckInput {
  targetShift:               ShiftSpan
  staffStatus:               string
  availability:              StaffAvailability | null
  existingShifts:            ShiftSpan[]
  complianceExpired:         string[]
  complianceExpiringSoon:    string[]
  scheduledMinutesThisWeek?: number
  lateAckCount?:             number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_NAMES: DayKey[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
]

function dayKeyFromDate(shiftDate: string): DayKey {
  const idx = new Date(shiftDate + 'T12:00:00Z').getUTCDay()
  return DAY_NAMES[idx]!
}

function shiftDurationMinutes(shift: ShiftSpan): number {
  const [sh = 0, sm = 0] = shift.start_time.split(':').map(Number)
  const [eh = 0, em = 0] = shift.end_time.split(':').map(Number)
  const startMin = sh * 60 + sm
  const endMin   = eh * 60 + em
  return endMin > startMin ? endMin - startMin : 1440 - startMin + endMin
}

// ── Main export ───────────────────────────────────────────────────────────────

export function detectConflicts(input: ConflictCheckInput): ConflictResult {
  const all: ConflictDetail[] = []

  const {
    targetShift,
    staffStatus,
    availability,
    existingShifts,
    complianceExpired,
    complianceExpiringSoon,
    scheduledMinutesThisWeek,
    lateAckCount,
  } = input

  if (staffStatus !== 'active') {
    all.push({
      type:     'staff_inactive',
      message:  `Staff is not active (${staffStatus})`,
      severity: 'block',
    })
  }

  if (hasShiftOverlap(targetShift, existingShifts)) {
    all.push({
      type:     'shift_overlap',
      message:  'Overlapping shift already assigned',
      severity: 'block',
    })
  }

  const unavailableDates = availability?.unavailable_dates ?? []
  if (unavailableDates.includes(targetShift.shift_date)) {
    all.push({
      type:     'unavailable_date',
      message:  'Marked as unavailable on this date',
      severity: 'block',
    })
  }

  const dayKey   = dayKeyFromDate(targetShift.shift_date)
  const dayAvail = availability ? availability[dayKey] : undefined
  if (!dayAvail?.available) {
    all.push({
      type:     'day_not_available',
      message:  `Not available on ${dayKey}s`,
      severity: 'block',
    })
  }

  if (complianceExpired.length > 0) {
    const items = complianceExpired.map((t) => t.replace(/_/g, ' ')).join(', ')
    all.push({
      type:     'compliance_expired',
      message:  `Expired compliance: ${items}`,
      severity: 'block',
    })
  }

  if (complianceExpiringSoon.length > 0) {
    const items = complianceExpiringSoon.map((t) => t.replace(/_/g, ' ')).join(', ')
    all.push({
      type:     'compliance_expiring',
      message:  `Compliance expiring soon: ${items}`,
      severity: 'warn',
    })
  }

  if (scheduledMinutesThisWeek !== undefined && availability?.max_weekly_hours) {
    const maxMinutes  = availability.max_weekly_hours * 60
    const shiftMins   = shiftDurationMinutes(targetShift)
    const projected   = scheduledMinutesThisWeek + shiftMins
    if (projected > maxMinutes) {
      const projH = Math.round(projected / 60)
      const maxH  = availability.max_weekly_hours
      all.push({
        type:     'weekly_hours_risk',
        message:  `Would exceed weekly hours limit (${projH}h projected vs ${maxH}h max)`,
        severity: 'warn',
      })
    }
  }

  if (lateAckCount !== undefined && lateAckCount >= 2) {
    all.push({
      type:     'missing_acknowledgement_pattern',
      message:  `Worker has ${lateAckCount} recent shifts without timely acknowledgement`,
      severity: 'warn',
    })
  }

  return {
    hasBlock:  all.some((c) => c.severity === 'block'),
    conflicts: all.filter((c) => c.severity === 'block'),
    warnings:  all.filter((c) => c.severity === 'warn'),
    all,
  }
}
