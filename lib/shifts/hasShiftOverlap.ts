// ── Types ─────────────────────────────────────────────────────────────────────

export interface ShiftSpan {
  shift_date: string  // YYYY-MM-DD
  start_time: string  // HH:MM or HH:MM:SS
  end_time:   string  // HH:MM or HH:MM:SS
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function absoluteMinutes(date: string, time: string): number {
  const [year, month, day] = date.split('-').map(Number)
  const dayOffset = Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
  const [h, m] = time.split(':').map(Number)
  return dayOffset * 1440 + h * 60 + m
}

function spanToRange(shift: ShiftSpan): [number, number] {
  const start       = absoluteMinutes(shift.shift_date, shift.start_time)
  const endSameDay  = absoluteMinutes(shift.shift_date, shift.end_time)
  const isOvernight = shift.end_time <= shift.start_time
  return [start, isOvernight ? endSameDay + 1440 : endSameDay]
}

// ── Main export ───────────────────────────────────────────────────────────────

export function hasShiftOverlap(target: ShiftSpan, existing: ShiftSpan[]): boolean {
  const [ts, te] = spanToRange(target)
  for (const s of existing) {
    const [es, ee] = spanToRange(s)
    if (ts < ee && es < te) return true
  }
  return false
}
