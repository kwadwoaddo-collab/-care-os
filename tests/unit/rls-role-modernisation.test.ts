/**
 * tests/unit/rls-role-modernisation.test.ts
 *
 * Verifies supabase/migrations/061_rls_role_modernisation.sql: the new
 * is_admin_role() SQL helper must recognise every ADMIN_ROLES member
 * (lib/rbac/roles.ts) — not just the legacy 'admin' enum value — and must
 * reject care_worker.
 *
 * Unlike the other tests/unit/*.test.ts files, this one cannot mock its way
 * around a real DB: it is testing actual Postgres RLS/function behaviour,
 * so it signs in as real QA users with the anon key and calls the SQL
 * function via RPC, exactly as the browser client would.
 *
 * Requires:
 *   - Migration 061 applied to the target Supabase project
 *   - QA environment seeded (npm run qa:seed) — uses qa-coordinator
 *     (coordinator role, an ADMIN_ROLES member) and qa-worker (care_worker,
 *     not an ADMIN_ROLES member)
 *
 * Run with:  npx tsx tests/unit/rls-role-modernisation.test.ts
 */

require('dotenv').config({ path: '.env.local' })

import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY      = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const QA_PASSWORD     = 'ChangeMe123!'
const QA_COORDINATOR  = 'qa-coordinator@sprintscaleit.co.uk'  // coordinator — ADMIN_ROLES member
const QA_WORKER       = 'qa-worker@sprintscaleit.co.uk'       // care_worker — not an ADMIN_ROLES member

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓  ${name}`)
    passed++
  } catch (err) {
    console.error(`  ✗  ${name}`)
    console.error(`     ${err instanceof Error ? err.message : String(err)}`)
    failed++
  }
}

async function isAdminRoleAs(email: string): Promise<boolean> {
  const client = createClient(SUPABASE_URL!, ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: QA_PASSWORD,
  })
  if (signInError) {
    throw new Error(`Sign-in failed for ${email}: ${signInError.message}`)
  }

  const { data, error } = await client.rpc('is_admin_role')
  if (error) {
    throw new Error(`is_admin_role() RPC failed for ${email}: ${error.message}`)
  }
  return data as boolean
}

async function main() {
  if (!SUPABASE_URL || !ANON_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY — skipping')
    process.exit(0)
  }

  let coordinatorResult: boolean | null = null
  let workerResult: boolean | null = null

  try {
    coordinatorResult = await isAdminRoleAs(QA_COORDINATOR)
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
  }

  try {
    workerResult = await isAdminRoleAs(QA_WORKER)
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
  }

  test('is_admin_role() is true for coordinator (an ADMIN_ROLES member, not the legacy admin string)', () => {
    assert.notEqual(coordinatorResult, null, 'RPC call did not complete — is migration 061 applied and QA seeded?')
    assert.strictEqual(coordinatorResult, true)
  })

  test('is_admin_role() is false for care_worker', () => {
    assert.notEqual(workerResult, null, 'RPC call did not complete — is migration 061 applied and QA seeded?')
    assert.strictEqual(workerResult, false)
  })

  console.log(`\n  ${passed + failed} tests: ${passed} passed, ${failed} failed\n`)
  if (failed > 0) process.exit(1)
}

main()
