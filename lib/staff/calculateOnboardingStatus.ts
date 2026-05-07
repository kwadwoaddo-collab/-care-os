// ── Types ─────────────────────────────────────────────────────────────────────

export interface OnboardingInput {
  // Personal
  first_name?:   string | null
  last_name?:    string | null
  date_of_birth?: string | null
  gender?:        string | null
  nationality?:   string | null
  // Address
  address_line_1?: string | null
  city?:           string | null
  postcode?:       string | null
  // Emergency
  emergency_contact_name?:  string | null
  emergency_contact_phone?: string | null
  // HMRC / Payroll
  ni_number?:           string | null
  employment_type?:     string | null
  starter_declaration?: string | null
  // Bank
  bank_account_number?: string | null
  bank_sort_code?:      string | null
  bank_account_name?:   string | null
  // Compliance
  right_to_work_checked?: boolean | null
  dbs_checked?:           boolean | null
  dbs_expiry_date?:       string | null
  // Staff
  status?: string
  // Documents (pass in the types already uploaded)
  uploadedDocumentTypes?: string[]
}

export interface OnboardingSections {
  personal:    boolean
  address:     boolean
  emergency:   boolean
  hmrc:        boolean
  banking:     boolean
  employment:  boolean
  compliance:  boolean
  documents:   boolean
}

export interface OnboardingStatus {
  /** All mandatory sections complete */
  ready:    boolean
  /** 0-100 — percentage of checks passed */
  progress: number
  /** Payroll-ready: stricter gate */
  payroll_ready: boolean
  /** Human-readable list of missing items */
  missing: string[]
  /** Non-blocking warnings */
  warnings: string[]
  /** Per-section boolean status */
  sections: OnboardingSections
  /** Granular check results, keyed by check id */
  checks: Record<string, boolean>
}

// ── Mandatory document types for a standard care worker ──────────────────────

const MANDATORY_DOC_TYPES = [
  'dbs',
  'right_to_work',
  'id',
  'proof_of_address',
] as const

// ── Helpers ───────────────────────────────────────────────────────────────────

function present(v: string | null | undefined): boolean {
  return v !== null && v !== undefined && String(v).trim() !== ''
}

function isExpired(iso: string | null | undefined): boolean {
  if (!iso) return false
  return new Date(iso) < new Date()
}

// ── Engine ────────────────────────────────────────────────────────────────────

