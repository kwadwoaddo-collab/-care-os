import { DAY_KEYS, type StaffAvailability } from './types'

export interface ReadinessResult {
  ready:    boolean
  score:    number
  blockers: string[]
  warnings: string[]
}

export function calculateReadiness(
  status:       string,
  compliant:    boolean,
  availability: StaffAvailability | null
): ReadinessResult {
  const blockers: string[] = []
  const warnings: string[] = []
  let score = 100

  if (status !== 'active') {
    blockers.push('Staff is not active')
    score -= 40
  }

  if (!compliant) {
    blockers.push('Compliance is incomplete')
    score -= 40
  }

  const hasAvailableDays =
    availability !== null &&
    DAY_KEYS.some((day) => availability[day].available === true)

  if (!hasAvailableDays) {
    blockers.push('No availability days set')
    score -= 20
  }

  if (!availability?.max_weekly_hours) {
    warnings.push('No maximum weekly hours set')
    score -= 10
  }

  if (!availability?.work_areas || availability.work_areas.length === 0) {
    warnings.push('No work areas set')
    score -= 10
  }

  return {
    ready:    blockers.length === 0,
    score:    Math.max(0, Math.min(100, score)),
    blockers,
    warnings,
  }
}
