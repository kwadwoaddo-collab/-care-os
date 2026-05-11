// ── Types ─────────────────────────────────────────────────────────────────────

export interface ShiftAckRecord {
  shift_date:        string
  start_time:        string
  worker_ack_status: string | null
  worker_ack_at:     string | null
}

export interface LateAckResult {
  lateCount:       number
  noResponseCount: number
  declinedCount:   number
  totalChecked:    number
  hasPattern:      boolean
  message:         string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LATE_ACK_THRESHOLD_HOURS = 24
const PATTERN_THRESHOLD        = 2

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Analyses a worker's recent shift acknowledgement history and returns
 * whether a problematic pattern exists (consistently slow or missing responses).
 *
 * @param recentShifts  Shifts to inspect (caller should pre-filter by date range)
 * @param windowDays    Look-back window; defaults to 30 days
 */
export function checkLateAcknowledgement(
  recentShifts: ShiftAckRecord[],
  windowDays:   number = 30
): LateAckResult {
  const cutoff    = new Date()
  cutoff.setDate(cutoff.getDate() - windowDays)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const relevant = recentShifts.filter((s) => s.shift_date >= cutoffStr)

  let lateCount       = 0
  let noResponseCount = 0
  let declinedCount   = 0

  for (const shift of relevant) {
    if (!shift.worker_ack_status) {
      // Count past unacknowledged shifts only
      const shiftTs = new Date(`${shift.shift_date}T${shift.start_time.slice(0, 5)}:00Z`)
      if (shiftTs < new Date()) noResponseCount++
    } else if (shift.worker_ack_status === 'declined') {
      declinedCount++
    } else if (shift.worker_ack_at) {
      const shiftTs          = new Date(`${shift.shift_date}T${shift.start_time.slice(0, 5)}:00Z`)
      const ackTs            = new Date(shift.worker_ack_at)
      const hoursBeforeShift = (shiftTs.getTime() - ackTs.getTime()) / (1000 * 60 * 60)
      if (hoursBeforeShift < LATE_ACK_THRESHOLD_HOURS) lateCount++
    }
  }

  const problemCount = lateCount + noResponseCount
  const hasPattern   = problemCount >= PATTERN_THRESHOLD

  return {
    lateCount,
    noResponseCount,
    declinedCount,
    totalChecked:  relevant.length,
    hasPattern,
    message: hasPattern
      ? `${problemCount} recent shift${problemCount !== 1 ? 's' : ''} without timely acknowledgement`
      : null,
  }
}
