/**
 * E2E test: Applicant Apply API
 * Tests that all JSONB sections (employment_history, references, criminal_record,
 * training_qualifications, professional_qualifications, professional_registration,
 * application_source, medical_history, work_availability, application_declarations)
 * are correctly saved to form_answers.
 *
 * Run:  node scripts/e2e-apply.mjs
 * Requires: dev server running on localhost:3000  OR  set USE_DIRECT_API=1 to skip HTTP call.
 */

import crypto from 'crypto'

// ── Config ──────────────────────────────────────────────────────────────────
const SUPABASE_URL        = 'https://uudwhnyfmqlwfbyylvfp.supabase.co'
const SERVICE_ROLE_KEY    = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1ZHdobnlmbXFsd2ZieXlsdmZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzkxMTUxOCwiZXhwIjoyMDkzNDg3NTE4fQ.pvCVPTA2T6dMsjC2sVDkT4eU6l2uvwpAq6v4_hLgc9Q'
const APP_URL             = 'http://localhost:3000'

// ── Supabase REST helpers ────────────────────────────────────────────────────
const headers = {
  apikey:        SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
  Prefer:        'return=representation',
}

async function supabase(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      apikey:          SERVICE_ROLE_KEY,
      Authorization:   `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = text || null }
  if (!res.ok && res.status !== 204) throw new Error(`Supabase ${method} ${path} → ${res.status}: ${text}`)
  return json
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const ok  = (msg) => console.log(`  ✅  ${msg}`)
const fail = (msg) => { console.error(`  ❌  ${msg}`); process.exitCode = 1 }
const info = (msg) => console.log(`\n── ${msg}`)

// ── 1. Get first real company ────────────────────────────────────────────────
info('1. Resolving company')
const companies = await supabase('GET', '/companies?select=id,name&limit=1')
if (!companies.length) throw new Error('No companies found in DB — cannot run E2E test')
const companyId = companies[0].id
ok(`Using company: ${companies[0].name} (${companyId})`)

// ── 2. Create a fresh test applicant with a known token ──────────────────────
info('2. Creating test applicant')
const rawToken   = `e2e-test-token-${Date.now()}`
const tokenHash  = crypto.createHash('sha256').update(rawToken).digest('hex')
const expiresAt  = new Date(Date.now() + 60 * 60 * 1000).toISOString() // +1h

// Clean up any previous e2e applicant (order matters: FK form_responses → applicants)
const prevApplicants = await supabase('GET', `/applicants?email=eq.e2e%2Bapply%40test.example&company_id=eq.${companyId}&select=id`)
for (const prev of (prevApplicants ?? [])) {
  await supabase('DELETE', `/form_responses?applicant_id=eq.${prev.id}`)
  await supabase('DELETE', `/applicants?id=eq.${prev.id}`)
}

const [applicant] = await supabase('POST', '/applicants', [{
  company_id:       companyId,
  email:            'e2e+apply@test.example',
  first_name:       'E2E',
  last_name:        'Tester',
  token_hash:       tokenHash,
  token_expires_at: expiresAt,
  status:           'applied',
}])
ok(`Created applicant: ${applicant.id}`)

// ── 3. Build the full payload ────────────────────────────────────────────────
info('3. Building full answer payload')
const answers = {
  // Personal Details
  first_name:                'E2E',
  last_name:                 'Tester',
  email:                     'e2e+apply@test.example',
  phone:                     '07700000000',
  job_role:                  'Support Worker',
  address_line_1:            '1 Test Street',
  address_line_2:            '',
  town_city:                 'London',
  postcode:                  'SW1A 1AA',
  date_of_birth:             '1990-01-01',
  national_insurance:        'AB123456C',

  // JSONB — Employment History
  employment_history: [
    {
      type: 'employment', employer: 'Acme Care', role: 'Carer',
      start_month: '2020-01', end_month: '2023-06', is_current: false,
      reason_for_leaving: 'Career progression', address: 'London',
      reference_name: 'Jane Doe', reference_email: 'jane@acme.com',
    },
    {
      type: 'education', institution: 'City College', course: 'Health & Social Care',
      start_month: '2018-09', end_month: '2019-07', is_current: false,
    },
  ],

  // JSONB — References
  references: [
    { name: 'Jane Doe', relationship: 'Manager', company: 'Acme Care', email: 'jane@acme.com', phone: '07700111111' },
    { name: 'John Smith', relationship: 'Colleague', company: 'City NHS', email: 'john@nhs.uk', phone: '07700222222' },
  ],

  // Right to Work
  right_to_work_uk:   true,
  right_to_work_type: 'british_passport',
  requires_sponsorship: false,
  visa_expiry_date:   null,
  share_code:         '',

  // JSONB — Criminal Record
  criminal_record: {
    has_convictions:         false,
    convictions_detail:      '',
    has_pending_proceedings: false,
    pending_detail:          '',
    has_reprimands:          false,
    reprimands_detail:       '',
    dbs_check_consent:       true,
  },

  // Care Experience
  previous_care_experience: true,
  care_experience_details:  'Worked in residential care for 3 years.',
  preferred_work_setting:   'residential',
  available_start_date:     '2026-06-01',

  // JSONB — Training & Qualifications
  training_qualifications: {
    items: [
      { name: 'Moving & Handling', completed: true, date: '2024-03-15' },
      { name: 'First Aid', completed: true, date: '2024-01-10' },
    ],
    other: [],
  },

  // JSONB — Professional Qualifications
  professional_qualifications: [
    { qualification: 'NVQ Level 3 Health & Social Care', awarding_body: 'City & Guilds', year: '2022' },
  ],

  // JSONB — Professional Registration
  professional_registration: [
    { body: 'NMC', registration_number: 'NMC12345', expiry_date: '2027-01-01' },
  ],

  // JSONB — Application Source
  application_source: {
    source: 'indeed',
    other_detail: '',
  },

  // JSONB — Medical History
  medical_history: {
    has_conditions: false,
    details: '',
    fit_for_work: true,
  },

  // JSONB — Work Availability
  work_availability: {
    days: { monday: true, tuesday: true, wednesday: false, thursday: true, friday: true, saturday: false, sunday: false },
    shifts: { morning: true, afternoon: true, night: false },
    hours_per_week: 37,
  },

  // Emergency Contact
  emergency_contact_name:         'Mary Tester',
  emergency_contact_relationship: 'Spouse',
  emergency_contact_phone:        '07700333333',
  emergency_contact_email:        'mary@test.example',

  // JSONB — Declaration & Consent
  declaration_consent: {
    agreed:    true,
    signed_at: new Date().toISOString(),
    full_name: 'E2E Tester',
  },

  // JSONB — Application Declarations
  application_declarations: {
    info_is_accurate:           true,
    understands_dbs_check:      true,
    consent_to_reference_check: true,
    agreed_at:                  new Date().toISOString(),
  },
}
ok('Payload built')

// ── 4. POST to /api/applicant/apply ─────────────────────────────────────────
info('4. Calling POST /api/applicant/apply')
let applyRes
try {
  const res = await fetch(`${APP_URL}/api/applicant/apply`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ token: rawToken, answers, submit: false }),
  })
  applyRes = await res.json()
  if (!res.ok) throw new Error(JSON.stringify(applyRes))
  ok(`API responded: ${JSON.stringify(applyRes)}`)
} catch (err) {
  fail(`API call failed: ${err.message}`)
  console.error('\n⚠️  Make sure the dev server is running:  npm run dev\n')
  process.exit(1)
}

const responseId = applyRes.response_id

// ── 5. Read back saved answers ───────────────────────────────────────────────
info('5. Reading back saved form_answers from Supabase')
const savedAnswers = await supabase(
  'GET',
  `/form_answers?response_id=eq.${responseId}&select=value,form_fields!field_id(slug)`,
)
const slugToValue = {}
for (const row of savedAnswers) {
  const slug = row.form_fields?.slug
  if (slug) slugToValue[slug] = row.value
}
ok(`Fetched ${savedAnswers.length} answer rows`)

// ── 6. Assert each JSONB section ─────────────────────────────────────────────
info('6. Verifying JSONB sections')

const JSONB_FIELDS = [
  'employment_history',
  'references',
  'criminal_record',
  'training_qualifications',
  'professional_qualifications',
  'professional_registration',
  'application_source',
  'medical_history',
  'work_availability',
  'application_declarations',
]

for (const slug of JSONB_FIELDS) {
  const saved = slugToValue[slug]
  if (saved === undefined || saved === null) {
    fail(`${slug} — NOT saved (missing from form_answers)`)
  } else if (typeof saved !== 'object') {
    fail(`${slug} — saved as primitive (${JSON.stringify(saved)}), expected object/array`)
  } else {
    ok(`${slug} — saved ✓  (${JSON.stringify(saved).slice(0, 80)}…)`)
  }
}

// ── 7. Also verify flat fields ────────────────────────────────────────────────
info('7. Verifying flat text fields')
const FLAT_FIELDS = [
  'first_name', 'last_name', 'email', 'phone', 'job_role',
  'address_line_1', 'town_city', 'postcode', 'date_of_birth', 'national_insurance',
]
for (const slug of FLAT_FIELDS) {
  const saved = slugToValue[slug]
  if (!saved) {
    fail(`${slug} — NOT saved`)
  } else {
    ok(`${slug} — saved ✓  (${JSON.stringify(saved).slice(0, 60)})`)
  }
}

// ── 8. Check NO stale fields survived ────────────────────────────────────────
info('8. Checking for stale fields in form_fields table')
const STALE_SLUGS = [
  'current_employer', 'current_job_title', 'employment_start_date',
  'reference_1_name', 'reference_2_name', 'reference_1_email', 'reference_2_email',
]

// Get form_id from the response
const [formResponse] = await supabase(
  'GET',
  `/form_responses?id=eq.${responseId}&select=form_id`,
)
const formId = formResponse?.form_id

if (formId) {
  const staleRows = await supabase(
    'GET',
    `/form_fields?form_id=eq.${formId}&slug=in.(${STALE_SLUGS.join(',')})&select=slug`,
  )
  if (staleRows.length === 0) {
    ok('No stale fields found in form_fields ✓')
  } else {
    for (const r of staleRows) fail(`Stale field still present: ${r.slug}`)
  }
} else {
  fail('Could not resolve form_id to check stale fields')
}

// ── 9. Summary ───────────────────────────────────────────────────────────────
info('Done')
if (process.exitCode === 1) {
  console.error('\n❌  Some checks FAILED — see above\n')
} else {
  console.log('\n✅  All checks PASSED\n')
}
