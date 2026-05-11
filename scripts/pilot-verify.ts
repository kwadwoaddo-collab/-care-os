#!/usr/bin/env tsx
/**
 * scripts/pilot-verify.ts
 *
 * Pilot Verification Script — Care OS
 *
 * Runs a pre-flight checklist to confirm the system is ready for real staff
 * onboarding. Supports two modes:
 *
 *   LOCAL MODE (default) — `npm run pilot:verify`
 *     Reads .env.local. Warns but does not fail on localhost URLs, QA_BYPASS_AUTH,
 *     or resend.dev email. Useful for developers checking the DB state locally.
 *
 *   PRODUCTION MODE — `npm run pilot:verify:production`
 *     Reads .env.local (or CI env). Hard-fails if any production-unsafe config is
 *     detected. Must pass cleanly before onboarding real staff.
 *
 * Exit code 0 = no blockers. Exit code 1 = one or more blockers found.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FIX NOTE: The previous version called .catch() on a Supabase query builder
 * (db.rpc(...).catch(...)). The Supabase JS v2 query builder is not a native
 * Promise — it has a .then()/.catch() thennable interface but only resolves
 * when awaited. Chaining .catch() directly on the builder object is not
 * supported and throws "is not a function". All DB calls must use try/catch
 * around an awaited expression instead.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

// ── Mode ──────────────────────────────────────────────────────────────────────

const IS_PRODUCTION_MODE = process.argv.includes('--production')

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL     ?? ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY    ?? ''
const APP_URL          = process.env.NEXT_PUBLIC_APP_URL           ?? ''
const RESEND_KEY       = process.env.RESEND_API_KEY                ?? ''
const FROM_EMAIL       = process.env.INVITE_FROM_EMAIL             ?? ''
const QA_BYPASS        = process.env.QA_BYPASS_AUTH                ?? ''
const QA_EMAIL_MODE    = process.env.QA_EMAIL_MODE                 ?? ''

// ── Counters ──────────────────────────────────────────────────────────────────

let blockers = 0
let warnings = 0

// ── Logging helpers ───────────────────────────────────────────────────────────

function pass(msg: string)  { console.log(`  ✅  ${msg}`) }
function fail(msg: string)  { console.log(`  ❌  ${msg}`); blockers++ }
function warn(msg: string)  { console.log(`  ⚠️   ${msg}`); warnings++ }
function info(msg: string)  { console.log(`  ℹ️   ${msg}`) }
function head(msg: string)  { console.log(`\n${msg}`) }
function skip(msg: string)  { console.log(`  ⏭️   ${msg} (manual check required)`) }

/**
 * In production mode: treat this as a hard blocker (fail).
 * In local mode:      treat this as a warning only.
 */
function failOrWarn(msg: string): void {
  if (IS_PRODUCTION_MODE) {
    fail(msg)
  } else {
    warn(msg)
  }
}

// ── Supabase client (created only if credentials are available) ───────────────

function makeDb() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient<any>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ── Check 1: Environment Variables ───────────────────────────────────────────

