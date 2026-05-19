#!/usr/bin/env tsx
/**
 * scripts/create-test-manager.ts
 *
 * Provisions a controlled test manager account for Care OS pilot access.
 *
 * Creates:
 *   - Supabase Auth user (real password login, no QA bypass)
 *   - profiles row with registered_manager role
 *   - staff_profiles row with active status
 *   - audit_logs entry for account creation
 *   - must_change_password flag so the user is prompted on first login
 *
 * Usage:
 *   npx tsx scripts/create-test-manager.ts [options]
 *
 * Options:
 *   --email      <email>     Login email (default: pilot.manager@careos.pilot)
 *   --password   <pwd>       Temp password (default: auto-generated)
 *   --first-name <name>      First name   (default: Pilot)
 *   --last-name  <name>      Last name    (default: Manager)
 *   --phone      <phone>     Phone number (optional)
 *   --role       <role>      registered_manager | company_admin | coordinator
 *                            (default: registered_manager)
 *   --dry-run                Preview without creating anything
 *
 * The script reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 * from .env.local.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({ path: '.env.local' })

import crypto         from 'crypto'
import { createClient } from '@supabase/supabase-js'

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL     ?? ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY    ?? ''
const APP_URL          = process.env.NEXT_PUBLIC_APP_URL           ?? 'https://care-os-flame.vercel.app'

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌  NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set in .env.local')
  process.exit(1)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = createClient<any>(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── CLI argument parsing ──────────────────────────────────────────────────────

function getArg(flag: string): string | null {
  const idx = process.argv.indexOf(flag)
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : null
}

const DRY_RUN   = process.argv.includes('--dry-run')
const FIRST_NAME = getArg('--first-name') ?? 'Pilot'
const LAST_NAME  = getArg('--last-name')  ?? 'Manager'
const EMAIL      = getArg('--email')      ?? 'pilot.manager@careos.pilot'
const ROLE       = getArg('--role')       ?? 'registered_manager'
const PHONE      = getArg('--phone')      ?? null

// Generate a strong temp password if not provided
const RAW_PASSWORD = getArg('--password') ?? generateTempPassword()

// ── Validation ────────────────────────────────────────────────────────────────

const VALID_ROLES = ['registered_manager', 'company_admin', 'coordinator', 'compliance_manager']

if (!VALID_ROLES.includes(ROLE)) {
  console.error(`❌  Invalid role "${ROLE}". Valid options: ${VALID_ROLES.join(', ')}`)
  process.exit(1)
}

if (RAW_PASSWORD.length < 8) {
  console.error('❌  Password must be at least 8 characters')
  process.exit(1)
}

// ── Permission summary for the chosen role ────────────────────────────────────

const ROLE_ACCESS: Record<string, string[]> = {
  registered_manager: [
    '/admin (dashboard)',
    '/admin/staff (read + write + delete)',
    '/admin/compliance (read + override)',
    '/admin/onboarding (pipeline)',
    '/admin/applicants (read + invite)',
    '/admin/incidents (read + write)',
    '/admin/visits + anomalies (read)',
    '/admin/shifts (read + write)',
    '/admin/documents (read + upload)',
    '/admin/analytics (executive view)',
    '/admin/operations (control center)',
    '/admin/audit-log (read)',
    '/admin/communications (read)',
  ],
  company_admin: [
    '/admin/* (full access except super-admin)',
    '/admin/system (read + write)',
    '/admin/staff (all operations)',
    '/admin/compliance (all operations)',
    'Role management (coordinator and below)',
  ],
  compliance_manager: [
    '/admin/applicants (read + invite)',
    '/admin/staff (read)',
    '/admin/documents (read + upload)',
    '/admin/compliance (read)',
    '/admin/notifications (read)',
    '/admin/audit-log (read)',
  ],
  coordinator: [
    '/admin/applicants (read + invite)',
    '/admin/staff (read)',
    '/admin/shifts (read + write)',
    '/admin/incidents (read + write)',
    '/admin/visits (read)',
    '/admin/compliance (read)',
  ],
}

const BLOCKED_PAGES: Record<string, string[]> = {
  registered_manager: [
    '/admin/system (super-admin only)',
    '/admin/system/tenants (super-admin only)',
    'Role management → company_admin level',
    'Settings write operations',
  ],
  company_admin: [
    '/admin/system/tenants (super-admin only)',
    'Role management → super_admin level',
  ],
  compliance_manager: [
    '/admin/shifts (no access)',
    '/admin/system (no access)',
    '/admin/settings (no access)',
  ],
  coordinator: [
    '/admin/system (no access)',
    '/admin/settings (no access)',
    '/admin/audit-log (no access)',
    'Staff write / delete operations',
  ],
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#'
  const arr   = new Uint8Array(16)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => chars[b % chars.length]).join('')
}

function box(lines: string[]): void {
  const width = Math.max(...lines.map((l) => l.length)) + 4
  const border = '─'.repeat(width)
  console.log(`┌${border}┐`)
  for (const line of lines) {
    console.log(`│  ${line.padEnd(width - 2)}│`)
  }
  console.log(`└${border}┘`)
}

// ── Main provisioning flow ────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n╔══════════════════════════════════════════════════════╗')
  console.log('║   Care OS — Test Manager Account Provisioner         ║')
  console.log('╚══════════════════════════════════════════════════════╝\n')

  if (DRY_RUN) {
    console.log('  MODE: DRY RUN — no account will be created\n')
  }

  console.log('  Account to create:')
  console.log(`    Name  : ${FIRST_NAME} ${LAST_NAME}`)
  console.log(`    Email : ${EMAIL}`)
  console.log(`    Role  : ${ROLE}`)
  if (PHONE) console.log(`    Phone : ${PHONE}`)
  console.log()

  // ── Step 0: Find the pilot company ────────────────────────────────────────

  const { data: companies, error: compErr } = await db
    .from('companies')
    .select('id, name, slug')
    .not('slug', 'ilike', '%qa%')
    .not('slug', 'ilike', '%demo%')
    .not('slug', 'ilike', '%test%')
    .order('created_at', { ascending: true })
    .limit(1)

  if (compErr || !companies || companies.length === 0) {
    console.error('❌  No non-QA company found. Create a production company first.')
    console.error('    (Or ensure the company slug does not contain "qa", "demo", or "test")')
    process.exit(1)
  }

  const company = companies[0]
  console.log(`  Target company : "${company.name}" (${company.id})\n`)

  if (DRY_RUN) {
    console.log('  [DRY RUN] Would create:')
    console.log(`    auth.users row with email="${EMAIL}"`)
    console.log(`    profiles row with role="${ROLE}", company_id="${company.id}"`)
    console.log(`    staff_profiles row with status="active", job_role="registered_manager"`)
    console.log(`    audit_logs row: account_created`)
    printLoginCard()
    process.exit(0)
  }

  // ── Step 1: Check for existing user ───────────────────────────────────────

  const { data: existingList } = await db.auth.admin.listUsers()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingUser = existingList?.users?.find((u: any) => u.email === EMAIL)

  if (existingUser) {
    console.log(`  ⚠️   Auth user with email "${EMAIL}" already exists (${existingUser.id})`)
    console.log('       Updating metadata and profile only.\n')
    await ensureProfile(existingUser.id, company.id)
    await ensureStaffProfile(existingUser.id, company.id)
    await writeAuditLog(existingUser.id, company.id, 'test_account_reprovisioned')
    printLoginCard()
    return
  }

  // ── Step 2: Create Supabase Auth user ────────────────────────────────────

  console.log('  [1/4] Creating Supabase Auth user…')

  const { data: authData, error: authErr } = await db.auth.admin.createUser({
    email:          EMAIL,
    password:       RAW_PASSWORD,
    email_confirm:  true,      // skip email confirmation — direct login enabled
    user_metadata: {
      first_name:            FIRST_NAME,
      last_name:             LAST_NAME,
      full_name:             `${FIRST_NAME} ${LAST_NAME}`,
      phone:                 PHONE,
      is_test_account:       true,
      is_pilot_account:      true,
      must_change_password:  true,  // prompt to change on first login
      account_created_by:    'create-test-manager script',
      account_created_at:    new Date().toISOString(),
    },
  })

  if (authErr || !authData?.user) {
    console.error(`❌  Failed to create auth user: ${authErr?.message ?? 'unknown error'}`)
    process.exit(1)
  }

  const userId = authData.user.id
  console.log(`     Auth user created: ${userId}`)

  // ── Step 3: Create profiles row ───────────────────────────────────────────

  console.log('  [2/4] Creating admin profile…')
  await ensureProfile(userId, company.id)

  // ── Step 4: Create staff_profiles row ─────────────────────────────────────

  console.log('  [3/4] Creating staff profile…')
  await ensureStaffProfile(userId, company.id)

  // ── Step 5: Write audit log ───────────────────────────────────────────────

  console.log('  [4/4] Writing audit log entry…')
  await writeAuditLog(userId, company.id, 'test_manager_account_created')

  console.log('\n  ✅  Account provisioned successfully.\n')
  printLoginCard()
}

// ── Profile helpers ───────────────────────────────────────────────────────────

async function ensureProfile(userId: string, companyId: string): Promise<void> {
  const { error } = await db
    .from('profiles')
    .upsert(
      {
        id:          userId,
        company_id:  companyId,
        role:        ROLE,
        first_name:  FIRST_NAME,
        last_name:   LAST_NAME,
        email:       EMAIL,
      },
      { onConflict: 'id' },
    )

  if (error) {
    console.error(`   ⚠️  profiles upsert warning: ${error.message}`)
  } else {
    console.log(`     Profile: ${ROLE} in company ${companyId}`)
  }
}

async function ensureStaffProfile(userId: string, companyId: string): Promise<void> {
  // Check if a staff profile already linked to this user_id exists
  const { data: existing } = await db
    .from('staff_profiles')
    .select('id')
    .eq('company_id', companyId)
    .eq('profile_id', userId)
    .maybeSingle()

  if (existing) {
    console.log(`     Staff profile already exists: ${existing.id}`)
    return
  }

  const { data, error } = await db
    .from('staff_profiles')
    .insert({
      company_id:       companyId,
      profile_id:       userId,
      first_name:       FIRST_NAME,
      last_name:        LAST_NAME,
      email:            EMAIL,
      phone:            PHONE,
      job_role:         'registered_manager',
      status:           'active',
      onboarding_completed: true,
      dbs_checked:      false,
      right_to_work_checked: false,
      // Mark clearly as test/pilot account
      compliance_state: 'warning',
    })
    .select('id')
    .maybeSingle()

  if (error) {
    // Non-fatal — staff profile is secondary
    console.log(`     ⚠️  staff_profiles insert warning: ${error.message}`)
  } else {
    console.log(`     Staff profile: ${data?.id}`)
  }
}

async function writeAuditLog(
  userId: string,
  companyId: string,
  eventType: string,
): Promise<void> {
  const { error } = await db
    .from('audit_logs')
    .insert({
      company_id:  companyId,
      event_type:  eventType,
      actor_id:    userId,
      actor_email: EMAIL,
      target_type: 'profile',
      target_id:   userId,
      metadata: {
        role:                ROLE,
        name:                `${FIRST_NAME} ${LAST_NAME}`,
        is_test_account:     true,
        is_pilot_account:    true,
        provisioned_by:      'create-test-manager script',
        provisioned_at:      new Date().toISOString(),
      },
    })

  if (error) {
    console.log(`     ⚠️  audit_logs insert warning: ${error.message}`)
  } else {
    console.log(`     Audit log entry written: ${eventType}`)
  }
}

// ── Login card output ─────────────────────────────────────────────────────────

function printLoginCard(): void {
  const loginUrl = `${APP_URL}/admin/login`
  const accessible = ROLE_ACCESS[ROLE] ?? []
  const blocked    = BLOCKED_PAGES[ROLE] ?? []

  console.log('\n')
  box([
    '  CARE OS — TEST MANAGER LOGIN DETAILS  ',
    '',
    `  Login URL   : ${loginUrl}`,
    `  Email       : ${EMAIL}`,
    `  Password    : ${RAW_PASSWORD}`,
    `  Role        : ${ROLE}`,
    `  Status      : active (pilot account)`,
    '',
    '  ⚠  Change this password after first login.',
    '     Go to /admin/set-password once logged in.',
  ])

  console.log('\n  PAGES THIS ACCOUNT CAN ACCESS:')
  for (const page of accessible) {
    console.log(`    ✅  ${page}`)
  }

  console.log('\n  PAGES THIS ACCOUNT CANNOT ACCESS:')
  for (const page of blocked) {
    console.log(`    🚫  ${page}`)
  }

  console.log('\n  FIRST-LOGIN CHECKLIST:')
  const loginUrl2 = loginUrl
  console.log(`    1. Go to ${loginUrl2}`)
  console.log(`    2. Enter email: ${EMAIL}`)
  console.log(`    3. Enter password: ${RAW_PASSWORD}`)
  console.log('    4. Dashboard should load — note the "Pilot mode" banner')
  console.log('    5. Click the yellow "Change password" banner (if shown)')
  console.log('    6. Or navigate to /admin/set-password to set a new password')
  console.log('    7. Verify: /admin/staff — should list staff')
  console.log('    8. Verify: /admin/compliance — should load compliance dashboard')
  console.log('    9. Verify: /admin/operations — should show operations queue')
  console.log('   10. Verify: /admin/system → should be denied (registered_manager has no system access)')
  console.log()
}

// ── Entry point ───────────────────────────────────────────────────────────────

main().catch((err: unknown) => {
  console.error('\n❌  Script crashed:', err)
  process.exit(1)
})
