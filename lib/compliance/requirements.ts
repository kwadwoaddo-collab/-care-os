// ── Required document types ────────────────────────────────────────────────────
// document_type values that every staff member must have uploaded and valid.

export const REQUIRED_DOCUMENTS = [
  'passport',
  'right_to_work',
  'dbs',
] as const

export type RequiredDocument = (typeof REQUIRED_DOCUMENTS)[number]

// ── Required training certificates ────────────────────────────────────────────
// Training inferred from uploaded documents (document_type = 'training_certificate')
// by matching file names against keyword lists below.

export const REQUIRED_TRAINING = [
  'manual_handling',
  'safeguarding',
  'basic_life_support',
  'infection_control',
  'health_safety',
] as const

export type RequiredTraining = (typeof REQUIRED_TRAINING)[number]

// ── Keyword map for training inference ────────────────────────────────────────
// A file name only needs to match one keyword (case-insensitive) to count.

export const TRAINING_KEYWORDS: Record<RequiredTraining, string[]> = {
  manual_handling:    ['manual_handling', 'manual handling', 'manual-handling', 'manualhandling'],
  safeguarding:       ['safeguarding', 'safeguard'],
  basic_life_support: ['basic_life_support', 'basic life support', 'basic-life-support', 'bls', 'first aid', 'first-aid', 'firstaid'],
  infection_control:  ['infection_control', 'infection control', 'infection-control'],
  health_safety:      ['health_safety', 'health safety', 'health-safety', 'h&s', 'health and safety'],
}

// Expiry warning window in days
export const EXPIRY_WARN_DAYS = 30
