/**
 * scripts/seed-qa-environment.ts
 *
 * Provisions the full SprintScale QA environment:
 *   - QA Company (SprintScale QA)
 *   - 3 auth users  (admin / coordinator / care_worker)
 *   - 10 clients, 10 staff, 5 care packages, 40 shifts
 *   - 15 visit notes, 5 incidents, 8 timesheets, 20 documents
 *   - Compliance items for every staff member
 *
 * Usage:
 *   npx tsx scripts/seed-qa-environment.ts            # Full seed
 *   npx tsx scripts/seed-qa-environment.ts --dry-run  # Preview without DB writes
 *
 * Safety rules:
 *   - ONLY creates / touches the SprintScale QA company
 *   - Never modifies production company records
 *   - All records prefixed with [QA] for easy identification
 *
 * Environment variables:
 *   NEXT_PUBLIC_SUPABASE_URL    — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY   — Service role key (server-only)
 *   QA_EMAIL_MODE=true          — Log notifications without sending real emails
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import {
  QA_TAG,
  QA_COMPANY_NAME,
  QA_COMPANY_SLUG,
  createQaClient,
  createQaStaff,
  createQaCarePackage,
  createQaShift,
  createQaVisitNote,
  createQaIncident,
  createQaTimesheet,
  createQaDocument,
  createQaComplianceItems,
  isoNow,
  type Row,
} from './qa-helpers'

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const QA_EMAIL_MODE    = process.env.QA_EMAIL_MODE === 'true'

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = createClient<any>(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const args    = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')

// ── Logging helpers ───────────────────────────────────────────────────────────

const COUNTS = { clients: 0, staff: 0, care_packages: 0, shifts: 0, visit_notes: 0, incidents: 0, timesheets: 0, documents: 0, compliance_items: 0 }

function log(msg: string)  { console.log(msg) }
function ok(msg: string)   { console.log(`  ✓ ${msg}`) }
function fail(msg: string) { console.error(`  ✗ ${msg}`) }
function warn(msg: string) { console.warn(`  ⚠  ${msg}`) }
function info(msg: string) { console.log(`  ℹ  ${msg}`) }

// ── DB helpers ────────────────────────────────────────────────────────────────

async function dbInsert(table: string, rows: Row[], label: string): Promise<Row[]> {
  if (rows.length === 0) return []

  if (DRY_RUN) {
    log(`  [dry-run] Would insert ${rows.length} row(s) into ${table}`)
    // Return rows with fake UUIDs so downstream builders still work
    return rows.map((r, i) => ({ ...r, id: `dry-run-id-${table}-${i}` }))
  }

  const { data, error } = await db.from(table).insert(rows).select()

  if (error) {
    fail(`Insert into ${table} failed: ${error.message}`)
    return []
  }

  ok(`${label}: ${(data as Row[]).length} row(s) created`)
  return data as Row[]
}

function rowId(row: Row): string {
  return row.id as string
}

// ── QA Company ────────────────────────────────────────────────────────────────

async function resolveQaCompany(): Promise<string> {
  log('\n🏢 Resolving QA company…')

  if (DRY_RUN) {
    info(`Would create or reuse company: "${QA_COMPANY_NAME}"`)
    return 'dry-run-company-id'
  }

  const { data: existing } = await db
    .from('companies')
    .select('id, name')
    .eq('slug', QA_COMPANY_SLUG)
    .maybeSingle()

  if (existing) {
    ok(`Reusing existing company: ${existing.name} (${existing.id})`)
    return existing.id as string
  }

  const { data, error } = await db
    .from('companies')
    .insert({ name: QA_COMPANY_NAME, slug: QA_COMPANY_SLUG })
    .select()
    .single()

  if (error || !data) {
    fail(`Could not create QA company: ${error?.message}`)
    process.exit(1)
  }

  ok(`Created company: ${QA_COMPANY_NAME} (${data.id})`)
  return data.id as string
}

// ── Auth users + profiles ─────────────────────────────────────────────────────

const QA_AUTH_USERS = [
  { email: 'qa-admin@sprintscaleit.co.uk',       first_name: 'QA',          last_name: 'Admin',       role: 'company_admin' as const },
  { email: 'qa-coordinator@sprintscaleit.co.uk', first_name: 'QA',          last_name: 'Coordinator', role: 'coordinator'   as const },
  { email: 'qa-worker@sprintscaleit.co.uk',      first_name: 'QA',          last_name: 'Worker',      role: 'care_worker'   as const },
]
const QA_DEFAULT_PASSWORD = 'ChangeMe123!'

async function seedAuthUsers(companyId: string): Promise<string[]> {
  log('\n🔑 Creating QA auth users…')

  const profileIds: string[] = []

  for (const user of QA_AUTH_USERS) {
    if (DRY_RUN) {
      info(`Would create auth user: ${user.email} (role: ${user.role})`)
      profileIds.push(`dry-run-profile-${user.role}`)
      continue
    }

    // Create auth user via admin API
    const { data: authData, error: authErr } = await db.auth.admin.createUser({
      email: user.email,
      password: QA_DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: { company_id: companyId, role: user.role },
    })

    if (authErr) {
      if (authErr.message.includes('already been registered') || authErr.message.includes('already exists')) {
        warn(`Auth user already exists: ${user.email} — fetching profile`)
        const { data: existingProfile } = await db
          .from('profiles')
          .select('id')
          .eq('email', user.email)
          .eq('company_id', companyId)
          .maybeSingle()
        if (existingProfile) {
          profileIds.push(existingProfile.id as string)
        }
        continue
      }
      fail(`Failed to create auth user ${user.email}: ${authErr.message}`)
      continue
    }

    const authUserId = authData.user?.id
    if (!authUserId) { fail(`No user ID returned for ${user.email}`); continue }

    // Upsert matching profile row
    const { data: profile, error: profErr } = await db
      .from('profiles')
      .upsert({
        id:         authUserId,
        company_id: companyId,
        role:       user.role,
        first_name: user.first_name,
        last_name:  user.last_name,
        email:      user.email,
      }, { onConflict: 'id' })
      .select()
      .single()

    if (profErr) {
      fail(`Failed to create profile for ${user.email}: ${profErr.message}`)
      continue
    }

    ok(`Created user ${user.email} → role: ${user.role} (${authUserId})`)
    profileIds.push(profile.id as string)
  }

  return profileIds
}

// ── Fake notification log ─────────────────────────────────────────────────────

async function logFakeNotification(companyId: string, recipientEmail: string, subject: string) {
  if (!QA_EMAIL_MODE) return

  if (DRY_RUN) {
    info(`[QA_EMAIL_MODE] Would log notification: "${subject}" → ${recipientEmail}`)
    return
  }

  const { error } = await db.from('notification_logs').insert({
    company_id:      companyId,
    event_type:      'qa_test_notification',
    recipient_email: recipientEmail,
    subject,
    status:          'skipped',
    error_message:   'QA_EMAIL_MODE=true — email not sent',
    entity_type:     'qa_seed',
    entity_id:       null,
  })

  if (error) warn(`Could not write notification log: ${error.message}`)
  else ok(`Logged fake notification for ${recipientEmail}`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  log('\n╔══════════════════════════════════════════════════════╗')
  log('║    Care OS — QA Environment Seeder                  ║')
  log('╚══════════════════════════════════════════════════════╝')

  if (DRY_RUN)       log('\n⚠  DRY RUN — no data will be written\n')
  if (QA_EMAIL_MODE) log('\n📧 QA_EMAIL_MODE=true — emails will be logged, not sent\n')

  // ── 1. Company ─────────────────────────────────────────────────────────────
  const companyId = await resolveQaCompany()

  // ── 2. Auth users ──────────────────────────────────────────────────────────
  const profileIds = await seedAuthUsers(companyId)

  // ── 3. Clients ─────────────────────────────────────────────────────────────
  log('\n👥 Creating 10 QA clients…')
  const clientRows = Array.from({ length: 10 }, (_, i) => createQaClient(companyId, i))
  const clients    = await dbInsert('clients', clientRows, 'Clients')
  COUNTS.clients   = clients.length

  // ── 4. Staff profiles ──────────────────────────────────────────────────────
  log('\n👤 Creating 10 QA staff profiles…')
  const staffRows = Array.from({ length: 10 }, (_, i) =>
    createQaStaff({ companyId, index: i })
  )
  const staff    = await dbInsert('staff_profiles', staffRows, 'Staff profiles')
  COUNTS.staff   = staff.length

  // ── 5. Care packages ───────────────────────────────────────────────────────
  log('\n📦 Creating 5 QA care packages…')
  const pkgRows = Array.from({ length: 5 }, (_, i) =>
    createQaCarePackage(companyId, clients[i % clients.length] ? rowId(clients[i % clients.length]) : 'dry-run-client', i)
  )
  const packages   = await dbInsert('care_packages', pkgRows, 'Care packages')
  COUNTS.care_packages = packages.length

  // ── 6. Shifts (40) ─────────────────────────────────────────────────────────
  log('\n📅 Creating 40 QA shifts…')
  const shiftRows = Array.from({ length: 40 }, (_, i) => {
    const clientId       = clients.length   > 0 ? rowId(clients[i % clients.length])     : undefined
    const carePackageId  = packages.length  > 0 ? rowId(packages[i % packages.length])   : undefined
    // Leave some shifts unassigned
    const staffId        = i < 30 && staff.length > 0 ? rowId(staff[i % staff.length]) : undefined

    return createQaShift({ companyId, clientId, carePackageId, staffId, index: i })
  })
  const shifts    = await dbInsert('shifts', shiftRows, 'Shifts')
  COUNTS.shifts   = shifts.length

  // ── 7. Visit notes (15) ────────────────────────────────────────────────────
  log('\n📝 Creating 15 QA visit notes…')
  // Only create notes for completed/confirmed shifts
  const eligibleShifts = shifts.filter(s => ['completed', 'confirmed'].includes(s.status as string))
  const noteShifts     = eligibleShifts.slice(0, 15)
  const noteRows = noteShifts.map((shift, i) => {
    const clientId        = shift.client_id as string | undefined
    const staffProfileId  = shift.assigned_staff_id as string | undefined
    return createQaVisitNote({
      companyId,
      shiftId:       rowId(shift),
      clientId,
      staffProfileId,
      index: i,
    })
  })
  const visitNotes   = await dbInsert('visit_notes', noteRows, 'Visit notes')
  COUNTS.visit_notes = visitNotes.length

  // ── 8. Incidents (5) ───────────────────────────────────────────────────────
  log('\n🚨 Creating 5 QA incidents…')
  const incidentRows = Array.from({ length: 5 }, (_, i) =>
    createQaIncident({
      companyId,
      clientId:       clients[i]    ? rowId(clients[i])    : undefined,
      staffProfileId: staff[i]      ? rowId(staff[i])      : undefined,
      shiftId:        shifts[i]     ? rowId(shifts[i])     : undefined,
      index: i,
    })
  )
  const incidents   = await dbInsert('incidents', incidentRows, 'Incidents')
  COUNTS.incidents  = incidents.length

  // ── 9. Timesheets (8) ──────────────────────────────────────────────────────
  log('\n🕒 Creating 8 QA timesheets…')
  const completedShifts = shifts.filter(s => s.status === 'completed').slice(0, 8)
  const timesheetRows   = completedShifts.map((shift, i) =>
    createQaTimesheet({
      companyId,
      shiftId:         rowId(shift),
      staffProfileId:  shift.assigned_staff_id as string | undefined,
      index: i,
    })
  )
  const timesheets   = await dbInsert('timesheets', timesheetRows, 'Timesheets')
  COUNTS.timesheets  = timesheets.length

  // ── 10. Documents (20) ────────────────────────────────────────────────────
  log('\n📄 Creating 20 QA documents…')
  const docRows = Array.from({ length: 20 }, (_, i) => {
    const profileId = profileIds[i % profileIds.length]
    return createQaDocument({ companyId, profileId, index: i })
  })
  const documents   = await dbInsert('documents', docRows, 'Documents')
  COUNTS.documents  = documents.length

  // ── 11. Compliance items ──────────────────────────────────────────────────
  log('\n✅ Creating compliance items for QA staff…')
  const allComplianceRows: Row[] = []
  for (let i = 0; i < staff.length; i++) {
    const items = createQaComplianceItems(companyId, rowId(staff[i]), i)
    allComplianceRows.push(...items)
  }
  const complianceItems    = await dbInsert('compliance_items', allComplianceRows, 'Compliance items')
  COUNTS.compliance_items  = complianceItems.length

  // ── 12. Fake notifications (QA_EMAIL_MODE) ────────────────────────────────
  if (QA_EMAIL_MODE) {
    log('\n📧 Writing fake notification logs…')
    for (const user of QA_AUTH_USERS) {
      await logFakeNotification(companyId, user.email, `[QA] Welcome to SprintScale QA — ${isoNow()}`)
    }
  }

  // ── Final summary ─────────────────────────────────────────────────────────
  log('\n╔══════════════════════════════════════════════════════╗')
  log('║    QA Environment Seeded Successfully! 🎉            ║')
  log('╚══════════════════════════════════════════════════════╝')
  log('\n📊 Summary:')
  log(`   Company:          ${QA_COMPANY_NAME}`)
  log(`   Auth users:       ${QA_AUTH_USERS.length} (admin / coordinator / care_worker)`)
  log(`   Clients:          ${COUNTS.clients}`)
  log(`   Staff profiles:   ${COUNTS.staff}`)
  log(`   Care packages:    ${COUNTS.care_packages}`)
  log(`   Shifts:           ${COUNTS.shifts}`)
  log(`   Visit notes:      ${COUNTS.visit_notes}`)
  log(`   Incidents:        ${COUNTS.incidents}`)
  log(`   Timesheets:       ${COUNTS.timesheets}`)
  log(`   Documents:        ${COUNTS.documents}`)
  log(`   Compliance items: ${COUNTS.compliance_items}`)

  log('\n🔑 Test credentials:')
  for (const u of QA_AUTH_USERS) {
    log(`   ${u.role.padEnd(16)} → ${u.email}`)
  }
  log(`   Password: ${QA_DEFAULT_PASSWORD}`)

  log('\n🔧 Useful commands:')
  log('   Seed:   npx tsx scripts/seed-qa-environment.ts')
  log('   Reset:  npx tsx scripts/reset-qa-environment.ts')
  log('   Dry run: npx tsx scripts/seed-qa-environment.ts --dry-run')
  log('   Email mode: QA_EMAIL_MODE=true npx tsx scripts/seed-qa-environment.ts\n')
}

main().catch((e) => {
  console.error('\n❌ QA Seeder crashed:', e)
  process.exit(1)
})
