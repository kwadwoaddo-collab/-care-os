import { adminFetch } from '@/lib/admin/serverFetch'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/auth/permissions'
import AccessDenied from '@/components/admin/AccessDenied'
import Link from 'next/link'
import type { TenantDiagnosticsResponse } from '@/app/api/admin/system/tenants/[id]/diagnostics/route'

async function getDiagnostics(id: string): Promise<TenantDiagnosticsResponse | null> {
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res  = await adminFetch(`${base}/api/admin/system/tenants/${id}/diagnostics`, { cache: 'no-store' })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

function StatusRow({
  label,
  value,
  ok,
  detail,
}: {
  label:   string
  value:   string | number
  ok:      boolean
  detail?: string
}) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-slate-50 last:border-0">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
        <div>
          <p className="text-sm font-medium text-slate-700">{label}</p>
          {detail && <p className="text-xs text-slate-400 mt-0.5">{detail}</p>}
        </div>
      </div>
      <span className={`text-sm font-semibold ${ok ? 'text-emerald-600' : 'text-red-600'}`}>{value}</span>
    </div>
  )
}

export default async function DiagnosticsPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok || !can(auth.ctx.role, 'tenants:read')) return <AccessDenied />

  const { id } = await params
  const diag = await getDiagnostics(id)

  if (!diag) {
    return (
      <div className="text-center py-24">
        <p className="text-slate-500">Could not load diagnostics.</p>
        <Link href={`/admin/system/tenants/${id}`} className="text-indigo-600 text-sm mt-2 inline-block">Back to tenant</Link>
      </div>
    )
  }

  const ts = new Date(diag.timestamp).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'medium' })
  const lastActivity = diag.last_activity
    ? new Date(diag.last_activity).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : 'No activity recorded'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
          <Link href={`/admin/system/tenants/${id}`} className="hover:text-indigo-600">Tenant</Link>
          <span>/</span>
          <span>Diagnostics</span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Tenant Diagnostics</h1>
            <p className="text-sm text-slate-500 mt-1">{diag.company_name} &mdash; {ts}</p>
          </div>
        </div>
      </div>

      {/* Migration Version */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Database & Migrations</h2>
        <StatusRow
          label="Applied Migrations"
          value={diag.migration_version ?? 'Unknown'}
          ok={!diag.migrations_mismatch}
          detail={diag.migrations_mismatch
            ? `Expected ${diag.expected_migrations ?? '?'} — mismatch detected`
            : `${diag.expected_migrations ?? '?'} expected — up to date`
          }
        />
        <StatusRow
          label="Last Tenant Activity"
          value={lastActivity}
          ok={Boolean(diag.last_activity)}
          detail="Most recent audit log entry for this tenant"
        />
      </div>

      {/* Queue & Jobs */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Jobs & Queue</h2>
        <StatusRow
          label="Failed Notifications"
          value={diag.failed_notifications}
          ok={diag.failed_notifications === 0}
          detail="Notification delivery failures in the log"
        />
        <StatusRow
          label="Queue Backlog"
          value={diag.queue_backlog}
          ok={diag.queue_backlog === 0}
          detail="Operations queue items unresolved for >7 days"
        />
      </div>

      {/* Record Health */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Record Health</h2>
        <StatusRow
          label="Stale Compliance Records"
          value={diag.stale_records}
          ok={diag.stale_records === 0}
          detail="Not-started compliance items older than 90 days"
        />
        <StatusRow
          label="Profiles Without Staff Record"
          value={diag.profiles_without_staff}
          ok={diag.profiles_without_staff === 0}
          detail="Auth profiles with no matching staff_profile"
        />
        <StatusRow
          label="Orphaned Documents"
          value={diag.orphaned_documents}
          ok={diag.orphaned_documents === 0}
          detail="Documents not linked to a staff profile"
        />
        <StatusRow
          label="Duplicate Emails"
          value={diag.duplicate_emails}
          ok={diag.duplicate_emails === 0}
          detail="Multiple staff records sharing the same email"
        />
      </div>

      {/* Overall summary */}
      <div className={`rounded-xl p-5 border ${
        diag.failed_notifications === 0 && diag.queue_backlog === 0 && !diag.migrations_mismatch && diag.stale_records === 0
          ? 'bg-emerald-50 border-emerald-200'
          : 'bg-amber-50 border-amber-200'
      }`}>
        <p className={`text-sm font-semibold ${
          diag.failed_notifications === 0 && diag.queue_backlog === 0 && !diag.migrations_mismatch && diag.stale_records === 0
            ? 'text-emerald-700'
            : 'text-amber-700'
        }`}>
          {diag.failed_notifications === 0 && diag.queue_backlog === 0 && !diag.migrations_mismatch
            ? 'All systems nominal for this tenant.'
            : 'One or more diagnostic checks require attention.'}
        </p>
      </div>

      <Link href={`/admin/system/tenants/${id}`} className="text-sm text-slate-500 hover:text-slate-700 inline-block">
        &larr; Back to tenant
      </Link>
    </div>
  )
}
