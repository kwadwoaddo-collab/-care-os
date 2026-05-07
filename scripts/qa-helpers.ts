/**
 * scripts/qa-helpers.ts
 *
 * Reusable helper functions for the QA environment seeder.
 * All functions are pure builders — they return row objects ready for DB insert.
 * Actual insertion is handled by the caller using dbInsert().
 */

export const QA_TAG = '[QA]'
export const QA_COMPANY_NAME = 'SprintScale QA'
export const QA_COMPANY_SLUG = 'sprintscale-qa'

// ── Time helpers ──────────────────────────────────────────────────────────────

export function daysFromNow(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export function isoNow(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString()
}

export function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export type Row = Record<string, unknown>

// ── Client builder ────────────────────────────────────────────────────────────

const CLIENT_FIRST_NAMES = [
  'Agnes', 'Bernard', 'Constance', 'Derek', 'Edith',
  'Francis', 'Gladys', 'Harold', 'Irene', 'John',
]
const CLIENT_LAST_NAMES = [
  'Ashworth', 'Bentley', 'Crawford', 'Denton', 'Everett',
  'Farnsworth', 'Goodwin', 'Hartley', 'Irving', 'Jenkins',
]
const POSTCODES = ['SW1A 1AA', 'E1 6RF', 'M1 1AE', 'B1 1BB', 'LS1 4DY']
const ADDRESSES  = ['12 Oak Road', '7 Maple Avenue', '34 Elm Street', '89 Birch Lane', '2 Cedar Close']

export function createQaClient(companyId: string, index: number): Row {
  const statuses    = ['active', 'active', 'active', 'paused', 'prospective', 'ended', 'active', 'active', 'paused', 'active'] as const
  const risks       = ['low', 'standard', 'high', 'critical', 'standard', 'low', 'high', 'standard', 'critical', 'standard'] as const
  const fundings    = ['local_authority', 'nhs', 'private', 'direct_payment', 'other'] as const

  const i = index % CLIENT_FIRST_NAMES.length
  return {
    company_id:                    companyId,
    first_name:                    QA_TAG,
    last_name:                     `${CLIENT_FIRST_NAMES[i]} ${CLIENT_LAST_NAMES[i]}`,
    preferred_name:                CLIENT_FIRST_NAMES[i],
    date_of_birth:                 daysFromNow(-(70 * 365 + i * 200)),
    phone:                         `07700 90${String(index).padStart(4, '0')}`,
    email:                         `qa.client${index + 1}@sprintscaleit.co.uk`,
    address_line_1:                ADDRESSES[i % ADDRESSES.length],
    town_city:                     'London',
    postcode:                      POSTCODES[i % POSTCODES.length],
    status:                        statuses[i],
    care_start_date:               daysFromNow(-(90 - i * 5)),
    funding_type:                  fundings[i % fundings.length],
    risk_level:                    risks[i],
    emergency_contact_name:        `EC for ${CLIENT_FIRST_NAMES[i]}`,
    emergency_contact_phone:       `07700 91${String(index).padStart(4, '0')}`,
    emergency_contact_relationship: 'Son',
    notes:                         `${QA_TAG} Test client ${index + 1}. Created for QA environment.`,
  }
}

// ── Staff builder ─────────────────────────────────────────────────────────────

const STAFF_FIRST_NAMES = [
  'Amara', 'Blake', 'Chloe', 'Dylan', 'Elena',
  'Finley', 'Grace', 'Hugo', 'Isla', 'Jake',
]
const STAFF_LAST_NAMES = [
  'Okonkwo', 'Mitchell', 'Patel', 'Nwosu', 'Rossi',
  'Adeola', 'Thompson', 'Barker', 'Singh', 'Clarke',
]

export type QaStaffOptions = {
  companyId: string
  profileId?: string
  index: number
  /** Override status */
  status?: string
}

export function createQaStaff(opts: QaStaffOptions): Row {
  const { companyId, profileId, index } = opts
  const statuses   = [
    'active', 'active', 'active', 'active', 'active',
    'pre_employment', 'pre_employment', 'suspended', 'active', 'active',
  ]
  const jobRoles   = [
    'Care Worker', 'Senior Carer', 'Care Worker', 'Care Coordinator',
    'Care Worker', 'Care Worker', 'Senior Carer', 'Care Worker', 'Care Worker', 'Team Leader',
  ]
  const employment = ['full_time', 'part_time', 'zero_hours', 'full_time', 'part_time',
    'zero_hours', 'full_time', 'part_time', 'zero_hours', 'full_time']

  const i = index % STAFF_FIRST_NAMES.length

  // Compliance scenarios
  const dbsExpiries = [
    daysFromNow(-30),   // 0 expired
    daysFromNow(14),    // 1 expiring soon
    daysFromNow(180),   // 2 valid
    daysFromNow(365),   // 3 valid
    daysFromNow(-1),    // 4 just expired
    null,               // 5 not yet set
    daysFromNow(60),    // 6 valid
    daysFromNow(30),    // 7 expiring
    daysFromNow(200),   // 8 valid
    daysFromNow(90),    // 9 valid
  ]

  return {
    company_id:               companyId,
    profile_id:               profileId ?? null,
    first_name:               QA_TAG,
    last_name:                `${STAFF_FIRST_NAMES[i]} ${STAFF_LAST_NAMES[i]}`,
    email:                    `qa.staff${index + 1}@sprintscaleit.co.uk`,
    phone:                    `07700 92${String(index).padStart(4, '0')}`,
    job_role:                 jobRoles[i],
    status:                   opts.status ?? statuses[i],
    employment_type:          employment[i],
    contracted_hours:         i % 2 === 0 ? 37.5 : 20,
    start_date:               daysFromNow(-(60 + i * 10)),
    onboarding_completed:     i < 7,
    dbs_checked:              i !== 5,
    dbs_number:               i !== 5 ? `QA-DBS-${100 + index}` : null,
    dbs_expiry_date:          dbsExpiries[i],
    right_to_work_checked:    i !== 5 && i !== 7,
    address_line_1:           `${10 + i} Staff Road`,
    city:                     'London',
    postcode:                 POSTCODES[i % POSTCODES.length],
    date_of_birth:            daysFromNow(-(25 * 365 + i * 100)),
    nationality:              i % 3 === 0 ? 'British' : i % 3 === 1 ? 'Nigerian' : 'Indian',
    ni_number:                `QA ${String.fromCharCode(65 + i)}B ${String(100 + index).padStart(6, '0')} C`,
    emergency_contact_name:   `EC-Staff-${index + 1}`,
    emergency_contact_phone:  `07700 93${String(index).padStart(4, '0')}`,
    emergency_contact_relationship: 'Partner',
  }
}

// ── Care package builder ──────────────────────────────────────────────────────

export function createQaCarePackage(companyId: string, clientId: string, index: number): Row {
  const statuses  = ['active', 'active', 'paused', 'active', 'draft'] as const
  const fundings  = ['local_authority', 'nhs', 'private', 'direct_payment', 'other'] as const
  const hours     = [14, 21, 7, 28, 10.5] as const

  const i = index % 5
  return {
    company_id:  companyId,
    client_id:   clientId,
    title:       `${QA_TAG} Care Package ${index + 1}`,
    description: `${QA_TAG} Residential domiciliary support package. Created for QA testing.`,
    start_date:  daysFromNow(-(60 + i * 7)),
    end_date:    i === 4 ? daysFromNow(30) : null,
    status:      statuses[i],
    funding_type: fundings[i],
    weekly_hours: hours[i],
  }
}

// ── Shift builder ─────────────────────────────────────────────────────────────

export type QaShiftOptions = {
  companyId: string
  clientId?: string
  carePackageId?: string
  staffId?: string
  index: number
}

export function createQaShift(opts: QaShiftOptions): Row {
  const { companyId, clientId, carePackageId, staffId, index } = opts

  const titles    = ['Morning Visit', 'Afternoon Visit', 'Evening Visit', 'Night Cover', 'Sleep-in', 'Weekend Day', 'Bank Holiday', 'Double-up AM']
  const starts    = ['08:00', '13:00', '18:00', '22:00', '22:00', '09:00', '10:00', '08:00']
  const ends      = ['12:00', '17:00', '22:00', '07:00', '07:00', '17:00', '14:00', '12:00']
  const types     = ['day',   'day',   'day',   'night', 'sleep_in', 'day', 'day',   'day']

  // Mixed realistic statuses
  const statuses  = [
    'completed',   // 0
    'completed',   // 1
    'completed',   // 2
    'confirmed',   // 3
    'scheduled',   // 4
    'scheduled',   // 5
    'cancelled',   // 6
    'cancelled',   // 7
    'completed',   // 8
    'completed',   // 9
    'scheduled',   // 10
    'confirmed',   // 11
    'completed',   // 12
    'no_show',     // 13
    'scheduled',   // 14
    'scheduled',   // 15
    'completed',   // 16
    'confirmed',   // 17
    'cancelled',   // 18
    'scheduled',   // 19
  ]

  const workerAckStatuses = [
    'accepted', 'accepted', 'accepted', 'accepted', null,
    null, null, null, 'accepted', 'accepted',
    null, 'declined', 'accepted', null, null,
    'running_late', 'accepted', 'accepted', null, null,
  ]

  const i  = index % titles.length
  const si = index % statuses.length

  const shiftDate = daysFromNow(index < 10 ? -(10 - index) : (index - 10))

  return {
    company_id:          companyId,
    client_id:           clientId ?? null,
    care_package_id:     carePackageId ?? null,
    assigned_staff_id:   staffId ?? null,
    title:               `${QA_TAG} ${titles[i]}`,
    shift_date:          shiftDate,
    start_time:          starts[i],
    end_time:            ends[i],
    shift_type:          types[i],
    status:              statuses[si],
    worker_ack_status:   workerAckStatuses[si] ?? null,
    worker_ack_at:       workerAckStatuses[si] ? isoNow(-(10 - Math.min(si, 9))) : null,
    worker_ack_reason:   workerAckStatuses[si] === 'declined' ? 'Personal appointment' : null,
    location:            `${10 + index} QA Street, London, ${POSTCODES[index % POSTCODES.length]}`,
    notes:               `${QA_TAG} Auto-seeded shift ${index + 1}.`,
    created_by:          'qa-seeder',
  }
}

// ── Visit note builder ────────────────────────────────────────────────────────

export type QaVisitNoteOptions = {
  companyId: string
  shiftId: string
  clientId?: string
  staffProfileId?: string
  index: number
}

export function createQaVisitNote(opts: QaVisitNoteOptions): Row {
  const { companyId, shiftId, clientId, staffProfileId, index } = opts

  const statuses = ['submitted', 'submitted', 'submitted', 'draft', 'submitted',
    'submitted', 'submitted', 'draft', 'submitted', 'submitted',
    'submitted', 'submitted', 'draft', 'submitted', 'submitted']

  const careTasks = [
    ['personal_care', 'medication_prompt', 'meal_preparation'],
    ['personal_care', 'mobility_support'],
    ['medication_prompt', 'domestic_tasks'],
    ['personal_care'],
    ['meal_preparation', 'domestic_tasks', 'companionship'],
  ]

  const wellbeingNotes = [
    'Client was in good spirits today. Ate well at breakfast.',
    'Client appeared tired. Resting comfortably after personal care.',
    'Client engaged with conversation. Reports mild joint pain.',
    'Client distressed at start of visit. Settled after 20 minutes.',
    'Client very happy. Family visited yesterday.',
  ]

  const si = index % statuses.length
  const isSubmitted = statuses[si] === 'submitted'

  return {
    company_id:           companyId,
    shift_id:             shiftId,
    client_id:            clientId ?? null,
    staff_profile_id:     staffProfileId ?? null,
    wellbeing_notes:      wellbeingNotes[index % wellbeingNotes.length],
    care_tasks_completed: JSON.stringify(careTasks[index % careTasks.length]),
    medication_prompted:  index % 2 === 0,
    medication_notes:     index % 2 === 0 ? 'Morning medication taken without issue.' : null,
    food_fluid_notes:     'Ate 75% of meal. Drank 2 glasses of water.',
    incident_reported:    index === 3,
    incident_notes:       index === 3 ? `${QA_TAG} Client slipped while transferring. No injury. GP notified.` : null,
    missed_tasks:         index === 7 ? 'Domestic tasks — client declined' : null,
    general_notes:        `${QA_TAG} Visit note ${index + 1}. Auto-seeded.`,
    status:               statuses[si],
    submitted_at:         isSubmitted ? isoNow(-(si + 1)) : null,
  }
}

// ── Incident builder ──────────────────────────────────────────────────────────

export type QaIncidentOptions = {
  companyId: string
  clientId?: string
  staffProfileId?: string
  shiftId?: string
  index: number
}

export function createQaIncident(opts: QaIncidentOptions): Row {
  const { companyId, clientId, staffProfileId, shiftId, index } = opts

  const types       = ['fall', 'medication_error', 'safeguarding', 'complaint', 'behaviour']
  const severities  = ['low', 'medium', 'high', 'critical', 'medium']
  const statuses    = ['open', 'investigating', 'open', 'resolved', 'closed']
  const descriptions = [
    `${QA_TAG} Client fell while attempting to transfer from chair. No visible injury.`,
    `${QA_TAG} Incorrect medication administered by previous shift worker. Dose noted and rectified.`,
    `${QA_TAG} Safeguarding concern raised — unexplained bruising observed on client's arm.`,
    `${QA_TAG} Family member complained about quality of care provided during evening shift.`,
    `${QA_TAG} Client exhibited aggressive behaviour towards care worker.`,
  ]

  const i = index % 5
  const resolved = statuses[i] === 'resolved' || statuses[i] === 'closed'

  return {
    company_id:             companyId,
    client_id:              clientId ?? null,
    staff_profile_id:       staffProfileId ?? null,
    shift_id:               shiftId ?? null,
    incident_type:          types[i],
    severity:               severities[i],
    status:                 statuses[i],
    occurred_at:            isoNow(-(index + 1)),
    description:            descriptions[i],
    immediate_action_taken: 'Notified line manager. First aid kit checked. Incident log completed.',
    escalation_required:    severities[i] === 'high' || severities[i] === 'critical',
    escalated_to:           severities[i] === 'critical' ? 'Registered Manager & CQC' : severities[i] === 'high' ? 'Registered Manager' : null,
    follow_up_required:     !resolved,
    follow_up_notes:        !resolved ? 'Schedule follow-up within 48 hours.' : null,
    resolved_at:            resolved ? isoNow(-1) : null,
    resolution_notes:       resolved ? 'Matter investigated and resolved satisfactorily.' : null,
  }
}

// ── Timesheet builder ─────────────────────────────────────────────────────────

export type QaTimesheetOptions = {
  companyId: string
  shiftId: string
  staffProfileId?: string
  index: number
}

export function createQaTimesheet(opts: QaTimesheetOptions): Row {
  const { companyId, shiftId, staffProfileId, index } = opts

  const statuses       = ['completed', 'completed', 'missed', 'completed', 'adjusted', 'completed', 'clocked_in', 'pending']
  const latenesses     = [0, 12, 0, 5, 0, 0, 8, 0]
  const workedMinutes  = [240, 240, 0, 235, 240, 240, null, null]
  const breakMins      = [30, 30, 0, 30, 30, 0, 0, 0]

  const si = index % statuses.length
  const baseDate = new Date()
  baseDate.setDate(baseDate.getDate() - (8 - index))

  const clockIn  = new Date(baseDate)
  clockIn.setHours(8, latenesses[si], 0, 0)

  const clockOut = new Date(clockIn)
  if (workedMinutes[si]) {
    clockOut.setMinutes(clockOut.getMinutes() + (workedMinutes[si] as number) + breakMins[si])
  }

  return {
    company_id:       companyId,
    shift_id:         shiftId,
    staff_profile_id: staffProfileId ?? null,
    scheduled_start:  baseDate.toISOString(),
    scheduled_end:    new Date(baseDate.getTime() + 4 * 60 * 60 * 1000).toISOString(),
    clock_in:         statuses[si] !== 'pending' ? clockIn.toISOString() : null,
    clock_out:        workedMinutes[si] ? clockOut.toISOString() : null,
    break_minutes:    breakMins[si],
    worked_minutes:   workedMinutes[si] ?? null,
    status:           statuses[si],
    lateness_minutes: latenesses[si],
    notes:            `${QA_TAG} Timesheet ${index + 1}. Auto-seeded.`,
  }
}

// ── Document builder ──────────────────────────────────────────────────────────

export type QaDocumentOptions = {
  companyId: string
  profileId?: string
  index: number
}

export function createQaDocument(opts: QaDocumentOptions): Row {
  const { companyId, profileId, index } = opts

  const docTypes = [
    'DBS Certificate', 'Right to Work', 'Employment Contract',
    'ID Verification', 'Reference Letter', 'Training Certificate',
    'Medical Clearance', 'Insurance Certificate', 'Risk Assessment', 'Supervision Notes',
    'DBS Certificate', 'Right to Work', 'Employment Contract',
    'Training Certificate', 'Risk Assessment', 'Medical Clearance',
    'ID Verification', 'Reference Letter', 'Supervision Notes', 'Training Certificate',
  ]

  const extensions = ['pdf', 'pdf', 'pdf', 'jpg', 'pdf', 'pdf', 'pdf', 'pdf', 'pdf', 'pdf']

  const i = index % docTypes.length
  const ext = extensions[i % extensions.length]
  const docName = `${docTypes[i]} — QA Staff ${Math.floor(index / 2) + 1}.${ext}`
  const storagePath = `sprintscale-qa/staff/${profileId ?? 'unlinked'}/${docName.toLowerCase().replace(/\s+/g, '-')}`

  return {
    company_id:   companyId,
    profile_id:   profileId ?? null,
    name:         `${QA_TAG} ${docName}`,
    storage_path: storagePath,
    file_type:    ext === 'pdf' ? 'application/pdf' : 'image/jpeg',
    file_size:    100_000 + index * 10_000,
  }
}

// ── Compliance item builder ───────────────────────────────────────────────────

export function createQaComplianceItems(
  companyId: string,
  staffProfileId: string,
  staffIndex: number,
): Row[] {
  const itemTypes = ['dbs', 'right_to_work', 'reference_1', 'reference_2', 'id_check', 'induction_training']

  return itemTypes.map((itemType, j) => {
    // Vary status based on staffIndex to simulate real compliance states
    let status: string
    let expiresAt: string | null = null

    if (staffIndex === 0 || staffIndex === 4) {
      // Expired compliance
      status = 'expired'
      expiresAt = daysFromNow(-(j + 1) * 30)
    } else if (staffIndex === 1 || staffIndex === 7) {
      // Expiring soon
      status = j < 3 ? 'complete' : 'in_progress'
      expiresAt = j < 3 ? daysFromNow(14 + j * 3) : null
    } else if (staffIndex === 5) {
      // Onboarding incomplete
      status = j === 0 ? 'complete' : 'not_started'
    } else {
      // Mostly complete
      status = j < 5 ? 'complete' : 'in_progress'
      expiresAt = j < 3 ? daysFromNow(180 + j * 30) : null
    }

    return {
      company_id:       companyId,
      staff_profile_id: staffProfileId,
      item_type:        itemType,
      status,
      notes:            `${QA_TAG} ${itemType} compliance for QA staff ${staffIndex + 1}.`,
      expires_at:       expiresAt,
      completed_at:     status === 'complete' || status === 'expired' ? isoNow(-(30 + j * 7)) : null,
    }
  })
}
