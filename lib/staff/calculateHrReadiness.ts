export interface HrReadinessInput {
  date_of_birth?:          string | null
  address_line_1?:         string | null
  ni_number?:              string | null
  bank_account_number?:    string | null
  emergency_contact_name?: string | null
  employment_type?:        string | null
  starter_declaration?:    string | null
}

export interface HrReadiness {
  ready:   boolean
  score:   number
  missing: string[]
}

const CHECKS: { field: keyof HrReadinessInput; label: string }[] = [
  { field: 'date_of_birth',          label: 'Date of birth' },
  { field: 'address_line_1',         label: 'Address' },
  { field: 'ni_number',              label: 'NI number' },
  { field: 'bank_account_number',    label: 'Bank account number' },
  { field: 'emergency_contact_name', label: 'Emergency contact' },
  { field: 'employment_type',        label: 'Employment type' },
  { field: 'starter_declaration',    label: 'Starter declaration' },
]

export function calculateHrReadiness(staff: HrReadinessInput): HrReadiness {
  const missing = CHECKS
    .filter(({ field }) => {
      const v = staff[field]
      return v === null || v === undefined || String(v).trim() === ''
    })
    .map(({ label }) => label)

  const score = Math.round(((CHECKS.length - missing.length) / CHECKS.length) * 100)

  return { ready: missing.length === 0, score, missing }
}
