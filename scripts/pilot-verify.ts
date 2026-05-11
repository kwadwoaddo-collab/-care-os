#!/usr/bin/env tsx
/**
 * scripts/pilot-verify.ts
 *
 * Pilot Verification Script — Care OS
 *
 * Runs a pre-flight checklist to confirm the system is ready for real staff onboarding.
 * This is a manual-assist script: it checks what it can automatically and prompts
 * the operator to confirm the rest.
 *
 * Usage:
 *   npx tsx scripts/pilot-verify.ts
 *
 * Environment:
 *   NEXT_PUBLIC_SUPABASE_URL    — Supabase project URL (read from .env.local)
 *   SUPABASE_SERVICE_ROLE_KEY   — Service role key
 *
 * All checks write to stdout. Exit code 0 = passed, 1 = blockers found.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APP_URL          = process.env.NEXT_PUBLIC_APP_URL ?? ''
const RESEND_KEY       = process.env.RESEND_API_KEY ?? ''
const FROM_EMAIL       = process.env.INVITE_FROM_EMAIL ?? ''
const QA_BYPASS        = process.env.QA_BYPASS_AUTH
const QA_EMAIL         = process.env.QA_EMAIL_MODE

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('\n❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = createClient<any>(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Logging ───────────────────────────────────────────────────────────────────

let blockers = 0
let warnings = 0

function pass(msg: string)  { console.log(`  ✅  ${msg}`) }
function fail(msg: string)  { console.log(`  ❌  ${msg}`); blockers++ }
function warn(msg: string)  { console.log(`  ⚠️   ${msg}`); warnings++ }
function info(msg: string)  { console.log(`  ℹ️   ${msg}`) }
function head(msg: string)  { console.log(`\n${msg}`) }
function skip(msg: string)  { console.log(`  ⏭️   ${msg} (manual check required)`) }

// ── Check 1: Environment Variables ───────────────────────────────────────────

async function checkEnvVars(): Promise<void> {
  head('━━━ 1. Environment Variables')

  SUPABASE_URL
    ? pass(`NEXT_PUBLIC_SUPABASE_URL is set (${SUPABASE_URL.split('.')[0].replace('https://', '')}.supabase.co)`)
    : fail('NEXT_PUBLIC_SUPABASE_URL is not set')

  SERVICE_ROLE_KEY
    ? pass('SUPABASE_SERVICE_ROLE_KEY is set')
    : fail('SUPABASE_SERVICE_ROLE_KEY is not set')

  APP_URL
    ? pass(`NEXT_PUBLIC_APP_URL = ${APP_URL}`)
    : fail('NEXT_PUBLIC_APP_URL is not set')

  RESEND_KEY
    ? pass('RESEND_API_KEY is set')
    : fail('RESEND_API_KEY is not set')

  FROM_EMAIL
    ? pass(`INVITE_FROM_EMAIL = ${FROM_EMAIL}`)
    : fail('INVITE_FROM_EMAIL is not set')

  if (QA_BYPASS) {
    fail('QA_BYPASS_AUTH is set — this disables authentication. Remove it from production env vars.')
  } else {
    pass('QA_BYPASS_AUTH is not set (correct for production)')
  }

  if (QA_EMAIL) {
    warn('QA_EMAIL_MODE is set — emails will be suppressed. Remove this for production if real emails are needed.')
  } else {
    pass('QA_EMAIL_MODE is not set (correct for production)')
  }

  // Detect if pointing at localhost / local db accidentally
  if (SUPABASE_URL.includes('localhost') || SUPABASE_URL.includes('127.0.0.1')) {
    fail('NEXT_PUBLIC_SUPABASE_URL points to localhost — use the production Supabase URL')
  }

  if (APP_URL.includes('localhost') || APP_URL.includes('127.0.0.1')) {
    warn('NEXT_PUBLIC_APP_URL points to localhost — onboarding invite links will not work for real staff')
  }
}

// ── Check 2: Database Tables ──────────────────────────────────────────────────

async function checkDatabase(): Promise<void> {
  head('━━━ 2. Database — Required Tables')

  const requiredTables = [
    'companies', 'profiles', 'applicants', 'staff_profiles',
    'documents', 'compliance_items', 'notification_logs',
    'form_fields', 'form_responses', 'form_answers',
    'audit_logs',
  ]

  const { data, error } = await db.rpc('pg_tables_list').catch(() => ({ data: null, error: { message: 'rpc unavailable' } }))

  if (error) {
    // Fallback: try querying each table directly
    for (const table of requiredTables) {
      const { error: tableErr } = await db.from(table).select('id').limit(0)
      if (tableErr && tableErr.code !== 'PGRST116') {
        fail(`Table "${table}" is missing or inaccessible: ${tableErr.message}`)
      } else {
        pass(`Table "${table}" exists`)
      }
    }
  } else {
    info(`Tables accessible via RPC. ${(data ?? []).length} tables found.`)
  }
}

// ── Check 3: QA Data Pollution ────────────────────────────────────────────────

async function checkQaPollution(): Promise<void> {
  head('━━━ 3. QA Data Isolation')

  // Check for QA company
  const { data: qaCompany } = await db
    .from('companies')
    .select('id, name, slug')
    .or('slug.ilike.%qa%,name.ilike.%sprintscale qa%')
    .limit(5)

  if (qaCompany && qaCompany.length > 0) {
    warn(`Found ${qaCompany.length} company row(s) with QA in name/slug. If this is production, remove them:`)
    for (const c of qaCompany) {
      warn(`  → Company: "${c.name}" (slug: ${c.slug}, id: ${c.id})`)
    }
  } else {
    pass('No QA company detected in database')
  }

  // Check for [QA] prefixed staff
  const { count: qaStaff } = await db
    .from('staff_profiles')
    .select('id', { count: 'exact', head: true })
    .ilike('first_name', '[QA]%')

  if ((qaStaff ?? 0) > 0) {
    warn(`Found ${qaStaff} staff profile(s) prefixed with [QA]. Run QA_DATA_GUIDANCE cleanup SQL if unintended.`)
  } else {
    pass('No [QA]-prefixed staff profiles found')
  }

  // Check for QA emails
  const { count: qaEmails } = await db
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .ilike('email', '%sprintscaleit%')

  if ((qaEmails ?? 0) > 0) {
    warn(`Found ${qaEmails} profile(s) with @sprintscaleit email addresses`)
  } else {
    pass('No QA email addresses in profiles table')
  }
}

// ── Check 4: Admin Account ────────────────────────────────────────────────────

async function checkAdminAccount(): Promise<void> {
  head('━━━ 4. Admin Account')

  const { data: admins, error } = await db
    .from('profiles')
    .select('id, email, role, company_id')
    .in('role', ['company_admin', 'admin', 'super_admin'])
    .limit(10)

  if (error) {
    fail(`Could not query profiles: ${error.message}`)
    return
  }

  if (!admins || admins.length === 0) {
    fail('No admin profiles found — at least one company_admin is required')
    return
  }

  pass(`Found ${admins.length} admin account(s):`)
  for (const a of admins) {
    info(`  → ${a.email} (role: ${a.role})`)
  }

  // Check a company exists
  const { data: companies } = await db
    .from('companies')
    .select('id, name, slug')
    .not('slug', 'ilike', '%qa%')
    .limit(5)

  if (!companies || companies.length === 0) {
    fail('No non-QA company found — create a production company before onboarding')
  } else {
    pass(`Production company: "${companies[0].name}" (${companies[0].slug})`)
  }
}

// ── Check 5: Document Storage ─────────────────────────────────────────────────

async function checkStorage(): Promise<void> {
  head('━━━ 5. Document Storage')

  const { data: buckets, error } = await db.storage.listBuckets()

  if (error) {
    fail(`Could not list storage buckets: ${error.message}`)
    return
  }

  const careOsBucket = (buckets ?? []).find((b: { name: string }) => b.name === 'care-os-documents')

  if (!careOsBucket) {
    fail('Storage bucket "care-os-documents" not found — create it in Supabase → Storage')
  } else {
    pass('Storage bucket "care-os-documents" exists')
    skip('Confirm bucket is set to PRIVATE in Supabase → Storage → care-os-documents → Settings')
  }
}

// ── Check 6: Resend Email Config ──────────────────────────────────────────────

async function checkEmailConfig(): Promise<void> {
  head('━━━ 6. Email Configuration')

  if (FROM_EMAIL) {
    // Check if using resend.dev (only acceptable for early pilot, not production)
    if (FROM_EMAIL.includes('resend.dev')) {
      warn(`INVITE_FROM_EMAIL uses resend.dev (${FROM_EMAIL}). For production, verify your own domain in Resend.`)
      warn('Staff invite emails may have reduced deliverability with resend.dev')
    } else {
      pass(`INVITE_FROM_EMAIL domain: ${FROM_EMAIL.match(/@([^>]+)>?/)?.[1] ?? FROM_EMAIL}`)
      skip('Confirm this domain has SPF + DKIM records verified in Resend dashboard')
    }
  }

  // Check recent notification logs for failures
  const { data: recentLogs, error } = await db
    .from('notification_logs')
    .select('status, error_message, created_at')
    .eq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) {
    warn(`Could not check notification_logs: ${error.message}`)
  } else if (recentLogs && recentLogs.length > 0) {
    warn(`${recentLogs.length} recent failed email notification(s) — check notification_logs table`)
    for (const log of recentLogs) {
      warn(`  → ${log.created_at}: ${log.error_message ?? 'no error details'}`)
    }
  } else {
    pass('No recent failed notification logs')
  }
}

// ── Check 7: Pilot Workflow — Manual Steps ────────────────────────────────────

function printManualChecklist(): void {
  head('━━━ 7. Pilot Workflow — Manual Verification Checklist')
  console.log('')
  console.log('  Complete these manually in the browser before onboarding real staff:')
  console.log('')
  console.log('  [ ] INVITE TEST APPLICANT')
  console.log('      → Go to /admin/applicants → + Invite applicant')
  console.log('      → Use a personal email you can check')
  console.log('      → Confirm invite email is received')
  console.log('')
  console.log('  [ ] COMPLETE PORTAL ONBOARDING')
  console.log('      → Click the magic link in the invite email')
  console.log('      → Fill in all onboarding forms')
  console.log('      → Upload a test document (e.g. a blank PDF or image)')
  console.log('      → Submit the onboarding form')
  console.log('')
  console.log('  [ ] APPROVE / REJECT DOCUMENT')
  console.log('      → Go to /admin/onboarding → click the test applicant')
  console.log('      → Open the Documents section')
  console.log('      → Approve or reject the uploaded document')
  console.log('      → Confirm status updates to Approved/Rejected')
  console.log('')
  console.log('  [ ] SEND REMINDER')
  console.log('      → In /admin/onboarding, find a worker with incomplete status')
  console.log('      → Click the 📧 Remind button')
  console.log('      → Confirm the button shows "✓ Sent"')
  console.log('      → Confirm the email is received')
  console.log('')
  console.log('  [ ] ACTIVATION BLOCKER CHECK')
  console.log('      → Go to the test staff profile → Activation section')
  console.log('      → Confirm the checklist shows which items are still blocking')
  console.log('      → Attempt to activate with missing items — confirm it is blocked')
  console.log('')
  console.log('  [ ] ACTIVATE ONLY WHEN COMPLIANT')
  console.log('      → Resolve all blocking items (upload + approve all required docs)')
  console.log('      → Confirm activation checklist shows all items green')
  console.log('      → Click Activate — confirm status changes to "Active"')
  console.log('      → Confirm worker moves from Onboarding queue to Staff list')
  console.log('')
  console.log('  [ ] MOBILE ACCESS CHECK')
  console.log('      → Open the portal link on a real mobile device (iPhone or Android)')
  console.log('      → Confirm forms are readable and usable without zooming')
  console.log('      → Confirm document upload works from the camera roll')
  console.log('')
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n╔══════════════════════════════════════════════════════╗')
  console.log('║    Care OS — Pilot Verification Script              ║')
  console.log('╚══════════════════════════════════════════════════════╝')
  console.log('\nRunning automated checks…')

  await checkEnvVars()
  await checkDatabase()
  await checkQaPollution()
  await checkAdminAccount()
  await checkStorage()
  await checkEmailConfig()

  printManualChecklist()

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════╗')
  console.log('║    Summary                                          ║')
  console.log('╚══════════════════════════════════════════════════════╝')

  if (blockers === 0 && warnings === 0) {
    console.log('\n  ✅  All automated checks passed. Complete the manual checklist above.')
    console.log('  ✅  The system appears ready for pilot onboarding.\n')
  } else if (blockers === 0) {
    console.log(`\n  ✅  No blockers found (${warnings} warning(s)).`)
    console.log('  ⚠️   Review warnings before onboarding real staff.')
    console.log('  Complete the manual checklist above.\n')
  } else {
    console.log(`\n  ❌  ${blockers} blocker(s) found — resolve before onboarding real staff.`)
    if (warnings > 0) console.log(`  ⚠️   ${warnings} warning(s) also require attention.`)
    console.log('')
  }

  console.log('  📖  See docs/PILOT_READINESS_CHECKLIST.md for the full checklist.')
  console.log('  📖  See docs/ADMIN_PILOT_GUIDE.md for admin usage instructions.')
  console.log('  📖  See docs/QA_DATA_GUIDANCE.md for test data identification.\n')

  process.exit(blockers > 0 ? 1 : 0)
}

main().catch((e: unknown) => {
  console.error('\n❌ Pilot verify script crashed:', e)
  process.exit(1)
})