function checkEnvVars(): void {
  head(`━━━ 1. Environment Variables  [mode: ${IS_PRODUCTION_MODE ? 'PRODUCTION' : 'local'}]`)

  // ── Supabase URL ────────────────────────────────────────────────────────────
  if (!SUPABASE_URL) {
    fail('NEXT_PUBLIC_SUPABASE_URL is not set')
  } else if (SUPABASE_URL.includes('localhost') || SUPABASE_URL.includes('127.0.0.1')) {
    fail('NEXT_PUBLIC_SUPABASE_URL points to localhost — use the production Supabase URL')
  } else {
    const project = SUPABASE_URL.replace('https://', '').split('.')[0]
    pass(`NEXT_PUBLIC_SUPABASE_URL → ${project}.supabase.co`)
  }

  // ── Service role key ────────────────────────────────────────────────────────
  SERVICE_ROLE_KEY
    ? pass('SUPABASE_SERVICE_ROLE_KEY is set')
    : fail('SUPABASE_SERVICE_ROLE_KEY is not set')

  // ── App URL ─────────────────────────────────────────────────────────────────
  if (!APP_URL) {
    fail('NEXT_PUBLIC_APP_URL is not set')
  } else if (APP_URL.includes('localhost') || APP_URL.includes('127.0.0.1')) {
    failOrWarn(
      `NEXT_PUBLIC_APP_URL = ${APP_URL} (localhost)` +
      (IS_PRODUCTION_MODE
        ? ' — onboarding invite links will not work for real staff. Set to the production URL in Vercel.'
        : ' — expected for local dev. Set production URL in Vercel env vars before the pilot.')
    )
  } else {
    pass(`NEXT_PUBLIC_APP_URL = ${APP_URL}`)
  }

  // ── Resend ──────────────────────────────────────────────────────────────────
  RESEND_KEY
    ? pass('RESEND_API_KEY is set')
    : fail('RESEND_API_KEY is not set')

  // ── From email ──────────────────────────────────────────────────────────────
  if (!FROM_EMAIL) {
    fail('INVITE_FROM_EMAIL is not set')
  } else if (FROM_EMAIL.includes('resend.dev')) {
    failOrWarn(
      `INVITE_FROM_EMAIL uses resend.dev (${FROM_EMAIL})` +
      (IS_PRODUCTION_MODE
        ? ' — must use a verified custom domain for production. Staff invite emails may be rejected or land in spam.'
        : ' — acceptable for local testing. Replace with a verified custom domain in Vercel before the pilot.')
    )
  } else {
    const domain = FROM_EMAIL.match(/@([^>]+)>?/)?.[1] ?? FROM_EMAIL
    pass(`INVITE_FROM_EMAIL domain: ${domain}`)
    skip('Confirm this domain has SPF + DKIM verified in Resend dashboard')
  }

  // ── QA safety vars ──────────────────────────────────────────────────────────
  if (QA_BYPASS) {
    failOrWarn(
      'QA_BYPASS_AUTH is set — this disables authentication entirely.' +
      (IS_PRODUCTION_MODE
        ? ' Remove it from Vercel production env vars immediately.'
        : ' Remove it from .env.local before running production pilot verify.')
    )
  } else {
    pass('QA_BYPASS_AUTH is not set (correct)')
  }

  if (QA_EMAIL_MODE) {
    warn('QA_EMAIL_MODE is set — outbound emails are suppressed. Remove for production.')
  } else {
    pass('QA_EMAIL_MODE is not set (correct)')
  }
}

// ── Check 2: Database Tables ──────────────────────────────────────────────────

async function checkDatabase(): Promise<void> {
  head('━━━ 2. Database — Required Tables')

  const db = makeDb()
  if (!db) {
    fail('Cannot connect to Supabase — NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing')
    return
  }

  const requiredTables = [
    'companies', 'profiles', 'applicants', 'staff_profiles',
    'documents', 'compliance_items', 'notification_logs',
    'form_fields', 'form_responses', 'form_answers',
    'audit_logs',
  ]

  let tablesFailed = 0
  for (const table of requiredTables) {
    try {
      // Selecting with limit(0) is a lightweight existence probe.
      // PGRST116 = "relation does not exist" — any other error may be permissions.
      const { error } = await db.from(table).select('id').limit(0)
      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
          fail(`Table "${table}" does not exist — run missing migrations`)
        } else {
          warn(`Table "${table}" query returned an unexpected error: ${error.message}`)
        }
        tablesFailed++
      } else {
        pass(`Table "${table}" exists`)
      }
    } catch (e: unknown) {
      fail(`Table "${table}" check threw: ${e instanceof Error ? e.message : String(e)}`)
      tablesFailed++
    }
  }

  if (tablesFailed === 0) {
    info('All required tables are accessible.')
  }
}

// ── Check 3: QA Data Pollution ────────────────────────────────────────────────

async function checkQaPollution(): Promise<void> {
  head('━━━ 3. QA Data Isolation')

  const db = makeDb()
  if (!db) { warn('Skipping QA pollution check — no DB connection.'); return }

  // Check for QA company
  try {
    const { data: qaCompanies, error } = await db
      .from('companies')
      .select('id, name, slug')
      .or('slug.ilike.%qa%,name.ilike.%sprintscale qa%')
      .limit(5)

    if (error) {
      warn(`Could not query companies table: ${error.message}`)
    } else if (qaCompanies && qaCompanies.length > 0) {
      // In production mode this is a hard fail — QA data must not be in prod.
      const msg = `Found ${qaCompanies.length} company row(s) with QA in name/slug:`
      if (IS_PRODUCTION_MODE) {
        fail(msg)
      } else {
        warn(msg)
      }
      for (const c of qaCompanies) {
        info(`  → "${c.name}" (slug: ${c.slug}, id: ${c.id})`)
      }
      if (IS_PRODUCTION_MODE) {
        info('  Run cleanup SQL from docs/QA_DATA_GUIDANCE.md to remove QA data.')
      }
    } else {
      pass('No QA company detected in database')
    }
  } catch (e: unknown) {
    warn(`QA company check threw: ${e instanceof Error ? e.message : String(e)}`)
  }

  // Check for [QA] prefixed staff
  try {
    const { count: qaStaff, error } = await db
      .from('staff_profiles')
      .select('id', { count: 'exact', head: true })
      .ilike('first_name', '[QA]%')

    if (error) {
      warn(`Could not count QA staff profiles: ${error.message}`)
    } else if ((qaStaff ?? 0) > 0) {
      const msg = `Found ${qaStaff} staff profile(s) prefixed with [QA]`
      IS_PRODUCTION_MODE ? fail(msg + ' — remove before pilot') : warn(msg)
    } else {
      pass('No [QA]-prefixed staff profiles found')
    }
  } catch (e: unknown) {
    warn(`QA staff check threw: ${e instanceof Error ? e.message : String(e)}`)
  }

  // Check for QA emails in profiles
  try {
    const { count: qaEmails, error } = await db
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .ilike('email', '%sprintscaleit%')

    if (error) {
      warn(`Could not count QA emails: ${error.message}`)
    } else if ((qaEmails ?? 0) > 0) {
      warn(`Found ${qaEmails} profile(s) with @sprintscaleit.co.uk email — expected in QA/staging, not production`)
    } else {
      pass('No QA email addresses in profiles table')
    }
  } catch (e: unknown) {
    warn(`QA email check threw: ${e instanceof Error ? e.message : String(e)}`)
  }
}

