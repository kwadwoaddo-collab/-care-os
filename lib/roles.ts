// ── Application Role Configuration ──────────────────────────────────────────
//
// Single source of truth for role-based form sections, required documents,
// and compliance templates. Used by both the applicant form and admin dashboard.

export const APPLICATION_ROLES = [
  'Care Worker',
  'Senior Carer',
  'Support Worker',
  'Coordinator',
  'Admin Officer',
  'Compliance Manager',
  'Finance/Admin',
  'Domestic Staff',
  'Driver',
  'Other',
] as const

export type ApplicationRole = (typeof APPLICATION_ROLES)[number]

// ── Role Categories ─────────────────────────────────────────────────────────

export type RoleCategory = 'care' | 'admin' | 'operational' | 'other'

const ROLE_CATEGORIES: Record<ApplicationRole, RoleCategory> = {
  'Care Worker':         'care',
  'Senior Carer':        'care',
  'Support Worker':      'care',
  'Coordinator':         'admin',
  'Admin Officer':       'admin',
  'Compliance Manager':  'admin',
  'Finance/Admin':       'admin',
  'Domestic Staff':      'operational',
  'Driver':              'operational',
  'Other':               'other',
}

export function getRoleCategory(role: ApplicationRole | string): RoleCategory {
  return ROLE_CATEGORIES[role as ApplicationRole] ?? 'other'
}

// ── Category Labels & Colours ────────────────────────────────────────────────

export const CATEGORY_META: Record<RoleCategory, { label: string; colour: string; bg: string; border: string }> = {
  care:        { label: 'Care',        colour: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  admin:       { label: 'Office',      colour: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  operational: { label: 'Operational', colour: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  other:       { label: 'Other',       colour: 'text-gray-700',   bg: 'bg-gray-50',   border: 'border-gray-200' },
}

// ── Form Sections ───────────────────────────────────────────────────────────

export type FormSection =
  | 'personal_details'
  | 'employment_history'
  | 'employment_gaps'
  | 'references'
  | 'right_to_work'
  | 'criminal_record_dbs'
  | 'emergency_contact'
  | 'availability'
  | 'medical_history'
  | 'source'
  | 'declaration_consent'
  | 'application_declarations'
  // Care-specific
  | 'care_experience'
  | 'training_qualifications'
  | 'professional_qualifications'
  | 'professional_registration'
  // Admin/Office-specific
  | 'office_experience'

const UNIVERSAL_SECTIONS: FormSection[] = [
  'personal_details',
  'employment_history',
  'employment_gaps',
  'references',
  'right_to_work',
  'criminal_record_dbs',
  'emergency_contact',
  'availability',
  'medical_history',
  'source',
  'declaration_consent',
  'application_declarations',
]

const CARE_SECTIONS: FormSection[] = [
  'care_experience',
  'training_qualifications',
  'professional_qualifications',
  'professional_registration',
]

const ADMIN_SECTIONS: FormSection[] = [
  'office_experience',
]

const SECTIONS_BY_CATEGORY: Record<RoleCategory, FormSection[]> = {
  care:        [...UNIVERSAL_SECTIONS, ...CARE_SECTIONS],
  admin:       [...UNIVERSAL_SECTIONS, ...ADMIN_SECTIONS],
  operational: [...UNIVERSAL_SECTIONS],
  other:       [...UNIVERSAL_SECTIONS, ...CARE_SECTIONS, ...ADMIN_SECTIONS],
}

export function getSectionsForRole(role: ApplicationRole | string): FormSection[] {
  const category = getRoleCategory(role)
  return SECTIONS_BY_CATEGORY[category]
}

export function isSectionVisible(role: ApplicationRole | string | undefined, section: FormSection): boolean {
  if (!role) return true // No role selected → show everything (backward compat)
  return getSectionsForRole(role).includes(section)
}

// ── Required Documents ──────────────────────────────────────────────────────

const REQUIRED_DOCUMENTS: Record<RoleCategory, string[]> = {
  care: [
    'DBS Certificate',
    'Training Certificates',
    'Proof of Address',
    'Photo ID',
    'Right to Work Document',
    'Driving Licence (if applicable)',
    'Care Qualifications (NVQ/QCF)',
    'Professional Registration Certificate',
  ],
  admin: [
    'CV / Resume',
    'Photo ID',
    'Proof of Address',
    'Right to Work Document',
    'DBS Certificate',
  ],
  operational: [
    'Photo ID',
    'Proof of Address',
    'Right to Work Document',
    'DBS Certificate',
    'Driving Licence (if applicable)',
  ],
  other: [
    'Photo ID',
    'Proof of Address',
    'Right to Work Document',
    'DBS Certificate',
    'CV / Resume',
  ],
}

export function getRequiredDocuments(role: ApplicationRole | string): string[] {
  const category = getRoleCategory(role)
  return REQUIRED_DOCUMENTS[category]
}

// ── Compliance Templates ────────────────────────────────────────────────────

export interface ComplianceTemplate {
  name: string
  items: string[]
}

const COMPLIANCE_TEMPLATES: Record<RoleCategory, ComplianceTemplate> = {
  care: {
    name: 'Care Worker Compliance',
    items: [
      'Enhanced DBS check (with adults barred list)',
      'Two satisfactory references (one from most recent employer)',
      'Right to work verification',
      'Proof of identity',
      'Full employment history with explained gaps',
      'Health declaration / occupational health clearance',
      'Mandatory training: Manual handling, safeguarding, BLS, infection control',
      'Professional registration (if regulated role)',
      'Care certificate (or commitment to complete)',
    ],
  },
  admin: {
    name: 'Office Staff Compliance',
    items: [
      'Basic or Standard DBS check',
      'Two satisfactory references',
      'Right to work verification',
      'Proof of identity',
      'Full employment history with explained gaps',
      'Health declaration',
    ],
  },
  operational: {
    name: 'Operational Staff Compliance',
    items: [
      'Basic DBS check',
      'Two satisfactory references',
      'Right to work verification',
      'Proof of identity',
      'Full employment history with explained gaps',
      'Health declaration',
      'Valid driving licence (if driver role)',
    ],
  },
  other: {
    name: 'Standard Compliance',
    items: [
      'DBS check (level to be confirmed)',
      'Two satisfactory references',
      'Right to work verification',
      'Proof of identity',
      'Full employment history with explained gaps',
      'Health declaration',
    ],
  },
}

export function getComplianceTemplate(role: ApplicationRole | string): ComplianceTemplate {
  const category = getRoleCategory(role)
  return COMPLIANCE_TEMPLATES[category]
}
