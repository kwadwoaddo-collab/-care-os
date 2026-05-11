// lib/compliance/requirements.ts
//
// Defines required compliance document types and re-exports the canonical
// required-training list for the care_worker base role.
//
// Training keywords have been removed — training is now matched by
// training_category (a structured field on the documents row), not filename.

export const REQUIRED_DOCUMENTS = [
  'passport',
  'right_to_work',
  'dbs',
] as const

export type RequiredDocument = (typeof REQUIRED_DOCUMENTS)[number]

// ── Required training certificates (care worker base) ─────────────────────────
//
// Sourced from lib/training/matrix.ts (DEFAULT_CARE_TRAINING).
// Kept here as a typed const so calculateCompliance can import it without
// pulling in the full matrix module.

export const REQUIRED_TRAINING = [
  'manual_handling',
  'safeguarding',
  'basic_life_support',
  'infection_control',
  'health_safety',
] as const

export type RequiredTraining = (typeof REQUIRED_TRAINING)[number]

// Expiry warning window in days
export const EXPIRY_WARN_DAYS = 30