// ── Check 4: Admin Account ────────────────────────────────────────────────────

async function checkAdminAccount(): Promise<void> {
  head('━━━ 4. Admin Account')

  const db = makeDb()
  if (!db) { warn('Skipping admin account check — no DB connection.'); return }

  try {
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
      fail('No admin profiles found — at least one company_admin is required before onboarding')
      return
    }

    pass(`Found ${admins.length} admin account(s):`)
    for (const a of admins) {
      info(`  → ${a.email ?? '(no email)'} (role: ${a.role})`)
    }
  } catch (e: unknown) {
    fail(`Admin account check threw: ${e instanceof Error ? e.message : String(e)}`)
    return
  }

  // Check a non-QA company exists
  try {
    const { data: companies, error } = await db
      .from('companies')
      .select('id, name, slug')
      .not('slug', 'ilike', '%qa%')
      .limit(5)

    if (error) {
      warn(`Could not query companies: ${error.message}`)
    } else if (!companies || companies.length === 0) {
      fail('No non-QA company found — create a production company before onboarding')
    } else {
      pass(`Production company: "${companies[0].name}" (${companies[0].slug})`)
    }
  } catch (e: unknown) {
    warn(`Company check threw: ${e instanceof Error ? e.message : String(e)}`)
  }
}

// ── Check 5: Document Storage ─────────────────────────────────────────────────

async function checkStorage(): Promise<void> {
  head('━━━ 5. Document Storage')

  const db = makeDb()
  if (!db) { warn('Skipping storage check — no DB connection.'); return }

  try {
    const { data: buckets, error } = await db.storage.listBuckets()

    if (error) {
      fail(`Could not list storage buckets: ${error.message}`)
      return
    }

    const careOsBucket = (buckets ?? []).find(
      (b: { name: string }) => b.name === 'care-os-documents'
    )

    if (!careOsBucket) {
      fail('Storage bucket "care-os-documents" not found — create it in Supabase → Storage')
    } else {
      pass('Storage bucket "care-os-documents" exists')
      skip('Confirm bucket is set to PRIVATE in Supabase → Storage → care-os-documents → Settings')
    }
  } catch (e: unknown) {
    fail(`Storage check threw: ${e instanceof Error ? e.message : String(e)}`)
  }
}

// ── Check 6: Email Configuration ─────────────────────────────────────────────

async function checkEmailConfig(): Promise<void> {
  head('━━━ 6. Email — Recent Notification Logs')

  // FROM_EMAIL domain warnings already emitted in checkEnvVars.
  // This section checks the DB notification_logs for recent failures.

  const db = makeDb()
  if (!db) { warn('Skipping notification log check — no DB connection.'); return }

  try {
    const { data: recentLogs, error } = await db
      .from('notification_logs')
      .select('status, error_message, created_at')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) {
      warn(`Could not query notification_logs: ${error.message}`)
    } else if (recentLogs && recentLogs.length > 0) {
      warn(`${recentLogs.length} recent failed notification(s) — check notification_logs table`)
      for (const log of recentLogs) {
        warn(`  → ${log.created_at}: ${log.error_message ?? 'no details'}`)
      }
    } else {
      pass('No recent failed notification logs')
    }
  } catch (e: unknown) {
    warn(`Notification log check threw: ${e instanceof Error ? e.message : String(e)}`)
  }
}

// ── Check 7: Manual Workflow Checklist ────────────────────────────────────────

