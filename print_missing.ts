import { calculateOnboardingStatus, OnboardingInput } from './lib/staff/calculateOnboardingStatus.js'

const fullInput: OnboardingInput = {
  first_name:               'Jane',
  last_name:                'Smith',
  date_of_birth:            '1990-01-01',
  nationality:              'British',
  address_line_1:           '123 Care Lane',
  city:                     'London',
  postcode:                 'SW1A 1AA',
  emergency_contact_name:   'John Smith',
  emergency_contact_phone:  '07700900000',
  ni_number:                'AB123456C',
  employment_type:          'full_time',
  starter_declaration:      'A',
  bank_account_number:      '12345678',
  bank_sort_code:           '20-00-00',
  bank_account_name:        'Jane Smith',
  right_to_work_checked:    true,
  dbs_checked:              true,
  dbs_expiry_date:          '2027-01-01',
  policy_acknowledged:      true,
  uploadedDocumentTypes:    ['id', 'right_to_work', 'dbs', 'proof_of_address'],
  job_role:                 'care_worker',
  approvedTrainingCategories: [
    'manual_handling',
    'safeguarding',
    'basic_life_support',
    'infection_control',
    'health_safety',
  ],
}
const obs = calculateOnboardingStatus(fullInput);
console.log(obs.missing);
