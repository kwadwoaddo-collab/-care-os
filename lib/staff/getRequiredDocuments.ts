import { expandDocumentTypes } from './calculateOnboardingStatus'


export interface RequiredDocument {
  /** Normalised document_type value (matches `documents.document_type` column) */
  type:        string
  /** Human-readable label */
  label:       string
  /** Whether missing this document is a hard blocker */
  mandatory:   boolean
  /** Explanation shown in the UI */
  description: string
}

export interface DocumentRequirementsInput {
  employment_type?:    string | null
  visa_sponsored?:     boolean
  /** e.g. 'care_worker', 'senior_care_worker', 'nurse', 'admin' */
  job_role?:           string | null
}

// ── Catalogue ─────────────────────────────────────────────────────────────────

const BASE_DOCUMENTS: RequiredDocument[] = [
  {
    type:        'dbs',
    label:       'DBS Certificate',
    mandatory:   true,
    description: 'Enhanced DBS check required for all care staff before starting work.',
  },
  {
    type:        'right_to_work',
    label:       'Right to Work',
    mandatory:   true,
    description: 'Proof of the right to work in the UK — passport, BRP, or share code confirmation.',
  },
  {
    type:        'id',
    label:       'Photo ID',
    mandatory:   true,
    description: 'Passport or UK driving licence.',
  },
  {
    type:        'proof_of_address',
    label:       'Proof of Address',
    mandatory:   true,
    description: 'Bank statement or utility bill dated within the last 3 months.',
  },
]

const TRAINING_DOCUMENTS: RequiredDocument[] = [
  {
    type:        'manual_handling_certificate',
    label:       'Manual Handling Certificate',
    mandatory:   true,
    description: 'Valid manual handling training certificate — must be renewed annually.',
  },
  {
    type:        'fire_safety_certificate',
    label:       'Fire Safety Certificate',
    mandatory:   true,
    description: 'Fire awareness training certificate.',
  },
  {
    type:        'safeguarding_certificate',
    label:       'Safeguarding Certificate',
    mandatory:   true,
    description: 'Safeguarding adults and children training.',
  },
  {
    type:        'first_aid_certificate',
    label:       'First Aid Certificate',
    mandatory:   false,
    description: 'Basic first aid training — strongly recommended for lone workers.',
  },
  {
    type:        'infection_control_certificate',
    label:       'Infection Control Certificate',
    mandatory:   false,
    description: 'Infection prevention and control training.',
  },
]

const VISA_DOCUMENTS: RequiredDocument[] = [
  {
    type:        'brp',
    label:       'Biometric Residence Permit (BRP)',
    mandatory:   true,
    description: 'BRP card confirming immigration status and right to work.',
  },
  {
    type:        'visa',
    label:       'Visa Document',
    mandatory:   true,
    description: 'Copy of the visa vignette or electronic travel authorisation.',
  },
  {
    type:        'share_code_confirmation',
    label:       'Share Code Confirmation',
    mandatory:   true,
    description: 'HMRC share code check confirmation printout, dated and signed.',
  },
  {
    type:        'cos_letter',
    label:       'Certificate of Sponsorship Letter',
    mandatory:   false,
    description: 'COS letter from the sponsoring employer (Health and Care Worker visa).',
  },
]

const NURSE_DOCUMENTS: RequiredDocument[] = [
  {
    type:        'nmc_pin',
    label:       'NMC PIN Certificate',
    mandatory:   true,
    description: 'Nursing and Midwifery Council registration certificate.',
  },
  {
    type:        'professional_indemnity',
    label:       'Professional Indemnity Insurance',
    mandatory:   false,
    description: 'Evidence of current professional indemnity insurance.',
  },
]

const AGENCY_DOCUMENTS: RequiredDocument[] = [
  {
    type:        'agency_contract',
    label:       'Agency Contract / Assignment Details',
    mandatory:   true,
    description: 'Signed contract or confirmation of assignment from the agency.',
  },
]

// ── Engine ────────────────────────────────────────────────────────────────────

export function getRequiredDocuments(input: DocumentRequirementsInput): RequiredDocument[] {
  const docs: RequiredDocument[] = [...BASE_DOCUMENTS, ...TRAINING_DOCUMENTS]

  // Visa-sponsored workers need immigration documents
  if (input.visa_sponsored) {
    docs.push(...VISA_DOCUMENTS)
  }

  // Nurses need NMC registration
  const role = (input.job_role ?? '').toLowerCase()
  if (role.includes('nurse') || role.includes('rn') || role.includes('rnld')) {
    docs.push(...NURSE_DOCUMENTS)
  }

  // Agency workers need contract confirmation
  if (input.employment_type === 'agency') {
    docs.push(...AGENCY_DOCUMENTS)
  }

  // De-duplicate by type (in case of overlapping additions)
  const seen = new Set<string>()
  return docs.filter((d) => {
    if (seen.has(d.type)) return false
    seen.add(d.type)
    return true
  })
}

/**
 * Returns the subset of required documents that are missing from the uploaded list.
 * A passport satisfies both 'id' and 'right_to_work' slots.
 */
export function getMissingDocuments(
  input:    DocumentRequirementsInput,
  uploaded: string[],
): RequiredDocument[] {
  const required    = getRequiredDocuments(input)
  const uploadedSet = expandDocumentTypes(uploaded)
  return required.filter((d) => d.mandatory && !uploadedSet.has(d.type))
}
