export { detectConflicts }                  from './detectConflicts'
export type { ConflictCheckInput, ConflictResult, ConflictDetail, ConflictType, ConflictSeverity } from './detectConflicts'

export { weeklyHoursRisk }                  from './weeklyHoursRisk'
export type { HoursRiskResult, HoursRisk }  from './weeklyHoursRisk'

export { checkLateAcknowledgement }         from './lateAcknowledgement'
export type { ShiftAckRecord, LateAckResult } from './lateAcknowledgement'

// Re-export existing shift utilities under the scheduling namespace
export { hasShiftOverlap }                  from '@/lib/shifts/hasShiftOverlap'
export type { ShiftSpan }                   from '@/lib/shifts/hasShiftOverlap'

export { calculateAssignmentScore }         from '@/lib/shifts/calculateAssignmentScore'
export type {
  AssignmentScoreResult,
  ShiftInput,
  ExistingShiftInput,
  StaffProfileInput,
}                                           from '@/lib/shifts/calculateAssignmentScore'

export { calculateReadiness }               from '@/lib/staff/calculateReadiness'
export type { ReadinessResult }             from '@/lib/staff/calculateReadiness'
