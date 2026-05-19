import { z } from 'zod'

export const DOCUMENT_TYPE_VALUES = [
  'passport',
  'right_to_work',
  'dbs',
  'training_certificate',
  'qualification',
  'proof_of_address',
  'national_insurance',
  'application_form',
  'cv',
  'other',
] as const

export type DocumentType = (typeof DOCUMENT_TYPE_VALUES)[number]

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  passport:             'Passport',
  right_to_work:        'Right to Work',
  dbs:                  'DBS Certificate',
  training_certificate: 'Training Certificate',
  qualification:        'Qualification',
  proof_of_address:     'Proof of Address',
  national_insurance:   'National Insurance',
  application_form:     'Application Form',
  cv:                   'CV / Résumé',
  other:                'Other',
}

export const DOCUMENT_TYPES = DOCUMENT_TYPE_VALUES.map((value) => ({
  value,
  label: DOCUMENT_TYPE_LABELS[value],
}))

export const DOCUMENT_TYPE_SET = new Set<string>(DOCUMENT_TYPE_VALUES)

// ── Training category constants ───────────────────────────────────────────────
//
// Structured training classification for training_certificate documents.
// Must stay in sync with the CHECK constraint in 029_training_category.sql.

export const TRAINING_CATEGORY_VALUES = [
  'manual_handling',
  'safeguarding',
  'basic_life_support',
  'infection_control',
  'health_safety',
  'medication',
  'fire_safety',
] as const

export type TrainingCategory = (typeof TRAINING_CATEGORY_VALUES)[number]

export const TRAINING_CATEGORY_LABELS: Record<TrainingCategory, string> = {
  manual_handling:    'Manual Handling',
  safeguarding:       'Safeguarding',
  basic_life_support: 'Basic Life Support',
  infection_control:  'Infection Control',
  health_safety:      'Health & Safety',
  medication:         'Medication Administration',
  fire_safety:        'Fire Safety',
}

export const TRAINING_CATEGORIES = TRAINING_CATEGORY_VALUES.map((value) => ({
  value,
  label: TRAINING_CATEGORY_LABELS[value],
}))

export const TRAINING_CATEGORY_SET = new Set<string>(TRAINING_CATEGORY_VALUES)

export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
])

export const ALLOWED_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png'])

export const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB

// Zod schema for backend upload validation
export const uploadDocumentSchema = z.object({
  documentType: z
    .string()
    .refine((v) => DOCUMENT_TYPE_SET.has(v), {
      message: `document_type must be one of: ${DOCUMENT_TYPE_VALUES.join(', ')}`,
    }),
  expiryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'expiry_date must be ISO format YYYY-MM-DD')
    .optional()
    .or(z.literal('')),
  issueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'issue_date must be ISO format YYYY-MM-DD')
    .optional()
    .or(z.literal('')),
  trainingCategory: z
    .string()
    .refine((v) => TRAINING_CATEGORY_SET.has(v), {
      message: `training_category must be one of: ${TRAINING_CATEGORY_VALUES.join(', ')}`,
    })
    .optional(),
  trainingName: z.string().max(200).optional(),
})
