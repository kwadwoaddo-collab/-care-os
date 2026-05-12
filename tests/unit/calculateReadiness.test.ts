import { expect, test, describe } from 'vitest'
import { calculateReadiness } from '@/lib/staff/calculateReadiness'
import type { StaffAvailability } from '@/lib/staff/types'

describe('calculateReadiness', () => {
  const baseAvailability: StaffAvailability = {
    staff_profile_id: '123',
    max_weekly_hours: 40,
    work_areas: ['North'],
    monday:    { available: true,  start_time: '09:00', end_time: '17:00' },
    tuesday:   { available: true,  start_time: '09:00', end_time: '17:00' },
    wednesday: { available: false, start_time: null,    end_time: null },
    thursday:  { available: false, start_time: null,    end_time: null },
    friday:    { available: false, start_time: null,    end_time: null },
    saturday:  { available: false, start_time: null,    end_time: null },
    sunday:    { available: false, start_time: null,    end_time: null },
  }

  test('fully compliant and active worker with availability returns 100% ready', () => {
    const res = calculateReadiness('active', true, baseAvailability)
    expect(res.ready).toBe(true)
    expect(res.score).toBe(100)
    expect(res.blockers).toHaveLength(0)
    expect(res.warnings).toHaveLength(0)
  })

  test('pre_employment worker with no availability returns 40% not ready with specific blockers', () => {
    const emptyAvailability: StaffAvailability = {
      ...baseAvailability,
      monday:    { available: false, start_time: null, end_time: null },
      tuesday:   { available: false, start_time: null, end_time: null },
      max_weekly_hours: 40, // Has max hours and work areas, just no days
    }
    const res = calculateReadiness('pre_employment', true, emptyAvailability)
    expect(res.ready).toBe(false)
    // 100 - 40 (not active) - 20 (no days) = 40
    expect(res.score).toBe(40)
    expect(res.blockers).toContain('Staff has not been activated yet')
    expect(res.blockers).toContain('No availability days set')
  })

  test('active worker missing compliance returns 60% not ready', () => {
    const res = calculateReadiness('active', false, baseAvailability)
    expect(res.ready).toBe(false)
    expect(res.score).toBe(60)
    expect(res.blockers).toContain('Compliance is incomplete')
  })

  test('suspended worker returns correct blocker', () => {
    const res = calculateReadiness('suspended', true, baseAvailability)
    expect(res.ready).toBe(false)
    expect(res.score).toBe(60) // 100 - 40
    expect(res.blockers).toContain('Staff is currently suspended')
  })

  test('terminated worker returns correct blocker', () => {
    const res = calculateReadiness('terminated', true, baseAvailability)
    expect(res.ready).toBe(false)
    expect(res.score).toBe(60)
    expect(res.blockers).toContain('Staff has been terminated')
  })

  test('inactive worker returns 0% not ready immediately', () => {
    const res = calculateReadiness('inactive', true, baseAvailability)
    expect(res.ready).toBe(false)
    expect(res.score).toBe(0)
    expect(res.blockers).toContain('Staff is no longer active')
  })

  test('missing max_weekly_hours and work_areas deducts from score and adds warnings', () => {
    const missingAvailParams: StaffAvailability = {
      ...baseAvailability,
      max_weekly_hours: null,
      work_areas: [],
    }
    const res = calculateReadiness('active', true, missingAvailParams)
    expect(res.ready).toBe(true) // Warnings do not block readiness
    expect(res.score).toBe(80) // 100 - 10 - 10
    expect(res.warnings).toContain('No maximum weekly hours set')
    expect(res.warnings).toContain('No work areas set')
  })

  test('null availability blocks readiness and sets score to 60', () => {
    const res = calculateReadiness('active', true, null)
    expect(res.ready).toBe(false)
    expect(res.score).toBe(60) // 100 - 20 (no days) - 10 (no hours) - 10 (no areas)
    expect(res.blockers).toContain('No availability days set')
    expect(res.warnings).toContain('No maximum weekly hours set')
    expect(res.warnings).toContain('No work areas set')
  })
})
