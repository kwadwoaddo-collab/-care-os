import type { ShiftSpan } from '@/lib/shifts/hasShiftOverlap'

export type RestCheckLevel = 'block' | 'warn' | 'ok'

export interface RestPeriodResult {
  level:      RestCheckLevel
  gapMinutes: number | null
  message:    string | null
}

export interface ConsecutiveDaysResult {
  level:           RestCheckLevel
  consecutiveDays: number
  message:         string | null
}

export interface FatigueResult {
  restPeriod:      RestPeriodResult
  consecutiveDays: ConsecutiveDaysResult
  nightDayFlip:    boolean
}

const MIN_REST_BLOCK_H = 8
const MIN_REST_WARN_H  = 11
const CONSEC_WARN  = 5
const CONSEC_BLOCK = 7

// ── Helpers ───────────────────────────────────────────────────────────────────

function absoluteMinutes(date: string, time: string): number {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number)
  const dayOffset = Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
  const [h = 0, m = 0] = time.split(':').map(Number)
  return dayOffset * 1440 + h * 60 + m
}

function shiftRange(s: ShiftSpan): [number, number] {
  const start      = absoluteMinutes(s.shift_date, s.start_time)
  const endSameDay = absoluteMinutes(s.shift_date, s.end_time)
  const isOvernight = s.end_time <= s.start_time
  return [start, isOvernight ? endSameDay + 1440 : endSameDay]
}

// ── Rest period check ─────────────────────────────────────────────────────────

export function checkRestPeriod(target: ShiftSpan, existing: ShiftSpan[]): RestPeriodResult {
  const [tStart, tEnd] = shiftRange(target)
  let minGap: number | null = null

  for (const s of existing) {
    const [sStart, sEnd] = shiftRange(s)
    if (sEnd <= tStart) {
      const gap = tStart - sEnd
      if (minGap === null || gap < minGap) minGap = gap
    }
    if (tEnd <= sStart) {
      const gap = sStart - tEnd
      if (minGap === null || gap < minGap) minGap = gap
    }
  }

  if (minGap === null) return { level: 'ok', gapMinutes: null, message: null }

  const gapH = Math.round((minGap / 60) * 10) / 10

  if (minGap < MIN_REST_BLOCK_H * 60) {
    return {
      level:      'block',
      gapMinutes: minGap,
      message:    `Only ${gapH}h rest between shifts — minimum ${MIN_REST_BLOCK_H}h required`,
    }
  }
  if (minGap < MIN_REST_WARN_H * 60) {
    return {
      level:      'warn',
      gapMinutes: minGap,
      message:    `Only ${gapH}h rest between shifts — UK Working Time Regs recommend ${MIN_REST_WARN_H}h`,
    }
  }
  return { level: 'ok', gapMinutes: minGap, message: null }
}

// ── Consecutive days check ────────────────────────────────────────────────────

export function checkConsecutiveDays(
  targetDate: string,
  existing:   ShiftSpan[],
): ConsecutiveDaysResult {
  const worked = new Set<string>(existing.map((s) => s.shift_date))
  worked.add(targetDate)

  const base = new Date(targetDate + 'T12:00:00Z')
  let streak = 0

  for (let i = 0; ; i++) {
    const d = new Date(base); d.setUTCDate(base.getUTCDate() - i)
    if (worked.has(d.toISOString().slice(0, 10))) streak++
    else break
  }
  for (let i = 1; ; i++) {
    const d = new Date(base); d.setUTCDate(base.getUTCDate() + i)
    if (worked.has(d.toISOString().slice(0, 10))) streak++
    else break
  }

  if (streak >= CONSEC_BLOCK) {
    return {
      level:           'block',
      consecutiveDays: streak,
      message:         `${streak} consecutive days — maximum ${CONSEC_BLOCK - 1} without a day off`,
    }
  }
  if (streak >= CONSEC_WARN) {
    return {
      level:           'warn',
      consecutiveDays: streak,
      message:         `${streak} consecutive days — consider scheduling a rest day soon`,
    }
  }
  return { level: 'ok', consecutiveDays: streak, message: null }
}

// ── Night → day transition check ──────────────────────────────────────────────

export function checkNightDayFlip(target: ShiftSpan, existing: ShiftSpan[]): boolean {
  const tStartH = parseInt(target.start_time.slice(0, 2), 10)
  if (tStartH < 6 || tStartH >= 14) return false

  const [tStart] = shiftRange(target)

  for (const s of existing) {
    const sStartH = parseInt(s.start_time.slice(0, 2), 10)
    const isNight = sStartH >= 20 || sStartH < 4
    if (!isNight) continue
    const [, sEnd] = shiftRange(s)
    if (sEnd <= tStart && tStart - sEnd < 9 * 60) return true
  }
  return false
}

// ── Combined ──────────────────────────────────────────────────────────────────

export function checkFatigue(target: ShiftSpan, existing: ShiftSpan[]): FatigueResult {
  return {
    restPeriod:      checkRestPeriod(target, existing),
    consecutiveDays: checkConsecutiveDays(target.shift_date, existing),
    nightDayFlip:    checkNightDayFlip(target, existing),
  }
}
