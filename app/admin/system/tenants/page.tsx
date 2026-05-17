import { adminFetch } from '@/lib/admin/serverFetch'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/auth/permissions'
import AccessDenied from '@/components/admin/AccessDenied'
import Link from 'next/link'
import type { TenantSummary } from '@/app/api/admin/system/tenants/route'

async function getTenants(): Promise<TenantSummary[]> {
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res  = await adminFetch(`${base}/api/admin/system/tenants`, { cache: 'no-store' })
    if (!res.ok) return []
    const json = await res.json()
    return json.tenants ?? []
  } catch {
    return []
  }
}

function RiskBadge({ level }: { level: TenantSummary['compliance_risk'] }) {
  const map: Record<string, string> = {
    low:     'bg-emerald-100 text-emerald-700',
    medium:  'bg-amber-100 text-amber-700',
    high:    'bg-orange-100 text-orange-700',
    critical:'bg-red-100 text-red-700',
    unknown: 'bg-slate-100 text-slate-500',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${map[level] ?? map.unknown}`}>
      {level}
    </span>
  )
}

function SetupProgress({ step, completed }: { step: number; completed: boolean }) {
  const pct = completed ? 100 : Math.round((step / 8) * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden w-20">
        <div
          className={`h-full rounded-full transition-all ${completed ? 'bg-emerald-500' : 'bg-indigo-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-slate-500 shrink-0">{completed ? 'Done' : `${pct}%`}</span>
    </div>
  )
}

export default async function TenantsPage() {
  const auth = await requireAdmin()
  if (!auth.ok || !can(auth.ctx.role, 'tenants:read')) return <AccessDenied />

  const tenants = await getTenants()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tenant Administration</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage all care companies onboarded to Care OS. {tenants.length} tenant{tenants.length !== 1 ? 's' : ''} registered.
          </p>
        </div>
        <Link
          href="/admin/system"
          className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
        >
          &larr; System Health
        </Link>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Tenants',   value: tenants.length },
          { label: 'Active',          value: tenants.filter(t => t.is_active).length },
          { label: 'Pilot',           value: tenants.filter(t => t.is_pilot).length },
          { label: 'Setup Complete',  value: tenants.filter(t => t.setup_completed).length },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Tenant table */}
      {tenants.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-slate-500 text-sm">No tenants registered yet.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3 hidden md:table-cell">Status</th>
                <th className="px-4 py-3 hidden lg:table-cell">Setup</th>
                <th className="px-4 py-3 hidden md:table-cell">Admins</th>
                <th className="px-4 py-3 hidden md:table-cell">Staff</th>
                <th className="px-4 py-3">Risk</th>
                <th className="px-4 py-3 hidden lg:table-cell">Storage</th>
                <th className="px-4 py-3 hidden lg:table-cell">Created</th>
                <th className="px-4 py-3 sr-only">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {/* Colour dot */}
                      <div
                        className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-white text-[10px] font-bold"
                        style={{ backgroundColor: t.accent_colour }}
                      >
                        {t.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{t.name}</p>
                        <p className="text-xs text-slate-400">{t.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold w-fit ${
                        t.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {t.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {t.is_pilot && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 w-fit">
                          Pilot
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <SetupProgress step={t.setup_step} completed={t.setup_completed} />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="font-medium text-slate-700">{t.admin_count}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="font-medium text-slate-700">{t.staff_count}</span>
                    {t.applicant_count > 0 && (
                      <span className="ml-1 text-xs text-slate-400">+{t.applicant_count}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <RiskBadge level={t.compliance_risk} />
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-slate-500 text-xs">
                    {t.storage_estimate} MB
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-slate-400 text-xs">
                    {new Date(t.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/system/tenants/${t.id}`}
                      className="text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                    >
                      Manage &rarr;
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
