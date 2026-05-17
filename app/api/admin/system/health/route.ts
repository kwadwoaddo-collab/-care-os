import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/auth/permissions'
import { forbidden } from '@/lib/auth/responses'
import { readdirSync } from 'fs'
import { join } from 'path'

// Number of migrations we know exist in the codebase (kept in sync with the
// supabase/migrations directory at build time so we can detect unapplied ones).
const EXPECTED_MIGRATION_COUNT = (() => {
  try {
    const dir = join(process.cwd(), 'supabase', 'migrations')
    return readdirSync(dir).filter((f) => f.endsWith('.sql')).length
  } catch {
    return null
  }
})()

export interface HealthResponse {
  database:              boolean
  storage:               boolean
  resendConfigured:      boolean
  emailFromConfigured:   boolean
  appUrlConfigured:      boolean
  cronSecretConfigured:  boolean
  authSession:           boolean
  timestamp:             string
  /** How many migrations are in the codebase */
  expectedMigrations:    number | null
  /** How many schema_migrations rows exist in the DB */
  appliedMigrations:     number | null
  /** Whether appliedMigrations === expectedMigrations */
  migrationsMismatch:    boolean
  /** Active staff (non-terminated) count */
  activeStaffCount:      number | null
  /** Staff who have been pre_employment for >30 days (possible stale onboarding) */
  staleOnboardingCount:  number | null
  /** Any applicants stuck in applied for >60 days */
  staleApplicantCount:   number | null
  /** Missing env vars */
  missingEnvVars:        string[]
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'system:read')) return forbidden('Insufficient permissions')

  const timestamp = new Date().toISOString()

  // ── Database ────────────────────────────────────────────────────────────────
  let database = false
  try {
    const { error } = await adminClient.from('companies').select('id').limit(1)
    database = !error
  } catch { /* stays false */ }

  // ── Storage ─────────────────────────────────────────────────────────────────
  let storage = false
  try {
    const { error } = await adminClient.storage.listBuckets()
    storage = !error
  } catch { /* stays false */ }

  // ── Config checks ────────────────────────────────────────────────────────────
  const resendConfigured     = Boolean(process.env.RESEND_API_KEY?.length ?? 0 > 10)
  const emailFromConfigured  = Boolean(process.env.EMAIL_FROM ?? process.env.INVITE_FROM_EMAIL)
  const appUrlConfigured     = Boolean(process.env.NEXT_PUBLIC_APP_URL?.startsWith('http'))
  const cronSecretConfigured = Boolean(process.env.CRON_SECRET?.length ?? 0 > 8)

  const authSession = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  // ── Required env var audit ─────────────────────────────────────────────────
  const REQUIRED_ENV_VARS = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_APP_URL',
    'RESEND_API_KEY',
    'CRON_SECRET',
  ]
  const missingEnvVars = REQUIRED_ENV_VARS.filter((v) => !process.env[v])

  // ── Applied migrations (via schema_migrations table if it exists) ──────────
  let appliedMigrations: number | null = null
  try {
    const { count } = await adminClient
      .from('schema_migrations')
      .select('*', { count: 'exact', head: true })
    appliedMigrations = count ?? null
  } catch {
    // schema_migrations table not used — fall back to null
    appliedMigrations = null
  }

  const migrationsMismatch =
    EXPECTED_MIGRATION_COUNT !== null &&
    appliedMigrations !== null &&
    appliedMigrations !== EXPECTED_MIGRATION_COUNT

  // ── Active staff count ─────────────────────────────────────────────────────
  let activeStaffCount: number | null = null
  try {
    const { count } = await adminClient
      .from('staff_profiles')
      .select('*', { count: 'exact', head: true })
      .in('status', ['active', 'pre_employment'])
    activeStaffCount = count ?? null
  } catch { /* stays null */ }

  // ── Stale onboarding: pre_employment for >30 days ─────────────────────────
  let staleOnboardingCount: number | null = null
  try {
    const cutoff30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { count } = await adminClient
      .from('staff_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pre_employment')
      .lt('created_at', cutoff30)
    staleOnboardingCount = count ?? null
  } catch { /* stays null */ }

  // ── Stale applicants: in applied/shortlisted for >60 days ─────────────────
  let staleApplicantCount: number | null = null
  try {
    const cutoff60 = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
    const { count } = await adminClient
      .from('applicants')
      .select('*', { count: 'exact', head: true })
      .in('status', ['applied', 'shortlisted'])
      .lt('created_at', cutoff60)
      .is('deleted_at', null)
    staleApplicantCount = count ?? null
  } catch { /* stays null */ }

  return NextResponse.json({
    database,
    storage,
    resendConfigured,
    emailFromConfigured,
    appUrlConfigured,
    cronSecretConfigured,
    authSession,
    timestamp,
    expectedMigrations:   EXPECTED_MIGRATION_COUNT,
    appliedMigrations,
    migrationsMismatch,
    activeStaffCount,
    staleOnboardingCount,
    staleApplicantCount,
    missingEnvVars,
  } satisfies HealthResponse)
}
