export { detectConflicts }                  from './detectConflicts'
export type { ConflictCheckInput, ConflictResult, ConflictDetail, ConflictType, ConflictSeverity } from './detectConflicts'

export { weeklyHoursRisk }                  from './weeklyHoursRisk'
export type { HoursRiskResult, HoursRisk }  from './weeklyHoursRisk'

export { checkLateAcknowledgement }         from './lateAcknowledgement'
export type { ShiftAckRecord, LateAckResult } from './lateAcknowledgement'

export { checkRestPeriod, checkConsecutiveDays, checkNightDayFlip, checkFatigue } from './restPeriod'
export type { RestPeriodResult, ConsecutiveDaysResult, FatigueResult, RestCheckLevel } from './restPeriod'

export { evaluateAssignmentSafety }         from './assignmentSafety'
export type {
  AssignmentOutcome,
  SafetyCheck,
  AssignmentSafetyResult,
  SafetyInput,
}                                           from './assignmentSafety'

export { detectStaffingRisks }              from './staffingRisk'
export type {
  StaffingRisk,
  StaffingRiskType,
  StaffingRiskInput,
  RoleCounts,
  RiskLevel,
}                                           from './staffingRisk'

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
