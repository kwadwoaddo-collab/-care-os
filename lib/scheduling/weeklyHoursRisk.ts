// ── Types ─────────────────────────────────────────────────────────────────────

export type HoursRisk = 'none' | 'close' | 'over'

export interface HoursRiskResult {
  risk:           HoursRisk
  projectedHours: number
  maxHours:       number | null
  message:        string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function shiftDurationMinutes(startTime: string, endTime: string): number {
  const [sh = 0, sm = 0] = startTime.split(':').map(Number)
  const [eh = 0, em = 0] = endTime.split(':').map(Number)
  const startMin = sh * 60 + sm
  const endMin   = eh * 60 + em
  return endMin > startMin ? endMin - startMin : 1440 - startMin + endMin
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Returns the projected weekly hours risk if a new shift is assigned.
 * Operates on raw minute counts so callers decide how to fetch timesheet data.
 */
export function weeklyHoursRisk(
  scheduledMinutesThisWeek: number,
  newShiftStartTime:        string,
  newShiftEndTime:          string,
  maxWeeklyHours:           number | null
): HoursRiskResult {
  const shiftMins     = shiftDurationMinutes(newShiftStartTime, newShiftEndTime)
  const projectedMins = scheduledMinutesThisWeek + shiftMins
  const projectedH    = Math.round((projectedMins / 60) * 10) / 10

  if (!maxWeeklyHours) {
    return { risk: 'none', projectedHours: projectedH, maxHours: null, message: null }
  }

  const maxMins = maxWeeklyHours * 60

  if (projectedMins > maxMins) {
    return {
      risk:           'over',
      projectedHours: projectedH,
      maxHours:       maxWeeklyHours,
      message:        `Projected ${projectedH}h exceeds ${maxWeeklyHours}h weekly limit`,
    }
  }

  if (projectedMins > maxMins * 0.9) {
    return {
      risk:           'close',
      projectedHours: projectedH,
      maxHours:       maxWeeklyHours,
      message:        `Projected ${projectedH}h is close to ${maxWeeklyHours}h weekly limit`,
    }
  }

  return { risk: 'none', projectedHours: projectedH, maxHours: maxWeeklyHours, message: null }
}
