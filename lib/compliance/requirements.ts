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

// ── Required training certificates (all care staff — 13 UK mandatory categories) ─
//
// All 13 are now mandatory for domiciliary care under CQC Regulation 18.
// The compliance engine enforces every one of these.
// Source: Skills for Care, CQC fundamental standards, Care Certificate.

export const REQUIRED_TRAINING = [
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
] as const

export type RequiredTraining = (typeof REQUIRED_TRAINING)[number]

// Expiry warning window in days
export const EXPIRY_WARN_DAYS = 30

