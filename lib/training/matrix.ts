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

export const ROLE_TRAINING_MATRIX: Record<string, TrainingCategory[]> = {
  care_worker: [
    'manual_handling',
    'safeguarding',
    'basic_life_support',
    'infection_control',
    'health_safety',
  ],
  senior_care_worker: [
    'manual_handling',
    'safeguarding',
    'basic_life_support',
    'infection_control',
    'health_safety',
    'medication',
  ],
  support_worker: [
    'manual_handling',
    'safeguarding',
    'basic_life_support',
    'infection_control',
    'health_safety',
  ],
  community_care_worker: [
    'manual_handling',
    'safeguarding',
    'basic_life_support',
    'infection_control',
    'health_safety',
  ],
  nurse: [
    'manual_handling',
    'safeguarding',
    'basic_life_support',
    'infection_control',
    'health_safety',
    'medication',
  ],
  medication_care_worker: [
    'manual_handling',
    'safeguarding',
    'basic_life_support',
    'infection_control',
    'health_safety',
    'medication',
  ],
  team_leader: [
    'manual_handling',
    'safeguarding',
    'basic_life_support',
    'infection_control',
    'health_safety',
    'medication',
    'fire_safety',
  ],
}

// ── Default training for unrecognised roles ────────────────────────────────────
//
// All care-related staff need at minimum these categories.
// Used as a fallback when the exact job_role isn't in the matrix.
export const DEFAULT_CARE_TRAINING: TrainingCategory[] = [
  'manual_handling',
  'safeguarding',
  'basic_life_support',
  'infection_control',
  'health_safety',
]

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
