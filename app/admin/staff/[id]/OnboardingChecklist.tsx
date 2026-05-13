import {
  calculateOnboardingStatus,
  getNextActions,
  type OnboardingInput,
} from '@/lib/staff/calculateOnboardingStatus'
import { getRequiredTraining } from '@/lib/training/matrix'
import { TRAINING_CATEGORY_LABELS } from '@/lib/documents/constants'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  staffProfileId: string
  staff:          OnboardingInput
}

// ── Checklist row ─────────────────────────────────────────────────────────────

function CheckRow({
  label,
  done,
  description,
}: {
  label:       string
  done:        boolean
  description?: string
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <span className={`mt-0.5 flex-shrink-0 text-sm font-bold ${done ? 'text-green-600' : 'text-red-500'}`}>
        {done ? '✓' : '✕'}
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${done ? 'text-gray-800' : 'text-primary'}`}>{label}</p>
        {!done && description && (
          <p className="text-xs text-on-surface-variant mt-0.5">{description}</p>
        )}
      </div>
      <span className={`flex-shrink-0 inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
        done
          ? 'bg-green-50 text-green-700 ring-green-600/20'
          : 'bg-red-50 text-red-700 ring-red-600/20'
      }`}>
        {done ? 'Complete' : 'Missing'}
      </span>
    </div>
  )
}

// ── Section heading ───────────────────────────────────────────────────────────

function SectionHeading({ title }: { title: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mt-4 mb-1">
      {title}
    </p>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OnboardingChecklist({ staffProfileId, staff }: Props) {
  const status  = calculateOnboardingStatus(staff)
  const actions = getNextActions(status)

  const progressColour =
    status.progress >= 100 ? 'bg-green-500' :
    status.progress >= 60  ? 'bg-yellow-400' :
    'bg-red-500'

  return (
    <div className="space-y-4">

      {/* ── Readiness banner ──────────────────────────────────────────────── */}
      <div className={`rounded-md px-4 py-3 flex items-start gap-3 ${
        status.ready
          ? 'bg-green-50 border border-green-200'
          : 'bg-amber-50 border border-amber-200'
      }`}>
        <span className={`text-base mt-0.5 ${status.ready ? 'text-green-600' : 'text-amber-600'}`}>
          {status.ready ? '✓' : '⚠'}
        </span>
        <div className="flex-1">
          <p className={`text-sm font-semibold ${status.ready ? 'text-green-800' : 'text-amber-800'}`}>
            {status.ready ? 'Onboarding complete — worker is operationally ready' : 'Onboarding incomplete'}
          </p>
          {!status.ready && status.missing.length > 0 && (
            <p className="text-xs text-amber-700 mt-0.5">
              {status.missing.length} item{status.missing.length !== 1 ? 's' : ''} still required
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Payroll badge */}
          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
            status.payroll_ready
              ? 'bg-blue-50 text-blue-700 ring-blue-600/20'
              : 'bg-gray-50 text-on-surface-variant ring-gray-400/20'
          }`}>
            {status.payroll_ready ? '💷 Payroll Ready' : '💷 Not Payroll Ready'}
          </span>
        </div>
      </div>

      {/* ── Progress bar ──────────────────────────────────────────────────── */}
      <div>
        <div className="flex justify-between text-xs text-on-surface-variant mb-1">
          <span>Onboarding progress</span>
          <span className="font-medium tabular-nums">{status.progress}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${progressColour}`}
            style={{ width: `${status.progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">
          {Object.values(status.sections).filter(Boolean).length} of {Object.keys(status.sections).length} sections complete
        </p>
      </div>

      {/* ── Warnings ──────────────────────────────────────────────────────── */}
      {status.warnings.length > 0 && (
        <div className="rounded-md bg-yellow-50 border border-yellow-200 px-3 py-2.5">
          <p className="text-xs font-medium text-yellow-800 mb-1">Warnings</p>
          <ul className="space-y-0.5">
            {status.warnings.map((w, i) => (
              <li key={i} className="text-xs text-yellow-700">⚠ {w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Checklist ─────────────────────────────────────────────────────── */}
      <div>

        <SectionHeading title="Personal Details" />
        <CheckRow label="First name"     done={status.checks.first_name}    description="First name is required on all records." />
        <CheckRow label="Last name"      done={status.checks.last_name}     description="Last name is required on all records." />
        <CheckRow label="Date of birth"  done={status.checks.date_of_birth} description="Required for payroll and HMRC reporting." />
        <CheckRow label="Nationality"    done={status.checks.nationality}   description="Required for right to work assessment." />

        <SectionHeading title="Home Address" />
        <CheckRow label="Address line 1" done={status.checks.address_line_1} description="A full UK home address is required for payroll." />
        <CheckRow label="City / Town"    done={status.checks.city}           description="Required for payroll records." />
        <CheckRow label="Postcode"       done={status.checks.postcode}       description="Required for payroll records." />

        <SectionHeading title="Emergency Contact" />
        <CheckRow label="Emergency contact name"  done={status.checks.emergency_contact_name}  description="Required before worker begins shifts." />
        <CheckRow label="Emergency contact phone" done={status.checks.emergency_contact_phone} description="A reachable phone number for emergencies." />

        <SectionHeading title="HMRC / Payroll" />
        <CheckRow label="NI number"           done={status.checks.ni_number}           description="National Insurance number — required for RTI submissions." />
        <CheckRow label="Starter declaration" done={status.checks.starter_declaration} description="Worker must declare which HMRC starter statement applies (A, B or C)." />

        <SectionHeading title="Bank Details" />
        <CheckRow label="Account holder name"  done={status.checks.bank_account_name}   description="Must match the account holder exactly." />
        <CheckRow label="Bank account number"  done={status.checks.bank_account_number} description="8-digit account number." />
        <CheckRow label="Bank sort code"       done={status.checks.bank_sort_code}      description="6-digit sort code in 00-00-00 format." />

        <SectionHeading title="Employment" />
        <CheckRow label="Employment type" done={status.checks.employment_type} description="Full time, part time, zero hours, or agency." />

        <SectionHeading title="Right to Work &amp; DBS" />
        <CheckRow label="Right to work checked"  done={status.checks.right_to_work_checked} description="Admin must verify and record the right to work check." />
        <CheckRow label="DBS check complete"     done={status.checks.dbs_checked}           description="Enhanced DBS must be completed before worker can be active." />
        <CheckRow label="DBS not expired"        done={status.checks.dbs_not_expired}       description="DBS must be in date." />

        <SectionHeading title="Mandatory Documents" />
        <CheckRow label="DBS certificate uploaded"  done={status.checks.doc_dbs}               description="Upload the DBS certificate document." />
        <CheckRow label="Right to work uploaded"    done={status.checks.doc_right_to_work}      description="Upload proof of right to work." />
        <CheckRow label="Photo ID uploaded"         done={status.checks.doc_id}                 description="Upload passport or driving licence." />
        <CheckRow label="Proof of address uploaded" done={status.checks.doc_proof_of_address}   description="Upload a bank statement or utility bill." />

        <SectionHeading title="Mandatory Training (approved certificates required)" />
        {getRequiredTraining(staff.job_role).length === 0 ? (
          <p className="text-xs text-gray-400 py-2">No mandatory training required for this role.</p>
        ) : (
          getRequiredTraining(staff.job_role).map((cat) => (
            <CheckRow
              key={cat}
              label={(TRAINING_CATEGORY_LABELS as Record<string, string>)[cat] ?? cat.replace(/_/g, ' ')}
              done={!!status.checks[`training_${cat}`]}
              description={`Upload an approved ${(TRAINING_CATEGORY_LABELS as Record<string, string>)[cat] ?? cat.replace(/_/g, ' ')} certificate. Pending review does not satisfy this requirement.`}
            />
          ))
        )}

      </div>

      {/* ── Next Actions ──────────────────────────────────────────────────── */}
      {actions.length > 0 && (
        <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
            Next Actions
          </p>
          <ol className="space-y-2">
            {actions.map((action, i) => (
              <li key={action.id} className="flex items-start gap-2">
                <span className={`flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                  action.urgent
                    ? 'bg-red-100 text-red-700'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {i + 1}
                </span>
                <div className="flex-1">
                  <p className={`text-xs font-medium ${action.urgent ? 'text-red-700' : 'text-gray-700'}`}>
                    {action.label}
                    {action.urgent && (
                      <span className="ml-1.5 inline-flex items-center rounded px-1 py-0 text-xs bg-red-50 text-red-600 ring-1 ring-inset ring-red-600/20">
                        Urgent
                      </span>
                    )}
                  </p>
                </div>
                {/* Link into the HR edit form for payroll/HMRC/bank sections */}
                {(action.section === 'personal' || action.section === 'address' ||
                  action.section === 'emergency' || action.section === 'hmrc' ||
                  action.section === 'banking' || action.section === 'employment' ||
                  action.section === 'compliance') && (
                  <a
                    href={`/admin/staff/${staffProfileId}#hr-section`}
                    className="flex-shrink-0 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    Edit →
                  </a>
                )}
                {(action.section === 'documents' || action.section === 'training') && (
                  <a
                    href={`/admin/staff/${staffProfileId}#documents-section`}
                    className="flex-shrink-0 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    Upload →
                  </a>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* All complete message */}
      {actions.length === 0 && (
        <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2.5 text-xs text-green-700">
          ✓ All onboarding actions are complete. This worker is operationally ready.
        </div>
      )}

    </div>
  )
}
