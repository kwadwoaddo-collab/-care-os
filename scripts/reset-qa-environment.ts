/**
 * scripts/reset-qa-environment.ts
 *
 * Deletes ALL data that belongs to the SprintScale QA company.
 *
 * Safety guarantees:
 *   - Only deletes rows where company_id = SprintScale QA's company ID
 *   - Never touches any other company
 *   - Asks for confirmation before deleting (unless --force is passed)
 *   - Supports --dry-run to preview what would be deleted
 *
 * Usage:
 *   npx tsx scripts/reset-qa-environment.ts             # Interactive confirm
 *   npx tsx scripts/reset-qa-environment.ts --force     # Skip confirmation
 *   npx tsx scripts/reset-qa-environment.ts --dry-run   # Preview only
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import * as readline from 'readline'
import { QA_COMPANY_SLUG, QA_COMPANY_NAME } from './qa-helpers'

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

const args    = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const FORCE   = args.includes('--force')

function log(msg: string)  { console.log(msg) }
function ok(msg: string)   { console.log(`  ✓ ${msg}`) }
function fail(msg: string) { console.error(`  ✗ ${msg}`) }
function info(msg: string) { console.log(`  ℹ  ${msg}`) }

// ── Confirmation prompt ───────────────────────────────────────────────────────

async function confirm(): Promise<boolean> {
  if (FORCE) return true

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

  return new Promise((resolve) => {
    rl.question(
      `\n⚠️  This will delete ALL data in "${QA_COMPANY_NAME}".\n   Type YES to confirm: `,
      (answer) => {
        rl.close()
        resolve(answer.trim() === 'YES')
      }
    )
  })
}

// ── Delete table rows scoped to company ───────────────────────────────────────

async function deleteScoped(table: string, companyIdCol = 'company_id', companyId: string): Promise<void> {
  if (DRY_RUN) {
    info(`Would delete from ${table} where ${companyIdCol} = ${companyId}`)
    return
  }

  const { error, count } = await db
    .from(table)
    .delete({ count: 'exact' })
    .eq(companyIdCol, companyId)

  if (error) {
    fail(`Delete from ${table}: ${error.message}`)
  } else {
    ok(`Deleted ${count ?? '?'} row(s) from ${table}`)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  log('\n╔══════════════════════════════════════════════════════╗')
  log('║    Care OS — QA Environment Reset                   ║')
  log('╚══════════════════════════════════════════════════════╝')

  if (DRY_RUN) log('\n⚠  DRY RUN — no data will be deleted\n')

  // ── 1. Resolve the QA company ──────────────────────────────────────────────
  const { data: company, error: companyErr } = await db
    .from('companies')
    .select('id, name')
    .eq('slug', QA_COMPANY_SLUG)
    .maybeSingle()

  if (companyErr || !company) {
    fail(`SprintScale QA company not found: ${companyErr?.message ?? 'no match'}`)
    log('  Nothing to reset.')
    process.exit(0)
  }

  const companyId = company.id as string
  log(`\n📋 Target company: ${company.name} (${companyId})`)

  // ── 2. Confirm ─────────────────────────────────────────────────────────────
  const confirmed = await confirm()
  if (!confirmed) {
    log('\n❌ Reset cancelled.\n')
    process.exit(0)
  }

  log('\n🧹 Deleting QA data…')

  // Order matters — respect FK constraints (children before parents)
  await deleteScoped('notification_logs', 'company_id', companyId)
  await deleteScoped('form_answers',      'company_id', companyId) // via form_responses
  await deleteScoped('form_responses',    'company_id', companyId)
  await deleteScoped('timesheets',        'company_id', companyId)
  await deleteScoped('visit_notes',       'company_id', companyId)
  await deleteScoped('incidents',         'company_id', companyId)
  await deleteScoped('shifts',            'company_id', companyId)
  await deleteScoped('care_packages',     'company_id', companyId)
  await deleteScoped('clients',           'company_id', companyId)
  await deleteScoped('documents',         'company_id', companyId)
  await deleteScoped('compliance_items',  'company_id', companyId)
  await deleteScoped('compliance_items',  'company_id', companyId)
  await deleteScoped('audit_logs',        'company_id', companyId)
  await deleteScoped('staff_profiles',    'company_id', companyId)
  await deleteScoped('applicants',        'company_id', companyId)

  // Delete auth users linked to QA profiles
  log('\n🔑 Removing QA auth users…')

  if (!DRY_RUN) {
    const QA_EMAILS = [
      'qa-admin@sprintscaleit.co.uk',
      'qa-coordinator@sprintscaleit.co.uk',
      'qa-worker@sprintscaleit.co.uk',
    ]

    for (const email of QA_EMAILS) {
      const { data: profileData } = await db
        .from('profiles')
        .select('id')
        .eq('email', email)
        .eq('company_id', companyId)
        .maybeSingle()

      if (profileData?.id) {
        const { error: delAuthErr } = await db.auth.admin.deleteUser(profileData.id as string)
        if (delAuthErr) fail(`Delete auth user ${email}: ${delAuthErr.message}`)
        else ok(`Deleted auth user: ${email}`)
      } else {
        info(`Auth user not found: ${email}`)
      }
    }
  } else {
    info('[dry-run] Would delete 3 QA auth users')
  }

  // Delete profiles (after auth users)
  await deleteScoped('profiles', 'company_id', companyId)

  // Optionally delete the company itself
  if (!DRY_RUN) {
    const { error: delCompErr } = await db
      .from('companies')
      .delete()
      .eq('id', companyId)

    if (delCompErr) fail(`Could not delete company: ${delCompErr.message}`)
    else ok(`Deleted company: ${QA_COMPANY_NAME}`)
  } else {
    info('[dry-run] Would delete company: SprintScale QA')
  }

  log('\n╔══════════════════════════════════════════════════════╗')
  log('║    QA Environment Reset Complete ✓                  ║')
  log('╚══════════════════════════════════════════════════════╝')
  log('\n💡 Re-seed with: npx tsx scripts/seed-qa-environment.ts\n')
}

main().catch((e) => {
  console.error('\n❌ Reset script crashed:', e)
  process.exit(1)
})