function printManualChecklist(): void {
  head('━━━ 7. Pilot Workflow — Manual Verification Checklist')
  console.log('')
  console.log('  Complete these steps in the browser before onboarding real staff:')
  console.log('')
  console.log('  [ ] INVITE TEST APPLICANT')
  console.log('      → Go to /admin/applicants → + Invite applicant')
  console.log('      → Use a personal email you can check')
  console.log('      → Confirm invite email arrives (check spam folder too)')
  console.log('')
  console.log('  [ ] COMPLETE PORTAL ONBOARDING (as the test applicant)')
  console.log('      → Click the magic link in the invite email')
  console.log('      → Fill in all onboarding forms')
  console.log('      → Upload a test document (blank PDF or photo)')
  console.log('      → Submit the onboarding form')
  console.log('')
  console.log('  [ ] APPROVE / REJECT DOCUMENT')
  console.log('      → Admin: /admin/onboarding → click the test staff member')
  console.log('      → Open Documents section → approve or reject the uploaded doc')
  console.log('      → Confirm status changes to Approved / Rejected')
  console.log('')
  console.log('  [ ] SEND REMINDER')
  console.log('      → In /admin/onboarding, find an incomplete worker')
  console.log('      → Click 📧 Remind → confirm button shows "✓ Sent"')
  console.log('      → Confirm the reminder email arrives')
  console.log('')
  console.log('  [ ] ACTIVATION BLOCKER CHECK')
  console.log('      → Go to the test staff profile → Activation section')
  console.log('      → Confirm blocker checklist shows outstanding items')
  console.log('      → Confirm activation is blocked until all items are resolved')
  console.log('')
  console.log('  [ ] ACTIVATE ONLY WHEN COMPLIANT')
  console.log('      → Resolve all blockers (upload + approve all required docs)')
  console.log('      → Confirm all activation checklist items are green')
  console.log('      → Click Activate → status changes to "Active"')
  console.log('      → Worker moves from Onboarding queue to Staff list')
  console.log('')
  console.log('  [ ] MOBILE ACCESS CHECK')
  console.log('      → Open the portal link on iPhone (iOS Safari) and Android (Chrome)')
  console.log('      → Confirm forms are readable without zooming')
  console.log('      → Confirm document upload works from the camera roll')
  console.log('')
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const modeLabel = IS_PRODUCTION_MODE ? 'PRODUCTION' : 'LOCAL DEV'

  console.log('\n╔══════════════════════════════════════════════════════╗')
  console.log(`║    Care OS — Pilot Verification  [${modeLabel.padEnd(12)}]  ║`)
  console.log('╚══════════════════════════════════════════════════════╝')

  if (IS_PRODUCTION_MODE) {
    console.log('\n  ⚠️  PRODUCTION MODE: localhost URLs, QA_BYPASS_AUTH, and resend.dev')
    console.log('      are treated as hard blockers, not warnings.')
  } else {
    console.log('\n  ℹ️  LOCAL DEV MODE: localhost/QA config issues are warnings, not blockers.')
    console.log('      Run `npm run pilot:verify:production` before onboarding real staff.')
  }

  console.log('\nRunning automated checks…')

  checkEnvVars()
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
    console.log('\n  ✅  All automated checks passed.')
    console.log(`  ✅  ${IS_PRODUCTION_MODE ? 'System is production-ready.' : 'No issues in local config.'} Complete the manual checklist above.\n`)
  } else if (blockers === 0) {
    console.log(`\n  ✅  No blockers (${warnings} warning(s)).`)
    if (IS_PRODUCTION_MODE) {
      console.log('  ⚠️   Fix warnings before onboarding real staff.')
    } else {
      console.log('  ⚠️   Warnings noted. Run `npm run pilot:verify:production` when targeting production env vars.')
    }
    console.log('  Complete the manual checklist above.\n')
  } else {
    console.log(`\n  ❌  ${blockers} blocker(s) found — must resolve before onboarding real staff.`)
    if (warnings > 0) console.log(`  ⚠️   ${warnings} warning(s) also require attention.`)
    if (!IS_PRODUCTION_MODE) {
      console.log('\n  💡  Some blockers may be intentional in local dev.')
      console.log('      Run `npm run pilot:verify:production` with your production .env values')
      console.log('      to confirm readiness for the real pilot.')
    }
    console.log('')
  }

  console.log('  📖  docs/PILOT_READINESS_CHECKLIST.md — full pre-pilot checklist')
  console.log('  📖  docs/ADMIN_PILOT_GUIDE.md         — admin usage instructions')
  console.log('  📖  docs/QA_DATA_GUIDANCE.md          — QA data identification & cleanup\n')

  process.exit(blockers > 0 ? 1 : 0)
}

main().catch((e: unknown) => {
  console.error('\n❌ Pilot verify script crashed:', e)
  process.exit(1)
})
