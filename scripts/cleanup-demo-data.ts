#!/usr/bin/env tsx
/**
 * scripts/cleanup-demo-data.ts
 *
 * Safe demo/seed data cleanup for Care OS controlled pilot rollout.
 *
 * WHAT IT DOES:
 *   - Identifies demo/QA companies by slug or name pattern
 *   - Deletes all operational records linked to those companies in
 *     safe foreign-key order (leaf tables first, parents last)
 *   - For all companies: removes QA-tagged/seeded operational records
 *     while leaving admin accounts, config, and system data intact
 *
 * WHAT IS ALWAYS PRESERVED:
 *   - The companies table (never deleted — companies are permanent config)
 *   - profiles matching preserved emails (Kwadwo Addo, Peace, super_admin)
 *   - System message templates  (is_system = true)
 *   - Staff document folders    (is_system = true)
 *   - tenant_branding / tenant_config
 *   - RBAC rules, compliance rules
 *   - All 55 migrations (not touched)
 *
 * USAGE:
 *   npx tsx scripts/cleanup-demo-data.ts --dry-run              # preview only
 *   npx tsx scripts/cleanup-demo-data.ts --dry-run --verbose    # preview + counts
 *   npx tsx scripts/cleanup-demo-data.ts --confirm              # execute
 *   npx tsx scripts/cleanup-demo-data.ts --confirm --demo-only  # only demo companies
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL     ?? ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY    ?? ''

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = createClient<any>(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── CLI args ──────────────────────────────────────────────────────────────────

const args         = process.argv.slice(2)
const DRY_RUN      = !args.includes('--confirm')
const DEMO_ONLY    = args.includes('--demo-only')
const VERBOSE      = args.includes('--verbose')
const TARGET_COMPANY_IDX = args.indexOf('--company-id')
const TARGET_COMPANY_ID  = TARGET_COMPANY_IDX !== -1 ? args[TARGET_COMPANY_IDX + 1] : null

// ── Emails / users to always preserve ────────────────────────────────────────
// Profiles whose email matches these patterns will never be deleted.

const PRESERVED_EMAIL_PATTERNS = [
  'kwadwoaddo',
  'kwadwo',
  'peace',
  'addo',
]

const PRESERVED_ROLES = ['super_admin']

// ── Demo company detection patterns ──────────────────────────────────────────

const DEMO_SLUG_PATTERNS = ['qa', 'demo', 'test', 'seed', 'sprintscale-qa', 'sample']
const DEMO_NAME_PATTERNS = ['qa', 'demo', 'test', 'seed', 'sprintscale qa', 'sample']

// ── Logging ───────────────────────────────────────────────────────────────────

type Summary = Record<string, number>
const summary: Summary = {}

function log(msg: string)  { console.log(msg) }
function ok(msg: string)   { console.log(`  ✓  ${msg}`) }
function skip(msg: string) { console.log(`  ○  ${msg}`) }
function warn(msg: string) { console.log(`  ⚠  ${msg}`) }
function info(msg: string) { if (VERBOSE) console.log(`  ℹ  ${msg}`) }

function recordDeletion(table: string, count: number): void {
  summary[table] = (summary[table] ?? 0) + count
}

// ── Delete helper ─────────────────────────────────────────────────────────────

async function deleteFrom(
  table: string,
  column: string,
  values: string[],
  label?: string,
): Promise<number> {
  if (values.length === 0) {
    info(`  ${table}: nothing to clean`)
    return 0
  }

  const tag = label ?? table

  if (DRY_RUN) {
    const { count } = await db
      .from(table)
      .select('id', { count: 'exact', head: true })
      .in(column, values)
    const n = count ?? 0
    if (n > 0) {
      log(`  [DRY RUN]  ${tag}: would delete ${n} row(s)`)
    } else {
      info(`  [DRY RUN]  ${tag}: 0 rows`)
    }
    recordDeletion(tag, n)
    return n
  }

  const { count, error } = await db
    .from(table)
    .delete({ count: 'exact' })
    .in(column, values)

  if (error) {
    warn(`  ${tag}: delete failed — ${error.message}`)
    return 0
  }

  const n = count ?? 0
  if (n > 0) ok(`${tag}: deleted ${n} row(s)`)
  else info(`${tag}: 0 rows deleted`)
  recordDeletion(tag, n)
  return n
}

// ── Identify demo companies ───────────────────────────────────────────────────

async function getDemoCompanyIds(): Promise<string[]> {
  const { data: companies, error } = await db
    .from('companies')
    .select('id, name, slug')

  if (error || !companies) {
    warn(`Could not query companies: ${error?.message ?? 'unknown error'}`)
    return []
  }

  const demoIds: string[] = []

  for (const c of companies) {
    const slug = (c.slug ?? '').toLowerCase()
    const name = (c.name ?? '').toLowerCase()

    const isDemo =
      DEMO_SLUG_PATTERNS.some((p) => slug.includes(p)) ||
      DEMO_NAME_PATTERNS.some((p) => name.includes(p))

    if (isDemo) {
      log(`  Demo company identified: "${c.name}" (${c.id})`)
      demoIds.push(c.id as string)
    }
  }

  return demoIds
}

// ── Identify preserved profile IDs ───────────────────────────────────────────

async function getPreservedProfileIds(): Promise<string[]> {
  const { data: profiles, error } = await db
    .from('profiles')
    .select('id, email, role')

  if (error || !profiles) {
    warn(`Could not query profiles: ${error?.message ?? 'unknown error'}`)
    return []
  }

  const preserved: string[] = []

  for (const p of profiles) {
    const email = (p.email ?? '').toLowerCase()
    const role  = (p.role ?? '').toLowerCase()

    const shouldPreserve =
      PRESERVED_ROLES.includes(role) ||
      PRESERVED_EMAIL_PATTERNS.some((pat) => email.includes(pat))

    if (shouldPreserve) {
      log(`  Preserving profile: ${p.email ?? '(no email)'} (role: ${p.role})`)
      preserved.push(p.id as string)
    }
  }

  return preserved
}

// ── Get staff IDs to delete ───────────────────────────────────────────────────

async function getStaffIdsToDelete(
  companyIds: string[],
  preservedProfileIds: string[],
): Promise<string[]> {
  if (companyIds.length === 0) return []

  const { data: staff, error } = await db
    .from('staff_profiles')
    .select('id, first_name, last_name, profile_id')
    .in('company_id', companyIds)

  if (error || !staff) {
    warn(`Could not query staff_profiles: ${error?.message}`)
    return []
  }

  return staff
    .filter((s) => !preservedProfileIds.includes(s.profile_id as string))
    .map((s) => s.id as string)
}

// ── Get applicant IDs to delete ───────────────────────────────────────────────

async function getApplicantIds(companyIds: string[]): Promise<string[]> {
  if (companyIds.length === 0) return []
  const { data } = await db
    .from('applicants')
    .select('id')
    .in('company_id', companyIds)
  return (data ?? []).map((r) => r.id as string)
}

// ── Get shift IDs ─────────────────────────────────────────────────────────────

async function getShiftIds(companyIds: string[]): Promise<string[]> {
  if (companyIds.length === 0) return []
  const { data } = await db.from('shifts').select('id').in('company_id', companyIds)
  return (data ?? []).map((r) => r.id as string)
}

// ── Get visit note IDs ────────────────────────────────────────────────────────

async function getVisitNoteIds(companyIds: string[]): Promise<string[]> {
  if (companyIds.length === 0) return []
  const { data } = await db.from('visit_notes').select('id').in('company_id', companyIds)
  return (data ?? []).map((r) => r.id as string)
}

// ── Get incident IDs ──────────────────────────────────────────────────────────

async function getIncidentIds(companyIds: string[]): Promise<string[]> {
  if (companyIds.length === 0) return []
  const { data } = await db.from('incidents').select('id').in('company_id', companyIds)
  return (data ?? []).map((r) => r.id as string)
}

// ── Get message IDs ───────────────────────────────────────────────────────────

async function getMessageIds(companyIds: string[]): Promise<string[]> {
  if (companyIds.length === 0) return []
  const { data } = await db
    .from('operational_messages')
    .select('id')
    .in('company_id', companyIds)
  return (data ?? []).map((r) => r.id as string)
}

// ── QA-tagged operational data in non-demo companies ─────────────────────────
// Removes any records explicitly tagged with [QA] patterns in real companies

async function cleanQaTaggedStaff(companyIds: string[], preservedProfileIds: string[]): Promise<void> {
  // staff_profiles with [QA] prefix in first_name (pattern from seed-qa-environment.ts)
  const { data: qaStaff } = await db
    .from('staff_profiles')
    .select('id, profile_id')
    .not('company_id', 'in', `(${companyIds.join(',') || 'null'})`)
    .ilike('first_name', '[QA]%')

  const qaIds = (qaStaff ?? [])
    .filter((s) => !preservedProfileIds.includes(s.profile_id as string))
    .map((s) => s.id as string)

  if (qaIds.length > 0) {
    await cleanStaffCascade(qaIds, '[QA]-tagged staff')
  }
}

// ── Staff cascade delete ──────────────────────────────────────────────────────

async function cleanStaffCascade(staffIds: string[], label: string): Promise<void> {
  if (staffIds.length === 0) return

  log(`\n  Cleaning ${label} (${staffIds.length} records)…`)

  // Get visit note ids for this staff (needed for deeper cascade)
  const { data: visitNotes } = await db
    .from('visit_notes')
    .select('id')
    .in('staff_profile_id', staffIds)
  const vnIds = (visitNotes ?? []).map((v) => v.id as string)

  // Cascade: visit-level children
  if (vnIds.length > 0) {
    await deleteFrom('visit_medication_records', 'visit_note_id', vnIds, 'visit_medication_records (staff)')
    await deleteFrom('visit_task_items',         'visit_note_id', vnIds, 'visit_task_items (staff)')
  }

  // Get incident ids for this staff
  const { data: incidentRows } = await db
    .from('incidents')
    .select('id')
    .in('staff_profile_id', staffIds)
  const incidentIds = (incidentRows ?? []).map((i) => i.id as string)
  if (incidentIds.length > 0) {
    await deleteFrom('visit_medication_records', 'incident_id', incidentIds, 'visit_medication_records (incident ref)')
  }

  // Document resubmission requests
  await deleteFrom('document_resubmission_requests', 'staff_profile_id', staffIds, 'document_resubmission_requests')

  // Document expiry reminders
  await deleteFrom('document_expiry_reminders', 'staff_profile_id', staffIds, 'document_expiry_reminders')

  // Readiness snapshots
  await deleteFrom('worker_readiness_snapshots', 'staff_profile_id', staffIds, 'worker_readiness_snapshots')

  // Onboarding lifecycle log
  await deleteFrom('onboarding_lifecycle_log', 'staff_profile_id', staffIds, 'onboarding_lifecycle_log')

  // In-app notifications
  await deleteFrom('in_app_notifications', 'staff_profile_id', staffIds, 'in_app_notifications')

  // Message recipients
  await deleteFrom('message_recipients', 'staff_profile_id', staffIds, 'message_recipients (staff)')

  // Staff availability
  await deleteFrom('staff_availability', 'staff_profile_id', staffIds, 'staff_availability')

  // Compliance overrides
  await deleteFrom('compliance_overrides', 'staff_profile_id', staffIds, 'compliance_overrides')

  // Visit notes
  if (vnIds.length > 0) {
    await deleteFrom('visit_anomalies', 'visit_note_id', vnIds, 'visit_anomalies')
    await deleteFrom('visit_notes', 'id', vnIds, 'visit_notes')
  }

  // Documents + document audit/routing log
  const { data: docRows } = await db.from('documents').select('id').in('staff_profile_id', staffIds)
  const docIds = (docRows ?? []).map((d) => d.id as string)
  if (docIds.length > 0) {
    await deleteFrom('document_audit_log',   'document_id', docIds, 'document_audit_log')
    await deleteFrom('document_routing_log', 'document_id', docIds, 'document_routing_log')
    await deleteFrom('staff_document_versions', 'document_id', docIds, 'staff_document_versions')
    await deleteFrom('documents', 'id', docIds, 'documents (staff)')
  }

  // Timesheets
  await deleteFrom('timesheets', 'staff_profile_id', staffIds, 'timesheets')

  // Incidents
  if (incidentIds.length > 0) {
    await deleteFrom('incidents', 'id', incidentIds, 'incidents (staff)')
  }

  // Shift offers
  await deleteFrom('shift_offers', 'staff_profile_id', staffIds, 'shift_offers')

  // Staff profiles
  await deleteFrom('staff_profiles', 'id', staffIds, label)
}

// ── Full company operational cleanup ──────────────────────────────────────────

async function cleanCompanyOperationalData(
  companyId: string,
  companyName: string,
  preservedProfileIds: string[],
): Promise<void> {
  log(`\n  Cleaning operational data for: ${companyName} (${companyId})`)

  const companyIds = [companyId]

  // ── Phase 1: Orchestration state (self-contained) ──────────────────────────
  log('\n  Phase 1: Orchestration & queue…')
  await deleteFrom('orchestration_audit_log',      'company_id', companyIds)
  await deleteFrom('orchestration_suppressions',   'company_id', companyIds)
  await deleteFrom('orchestration_priority_states','company_id', companyIds)
  await deleteFrom('operations_queue',             'company_id', companyIds)
  await deleteFrom('handover_notes',               'company_id', companyIds)

  // ── Phase 2: Communications ────────────────────────────────────────────────
  log('\n  Phase 2: Communications…')
  const messageIds = await getMessageIds(companyIds)
  if (messageIds.length > 0) {
    await deleteFrom('message_recipients',    'message_id', messageIds, 'message_recipients')
    await deleteFrom('operational_messages',  'id', messageIds, 'operational_messages')
  }
  await deleteFrom('message_suppression', 'company_id', companyIds)

  // ── Phase 3: Notification logs ─────────────────────────────────────────────
  log('\n  Phase 3: Notifications…')
  await deleteFrom('notification_logs',   'company_id', companyIds)
  await deleteFrom('in_app_notifications','company_id', companyIds)

  // ── Phase 4: Job executions & metrics ─────────────────────────────────────
  log('\n  Phase 4: Jobs & metrics…')
  await deleteFrom('job_executions', 'company_id', companyIds)
  await deleteFrom('system_metrics', 'company_id', companyIds)

  // ── Phase 5: Visit anomalies (company-level) ──────────────────────────────
  log('\n  Phase 5: Visit anomalies…')
  await deleteFrom('visit_anomalies', 'company_id', companyIds)

  // ── Phase 6: Visit note children ──────────────────────────────────────────
  log('\n  Phase 6: Visit notes…')
  const vnIds = await getVisitNoteIds(companyIds)
  if (vnIds.length > 0) {
    await deleteFrom('visit_medication_records', 'visit_note_id', vnIds, 'visit_medication_records')
    await deleteFrom('visit_task_items',         'visit_note_id', vnIds, 'visit_task_items')
    await deleteFrom('visit_notes',              'id',           vnIds,  'visit_notes')
  }

  // ── Phase 7: Incidents ─────────────────────────────────────────────────────
  log('\n  Phase 7: Incidents…')
  const incidentIds = await getIncidentIds(companyIds)
  if (incidentIds.length > 0) {
    await deleteFrom('visit_medication_records', 'incident_id', incidentIds, 'visit_medication_records (incident ref)')
    await deleteFrom('incidents', 'id', incidentIds, 'incidents')
  }

  // ── Phase 8: Shifts ────────────────────────────────────────────────────────
  log('\n  Phase 8: Shifts…')
  const shiftIds = await getShiftIds(companyIds)
  if (shiftIds.length > 0) {
    await deleteFrom('shift_offers', 'shift_id', shiftIds, 'shift_offers')
    await deleteFrom('timesheets',   'shift_id', shiftIds, 'timesheets (shift)')
    await deleteFrom('shifts',       'id',       shiftIds, 'shifts')
  }

  // ── Phase 9: Care packages ─────────────────────────────────────────────────
  log('\n  Phase 9: Care packages…')
  await deleteFrom('care_package_visits', 'company_id', companyIds)
  await deleteFrom('care_packages',       'company_id', companyIds)

  // ── Phase 10: Compliance overrides & document expiry ──────────────────────
  log('\n  Phase 10: Compliance & documents…')
  await deleteFrom('compliance_overrides',   'company_id', companyIds)
  await deleteFrom('document_expiry_reminders','company_id', companyIds)
  await deleteFrom('worker_readiness_snapshots','company_id', companyIds)
  await deleteFrom('onboarding_lifecycle_log', 'company_id', companyIds)

  // ── Phase 11: Document records ─────────────────────────────────────────────
  log('\n  Phase 11: Documents…')
  await deleteFrom('document_resubmission_requests','company_id', companyIds)
  await deleteFrom('document_audit_log',  'company_id', companyIds)
  await deleteFrom('document_routing_log','company_id', companyIds)
  await deleteFrom('staff_document_versions','company_id', companyIds)
  await deleteFrom('documents',           'company_id', companyIds)

  // ── Phase 12: Timesheets (staff-level) ────────────────────────────────────
  await deleteFrom('timesheets', 'company_id', companyIds)

  // ── Phase 13: Staff availability ──────────────────────────────────────────
  log('\n  Phase 13: Staff records…')
  const staffIds = await getStaffIdsToDelete(companyIds, preservedProfileIds)
  if (staffIds.length > 0) {
    await deleteFrom('staff_availability','staff_profile_id', staffIds)
    await deleteFrom('message_recipients','staff_profile_id', staffIds, 'message_recipients (staff)')
    await deleteFrom('staff_profiles',    'id', staffIds)
  } else {
    skip('No staff records to delete (all matched preserved profiles)')
  }

  // ── Phase 14: Applicants, interviews, forms ───────────────────────────────
  log('\n  Phase 14: Applicants & forms…')
  const applicantIds = await getApplicantIds(companyIds)
  if (applicantIds.length > 0) {
    await deleteFrom('form_responses', 'applicant_id', applicantIds)
    await deleteFrom('interviews',     'applicant_id', applicantIds)
    await deleteFrom('applicants',     'id',           applicantIds)
  }

  // ── Phase 15: Form responses (staff) ──────────────────────────────────────
  await deleteFrom('form_responses', 'company_id', companyIds)

  // ── Phase 16: Clients ─────────────────────────────────────────────────────
  log('\n  Phase 16: Clients…')
  await deleteFrom('clients', 'company_id', companyIds)

  // ── Phase 17: Audit logs ──────────────────────────────────────────────────
  log('\n  Phase 17: Audit logs…')
  await deleteFrom('audit_logs', 'company_id', companyIds)

  // ── Phase 18: Compliance items ─────────────────────────────────────────────
  await deleteFrom('compliance_items', 'company_id', companyIds)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n╔══════════════════════════════════════════════════════╗')
  console.log('║   Care OS — Demo Data Cleanup Script                 ║')
  console.log('╚══════════════════════════════════════════════════════╝')

  if (DRY_RUN) {
    console.log('\n  MODE: DRY RUN — no data will be deleted')
    console.log('  Add --confirm to execute the cleanup.\n')
  } else {
    console.log('\n  MODE: LIVE — data WILL be permanently deleted')
    console.log('  Ensure you have a database backup before proceeding.\n')
  }

  // ── Identify preserved profiles ────────────────────────────────────────────
  log('━━━ Identifying preserved accounts…')
  const preservedProfileIds = await getPreservedProfileIds()
  log(`  ${preservedProfileIds.length} profile(s) will be preserved.\n`)

  // ── Identify target companies ──────────────────────────────────────────────
  let targetCompanyIds: string[] = []

  if (TARGET_COMPANY_ID) {
    log(`━━━ Targeting specific company: ${TARGET_COMPANY_ID}`)
    targetCompanyIds = [TARGET_COMPANY_ID]
  } else if (DEMO_ONLY) {
    log('━━━ Scanning for demo/QA companies…')
    targetCompanyIds = await getDemoCompanyIds()
    if (targetCompanyIds.length === 0) {
      log('  No demo companies found — nothing to clean.')
      process.exit(0)
    }
  } else {
    log('━━━ Scanning for demo/QA companies…')
    targetCompanyIds = await getDemoCompanyIds()
  }

  // ── Fetch company names ────────────────────────────────────────────────────
  const { data: companies } = await db
    .from('companies')
    .select('id, name, slug')
    .in('id', targetCompanyIds.length > 0 ? targetCompanyIds : ['__none__'])

  const companyMap = new Map((companies ?? []).map((c) => [c.id as string, c.name as string]))

  // ── Run cleanup per company ────────────────────────────────────────────────
  for (const cid of targetCompanyIds) {
    const name = companyMap.get(cid) ?? cid
    log(`\n━━━ Company: ${name}`)
    await cleanCompanyOperationalData(cid, name, preservedProfileIds)
  }

  // ── QA-tagged staff in all other companies ─────────────────────────────────
  if (!DEMO_ONLY && !TARGET_COMPANY_ID) {
    log('\n━━━ Checking for [QA]-tagged staff in non-demo companies…')
    await cleanQaTaggedStaff(targetCompanyIds, preservedProfileIds)
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════╗')
  console.log(`║   ${DRY_RUN ? 'Dry-run summary' : 'Cleanup summary'} (${DRY_RUN ? 'would delete' : 'deleted'})              ║`)
  console.log('╚══════════════════════════════════════════════════════╝\n')

  const totalRows = Object.values(summary).reduce((a, b) => a + b, 0)

  if (totalRows === 0) {
    console.log('  Nothing to clean — environment is already clear.')
  } else {
    for (const [table, count] of Object.entries(summary).sort((a, b) => b[1] - a[1])) {
      if (count > 0) console.log(`  ${table.padEnd(40)} ${count}`)
    }
    console.log(`\n  Total rows: ${totalRows}`)
  }

  if (DRY_RUN) {
    console.log('\n  ──────────────────────────────────────────────────────')
    console.log('  Run with --confirm to execute the cleanup.')
    console.log('  Recommendation: take a DB backup first (Supabase → Settings → Database → Backups).')
  } else {
    console.log('\n  ✅  Cleanup complete.')
    console.log('  Run `npm run pilot:verify` to confirm environment state.')
  }

  console.log('')
}

main().catch((e: unknown) => {
  console.error('\n❌  Cleanup script crashed:', e)
  process.exit(1)
})
