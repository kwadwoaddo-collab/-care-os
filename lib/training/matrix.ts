// lib/training/matrix.ts
//
// Role-based training requirement matrix.
// Defines which training categories are MANDATORY per job role.
//
// Design: hardcoded/config-based for MVP. Extend by adding entries to
// ROLE_TRAINING_MATRIX — no DB changes required for new roles.
//
// To add a new role:
//   'senior_care_worker': [...CARE_WORKER_TRAINING, 'medication'],

import type { TrainingCategory } from '@/lib/documents/constants'

// ── Role training matrix ───────────────────────────────────────────────────────
//
// Keys should match job_role values used in staff_profiles.job_role.
// Keys are normalised to lowercase + underscores before lookup.

// ── All 13 UK mandatory categories (base for every care role) ─────────────────
//
// CQC Regulation 18 / Skills for Care / Care Certificate standard.
// Every domiciliary care worker must have all 13 regardless of role.

export const ALL_MANDATORY_TRAINING: TrainingCategory[] = [
  'fire_safety',
  'manual_handling',
  'basic_life_support',
  'safeguarding',
  'safeguarding_children',
  'infection_control',
  'medication',
  'mental_capacity',
  'food_hygiene',
  'health_safety',
  'lone_working',
  'dementia_awareness',
  'communication',
]

// ── Role training matrix ───────────────────────────────────────────────────────
//
// All care roles require all 13 mandatory categories.
// Specialised roles may add extras but cannot remove any mandatory categories.
// Keys should match job_role values in staff_profiles.job_role (normalised).

export const ROLE_TRAINING_MATRIX: Record<string, TrainingCategory[]> = {
  care_worker:             ALL_MANDATORY_TRAINING,
  senior_care_worker:      ALL_MANDATORY_TRAINING,
  support_worker:          ALL_MANDATORY_TRAINING,
  community_care_worker:   ALL_MANDATORY_TRAINING,
  nurse:                   ALL_MANDATORY_TRAINING,
  medication_care_worker:  ALL_MANDATORY_TRAINING,
  team_leader:             ALL_MANDATORY_TRAINING,
}

// ── Default training for unrecognised roles ────────────────────────────────────
//
// Any care staff member with an unrecognised job role gets all 13 mandatory
// categories. No one falls through to a shorter list.
export const DEFAULT_CARE_TRAINING: TrainingCategory[] = ALL_MANDATORY_TRAINING


// ── Role normalisation ────────────────────────────────────────────────────────

function normaliseRole(jobRole: string): string {
  return jobRole.toLowerCase().trim().replace(/[\s-]+/g, '_')
}

/**
 * Returns the required training categories for a given job role.
 *
 * Falls back to DEFAULT_CARE_TRAINING for unrecognised roles so that
 * every care staff member has the base 5 categories required.
 */
export function getRequiredTraining(
  jobRole: string | null | undefined,
): TrainingCategory[] {
  if (!jobRole) return DEFAULT_CARE_TRAINING

  const key = normaliseRole(jobRole)

  // Exact match
  if (key in ROLE_TRAINING_MATRIX) {
    return ROLE_TRAINING_MATRIX[key]
  }

  // Partial match (e.g. "Band 5 Care Worker" → care_worker)
  for (const [matrixRole, training] of Object.entries(ROLE_TRAINING_MATRIX)) {
    if (key.includes(matrixRole) || matrixRole.includes(key)) {
      return training
    }
  }

  return DEFAULT_CARE_TRAINING
}
