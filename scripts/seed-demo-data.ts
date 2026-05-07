/**
 * scripts/seed-demo-data.ts
 *
 * Generates scoped demo data for QA and pre-launch testing.
 * All records are prefixed with "[DEMO]" for easy identification/cleanup.
 *
 * Usage:
 *   npx tsx scripts/seed-demo-data.ts              # Seed demo data
 *   npx tsx scripts/seed-demo-data.ts --dry-run    # Print without inserting
 *   npx tsx scripts/seed-demo-data.ts --clean      # Delete DEMO records
 *
 * Requirements (already in devDependencies):
 *   @supabase/supabase-js, tsx
 *   If dotenv is not installed: npm install -D dotenv
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = createClient<any>(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const DEMO_TAG = '[DEMO]'
const args     = process.argv.slice(2)
const DRY_RUN  = args.includes('--dry-run')
const CLEAN    = args.includes('--clean')

function log(msg: string)  { console.log(msg) }
function ok(msg: string)   { console.log(`  ✓ ${msg}`) }
function fail(msg: string) { console.error(`  ✗ ${msg}`) }

function daysFromNow(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function isoNow(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString()
}

type Row = Record<string, unknown>

async function dbInsert(table: string, rows: Row[], label: string): Promise<Row[]> {
  if (DRY_RUN) {
    log(`  [dry-run] Would insert ${rows.length} row(s) into ${table}`)
    return rows
  }

  const { data, error } = await db.from(table).insert(rows).select()

  if (error) {
    fail(`Insert into ${table} failed: ${error.message}`)
    return []
  }

  ok(`${label}: ${(data as Row[]).length} row(s) created`)
  return (data as Row[])
}

function id(row: Row): string {
  return row.id as string
}

// ── Clean demo data ───────────────────────────────────────────────────────────

async function cleanDemo(companyId: string) {
  log('\n🧹 Cleaning demo data…')

  // Ordered to respect FK constraints
  const deletions: Array<{ table: string; col: string; val: string; like?: boolean }> = [
    { table: 'incidents',      col: 'description', val: DEMO_TAG },
    { table: 'shifts',         col: 'title',       val: `${DEMO_TAG}%`, like: true },
    { table: 'care_packages',  col: 'title',       val: `${DEMO_TAG}%`, like: true },
    { table: 'clients',        col: 'first_name',  val: DEMO_TAG },
    { table: 'staff_profiles', col: 'first_name',  val: DEMO_TAG },
  ]

  for (const { table, col, val, like } of deletions) {
    const q = like
      ? db.from(table).delete().like(col, val).eq('company_id', companyId)
      : db.from(table).delete().eq(col, val).eq('company_id', companyId)
    const { error } = await q
    if (error) fail(`Clean ${table}: ${error.message}`)
    else ok(`Cleaned ${table}`)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  log('\n🌱 Care OS Demo Data Seeder')
  log('=============================')

  const { data: company, error: companyErr } = await db
    .from('companies')
    .select('id, name')
    .limit(1)
    .maybeSingle()

  if (companyErr || !company) {
    fail(`Could not resolve company: ${companyErr?.message ?? 'no companies found'}`)
    process.exit(1)
  }

  const companyId = company.id as string
  log(`\n📋 Target company: ${company.name} (${companyId})`)

  if (CLEAN) {
    await cleanDemo(companyId)
    log('\n✅ Demo data cleaned.\n')
    return
  }

  if (DRY_RUN) log('\n⚠  DRY RUN — no data will be written\n')

  // ── 1. Clients ────────────────────────────────────────────────────────────

  log('\n👥 Creating demo clients…')

  const clients = await dbInsert('clients', [
    { company_id: companyId, first_name: DEMO_TAG, last_name: 'Alice Thornton',  status: 'active',      risk_level: 'standard', funding_type: 'local_authority', care_start_date: daysFromNow(-90) },
    { company_id: companyId, first_name: DEMO_TAG, last_name: 'Bob Marchetti',   status: 'active',      risk_level: 'high',     funding_type: 'nhs',             care_start_date: daysFromNow(-60) },
    { company_id: companyId, first_name: DEMO_TAG, last_name: 'Carol Osei',      status: 'prospective', risk_level: 'low',      funding_type: 'private',         care_start_date: null },
    { company_id: companyId, first_name: DEMO_TAG, last_name: 'David Park',      status: 'paused',      risk_level: 'critical', funding_type: 'direct_payment',  care_start_date: daysFromNow(-30) },
  ], 'Clients')

  // ── 2. Staff profiles ─────────────────────────────────────────────────────

  log('\n👤 Creating demo staff profiles…')

  const staff = await dbInsert('staff_profiles', [
    { company_id: companyId, first_name: DEMO_TAG, last_name: 'Emma Wells',   email: 'demo.emma@care-os.test',  status: 'active',         job_role: 'Care Worker'   },
    { company_id: companyId, first_name: DEMO_TAG, last_name: 'James Okafor', email: 'demo.james@care-os.test', status: 'active',         job_role: 'Senior Carer'  },
    { company_id: companyId, first_name: DEMO_TAG, last_name: 'Sara Patel',   email: 'demo.sara@care-os.test',  status: 'pre_employment', job_role: 'Care Worker'   },
  ], 'Staff profiles')

  // ── 3. Care packages ──────────────────────────────────────────────────────

  log('\n📦 Creating demo care packages…')

  const pkgRows: Row[] = clients.slice(0, 2).map((c, i) => ({
    company_id:   companyId,
    client_id:    id(c),
    title:        `${DEMO_TAG} Package ${i + 1}`,
    status:       'active',
    start_date:   daysFromNow(-60 + i * 10),
    weekly_hours: i === 0 ? 14 : 21,
    funding_type: i === 0 ? 'local_authority' : 'nhs',
  }))

  const packages = await dbInsert('care_packages', pkgRows, 'Care packages')

  // ── 4. Shifts ─────────────────────────────────────────────────────────────

  log('\n📅 Creating demo shifts…')

  const shiftTitles = ['Morning', 'Afternoon', 'Evening', 'Night', 'Sleep-in', 'Day']
  const startTimes  = ['08:00', '13:00', '18:00', '22:00', '22:00', '09:00']
  const endTimes    = ['12:00', '17:00', '22:00', '07:00', '07:00', '17:00']
  const shiftTypes  = ['day',   'day',   'day',   'night', 'sleep_in', 'day']
  const statuses    = ['completed', 'completed', 'confirmed', 'scheduled', 'scheduled', 'scheduled']

  const shiftRows: Row[] = Array.from({ length: 6 }).map((_, i) => ({
    company_id:        companyId,
    client_id:         clients.length > 0 ? id(clients[i % clients.length]) : null,
    care_package_id:   packages.length > 0 ? id(packages[i % packages.length]) : null,
    assigned_staff_id: i < staff.length ? id(staff[i]) : null,
    title:             `${DEMO_TAG} ${shiftTitles[i]} visit`,
    shift_date:        daysFromNow(i - 2),
    start_time:        startTimes[i],
    end_time:          endTimes[i],
    status:            statuses[i],
    shift_type:        shiftTypes[i],
    location:          '123 Demo Street, London',
  }))

  const shifts = await dbInsert('shifts', shiftRows, 'Shifts')

  // ── 5. Incidents ──────────────────────────────────────────────────────────

  log('\n🚨 Creating demo incidents…')

  await dbInsert('incidents', [
    {
      company_id:             companyId,
      client_id:              clients[0] ? id(clients[0]) : null,
      staff_profile_id:       staff[0]   ? id(staff[0])   : null,
      shift_id:               shifts[0]  ? id(shifts[0])  : null,
      incident_type:          'fall',
      severity:               'medium',
      status:                 'open',
      occurred_at:            isoNow(-3),
      description:            DEMO_TAG,
      immediate_action_taken: 'Called GP. No injury confirmed.',
      escalation_required:    false,
      follow_up_required:     true,
      follow_up_notes:        'Schedule 48h check-in call.',
    },
    {
      company_id:             companyId,
      client_id:              clients[1] ? id(clients[1]) : null,
      staff_profile_id:       staff[1]   ? id(staff[1])   : null,
      shift_id:               shifts[1]  ? id(shifts[1])  : null,
      incident_type:          'medication_error',
      severity:               'high',
      status:                 'investigating',
      occurred_at:            isoNow(-1),
      description:            DEMO_TAG,
      immediate_action_taken: 'Notified medication team. Dose withheld.',
      escalation_required:    true,
      escalated_to:           'Registered Manager',
      follow_up_required:     true,
      follow_up_notes:        'Review medication chart.',
    },
    {
      company_id:             companyId,
      client_id:              clients[0] ? id(clients[0]) : null,
      incident_type:          'complaint',
      severity:               'low',
      status:                 'resolved',
      occurred_at:            isoNow(-10),
      description:            DEMO_TAG,
      immediate_action_taken: 'Spoke with client family.',
      escalation_required:    false,
      follow_up_required:     false,
      resolved_at:            isoNow(-7),
      resolution_notes:       'Issue resolved to family satisfaction.',
    },
  ], 'Incidents')

  log('\n✅ Demo data seeded successfully.')
  log('   • All records tagged with "[DEMO]" for easy identification.')
  log(`   • To clean:   npx tsx scripts/seed-demo-data.ts --clean`)
  log(`   • To preview: npx tsx scripts/seed-demo-data.ts --dry-run\n`)
}

main().catch((e) => {
  console.error('\n❌ Seeder crashed:', e)
  process.exit(1)
})