export function calculateOnboardingStatus(staff: OnboardingInput): OnboardingStatus {
  const missing:  string[] = []
  const warnings: string[] = []
  const checks:   Record<string, boolean> = {}

  // ── Personal ───────────────────────────────────────────────────────────────
  checks.first_name    = present(staff.first_name)
  checks.last_name     = present(staff.last_name)
  checks.date_of_birth = present(staff.date_of_birth)
  checks.nationality   = present(staff.nationality)

  if (!checks.first_name)    missing.push('First name')
  if (!checks.last_name)     missing.push('Last name')
  if (!checks.date_of_birth) missing.push('Date of birth')
  if (!checks.nationality)   warnings.push('Nationality not recorded')

  const personal = checks.first_name && checks.last_name && checks.date_of_birth

  // ── Address ────────────────────────────────────────────────────────────────
  checks.address_line_1 = present(staff.address_line_1)
  checks.city           = present(staff.city)
  checks.postcode       = present(staff.postcode)

  if (!checks.address_line_1) missing.push('Address line 1')
  if (!checks.city)           missing.push('City / Town')
  if (!checks.postcode)       missing.push('Postcode')

  const address = checks.address_line_1 && checks.city && checks.postcode

  // ── Emergency contact ──────────────────────────────────────────────────────
  checks.emergency_contact_name  = present(staff.emergency_contact_name)
  checks.emergency_contact_phone = present(staff.emergency_contact_phone)

  if (!checks.emergency_contact_name)  missing.push('Emergency contact name')
  if (!checks.emergency_contact_phone) missing.push('Emergency contact phone')

  const emergency = checks.emergency_contact_name && checks.emergency_contact_phone

  // ── HMRC ──────────────────────────────────────────────────────────────────
  checks.ni_number           = present(staff.ni_number)
  checks.starter_declaration = present(staff.starter_declaration)

  if (!checks.ni_number)           missing.push('NI number')
  if (!checks.starter_declaration) missing.push('Starter declaration (A / B / C)')

  const hmrc = checks.ni_number && checks.starter_declaration

  // ── Banking ───────────────────────────────────────────────────────────────
  checks.bank_account_number = present(staff.bank_account_number)
  checks.bank_sort_code      = present(staff.bank_sort_code)
  checks.bank_account_name   = present(staff.bank_account_name)

  if (!checks.bank_account_number) missing.push('Bank account number')
  if (!checks.bank_sort_code)      missing.push('Bank sort code')
  if (!checks.bank_account_name)   missing.push('Bank account holder name')

  const banking = checks.bank_account_number && checks.bank_sort_code && checks.bank_account_name

  // ── Employment ────────────────────────────────────────────────────────────
  checks.employment_type = present(staff.employment_type)

  if (!checks.employment_type) missing.push('Employment type')

  const employment = checks.employment_type

  // ── Compliance ────────────────────────────────────────────────────────────
  checks.right_to_work_checked = staff.right_to_work_checked === true
  checks.dbs_checked           = staff.dbs_checked === true
  checks.dbs_not_expired       = !isExpired(staff.dbs_expiry_date)

  if (!checks.right_to_work_checked) missing.push('Right to work check')
  if (!checks.dbs_checked)           missing.push('DBS check')
  if (staff.dbs_checked && !checks.dbs_not_expired) {
    warnings.push('DBS certificate has expired')
  }

  const compliance = checks.right_to_work_checked && checks.dbs_checked && checks.dbs_not_expired

  // ── Documents ────────────────────────────────────────────────────────────
  const uploaded = new Set(staff.uploadedDocumentTypes ?? [])
  for (const docType of MANDATORY_DOC_TYPES) {
    const key     = `doc_${docType}`
    checks[key]   = uploaded.has(docType)
    if (!checks[key]) missing.push(`Document: ${docType.replace(/_/g, ' ')}`)
  }

  const documents = MANDATORY_DOC_TYPES.every((t) => uploaded.has(t))

  // ── Aggregate ─────────────────────────────────────────────────────────────
  const sections: OnboardingSections = {
    personal,
    address,
    emergency,
    hmrc,
    banking,
    employment,
    compliance,
    documents,
  }

  const totalChecks  = Object.keys(checks).length
  const passedChecks = Object.values(checks).filter(Boolean).length
  const progress     = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0

  const ready = Object.values(sections).every(Boolean)

  // Payroll-ready is a stricter gate
  const payroll_ready =
    sections.hmrc &&
    sections.banking &&
    sections.employment &&
    sections.compliance &&
    sections.personal

  return {
    ready,
    progress,
    payroll_ready,
    missing,
    warnings,
    sections,
    checks,
  }
}

// ── Next actions helper ───────────────────────────────────────────────────────
// Returns an ordered list of action labels pointing at which HR section to edit.

export interface NextAction {
  id:      string
  label:   string
  section: 'personal' | 'address' | 'emergency' | 'hmrc' | 'banking' | 'employment' | 'compliance' | 'documents'
  urgent:  boolean
}

export function getNextActions(status: OnboardingStatus): NextAction[] {
  const actions: NextAction[] = []

  if (!status.sections.personal) {
    actions.push({ id: 'add_dob',     label: 'Add date of birth and personal details',  section: 'personal',    urgent: false })
  }
  if (!status.sections.address) {
    actions.push({ id: 'add_address', label: 'Add home address',                          section: 'address',     urgent: false })
  }
  if (!status.sections.emergency) {
    actions.push({ id: 'add_ec',      label: 'Add emergency contact',                     section: 'emergency',   urgent: false })
  }
  if (!status.sections.hmrc) {
    if (!status.checks.ni_number)           actions.push({ id: 'add_ni',      label: 'Add NI number',                    section: 'hmrc', urgent: true })
    if (!status.checks.starter_declaration) actions.push({ id: 'add_sd',      label: 'Complete HMRC starter declaration', section: 'hmrc', urgent: true })
  }
  if (!status.sections.banking) {
    actions.push({ id: 'add_bank',    label: 'Add bank account details',                  section: 'banking',     urgent: true })
  }
  if (!status.sections.employment) {
    actions.push({ id: 'add_emp',     label: 'Set employment type',                       section: 'employment',  urgent: false })
  }
  if (!status.sections.compliance) {
    if (!status.checks.right_to_work_checked) actions.push({ id: 'rtw',    label: 'Mark right to work as checked',   section: 'compliance', urgent: true })
    if (!status.checks.dbs_checked)           actions.push({ id: 'dbs',    label: 'Mark DBS check as complete',      section: 'compliance', urgent: true })
  }
  if (!status.sections.documents) {
    actions.push({ id: 'upload_docs', label: 'Upload mandatory documents (DBS, RTW, ID, proof of address)', section: 'documents', urgent: true })
  }

  return actions
}
