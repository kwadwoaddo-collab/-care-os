/**
 * worked_minutes = (clock_out − clock_in) − break_minutes
 * Never returns a negative value.
 */
export function calculateWorkedMinutes(
  clockIn:      Date | string,
  clockOut:     Date | string,
  breakMinutes: number = 0,
): number {
  const inMs  = new Date(clockIn).getTime()
  const outMs = new Date(clockOut).getTime()
  const raw   = Math.floor((outMs - inMs) / 60_000) - breakMinutes
  return Math.max(0, raw)
}
