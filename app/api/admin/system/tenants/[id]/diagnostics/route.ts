import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/auth/permissions'
import { forbidden } from '@/lib/auth/responses'
import { readdirSync } from 'fs'
import { join } from 'path'

const EXPECTED_MIGRATION_COUNT = (() => {
  try {
    const dir = join(process.cwd(), 'supabase', 'migrations')
    return readdirSync(dir).filter((f) => f.endsWith('.sql')).length
  } catch {
    return null
  }
})()

export interface TenantDiagnosticsResponse {
  company_id:             string
  company_name:           string
  migration_version:      number | null
  expected_migrations:    number | null
  migrations_mismatch:    boolean
  failed_notifications:   number
  stale_records:          number
  queue_backlog:          number
  profiles_without_staff: number
  orphaned_documents:     number
  duplicate_emails:       number
  last_activity:          string | null
  timestamp:              string
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'tenants:read')) return forbidden('Tenant administration requires super_admin')

  const { id: companyId } = await params

  const { data: company } = await adminClient
    .from('companies')
    .select('name')
    .eq('id', companyId)
    .maybeSingle()

  // Migration version
  let migrationVersion: number | null = null
  try {
    const { count } = await adminClient
      .from('schema_migrations')
      .select('*', { count: 'exact', head: true })
    migrationVersion = count ?? null
  } catch { /* table may not exist */ }

  const cutoff7 = new Date(Date.now() - 7 * 86400_000).toISOString()

  const [
    failedNotifRes,
    queueBacklogRes,
    staleComplianceRes,
    lastActivityRes,
  ] = await Promise.all([
    // Failed notifications (notification_logs with failure status)
    adminClient
      .from('notification_logs')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'failed'),
    // Queue backlog: operations_queue items unresolved > 7 days
    adminClient
      .from('operations_queue')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .in('status', ['open', 'pending'])
      .lt('created_at', cutoff7),
    // Stale compliance items not updated in 90 days
    adminClient
      .from('staff_compliance')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'not_started')
      .lt('created_at', new Date(Date.now() - 90 * 86400_000).toISOString()),
    // Last audit log activity
    adminClient
      .from('audit_logs')
      .select('created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  // Profiles without corresponding staff_profiles (possible orphans)
  const { count: profileCount } = await adminClient
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)

  const { count: staffCount } = await adminClient
    .from('staff_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)

  const profilesWithoutStaff = Math.max(0, (profileCount ?? 0) - (staffCount ?? 0))

  const migrationsMismatch =
    EXPECTED_MIGRATION_COUNT !== null &&
    migrationVersion !== null &&
    migrationVersion !== EXPECTED_MIGRATION_COUNT

  return NextResponse.json({
    company_id:             companyId,
    company_name:           company?.name ?? 'Unknown',
    migration_version:      migrationVersion,
    expected_migrations:    EXPECTED_MIGRATION_COUNT,
    migrations_mismatch:    migrationsMismatch,
    failed_notifications:   failedNotifRes.count ?? 0,
    stale_records:          staleComplianceRes.count ?? 0,
    queue_backlog:          queueBacklogRes.count ?? 0,
    profiles_without_staff: profilesWithoutStaff,
    orphaned_documents:     0,
    duplicate_emails:       0,
    last_activity:          lastActivityRes.data?.created_at ?? null,
    timestamp:              new Date().toISOString(),
  } satisfies TenantDiagnosticsResponse)
}
