import { adminFetch } from '@/lib/admin/serverFetch'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/auth/permissions'
import AccessDenied from '@/components/admin/AccessDenied'
import Link from 'next/link'
import type { TenantHealthResponse } from '@/app/api/admin/system/tenants/[id]/health/route'

async function getTenantHealth(id: string): Promise<TenantHealthResponse | null> {
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res  = await adminFetch(`${base}/api/admin/system/tenants/${id}/health`, { cache: 'no-store' })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

async function getTenantDetail(id: string) {
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res  = await adminFetch(`${base}/api/admin/system/tenants/${id}`, { cache: 'no-store' })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

function RiskBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    low:     'bg-emerald-100 text-emerald-700',
    medium:  'bg-amber-100 text-amber-700',
    high:    'bg-orange-100 text-orange-700',
    critical:'bg-red-100 text-red-700',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-semibold capitalize ${map[level] ?? 'bg-slate-100 text-slate-500'}`}>
      {level} risk
    </span>
  )
}

function StatCard({ label, value, sub, colour }: { label: string; value: number | string; sub?: string; colour?: string }) {
  return (
    <div className="bg-surface-container-lowest border border-slate-200 rounded-xl p-5">
      <p className={`text-3xl font-bold ${colour ?? 'text-slate-900'}`}>{value}</p>
      <p className="text-sm font-medium text-slate-700 mt-1">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// Go Live Readiness score (0–100) based on health metrics
function goLiveScore(h: TenantHealthResponse): number {
  let score = 100
  if (h.critical_issues > 0)    score -= Math.min(30, h.critical_issues * 5)
  if (h.blocked_staff > 0)      score -= Math.min(20, h.blocked_staff * 3)
  if (h.uncovered_shifts > 0)   score -= Math.min(10, h.uncovered_shifts * 2)
  if (h.onboarding_backlog > 0) score -= Math.min(15, h.onboarding_backlog * 2)
  if (h.safeguarding_alerts > 0)score -= Math.min(25, h.safeguarding_alerts * 8)
  return Math.max(0, score)
}

function GoLiveGauge({ score }: { score: number }) {
  const colour = score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-red-600'
  const label  = score >= 80 ? 'Ready to go live' : score >= 60 ? 'Nearly ready' : 'Action required'
  return (
    <div className="bg-surface-container-lowest border border-slate-200 rounded-xl p-5 flex items-center gap-5">
      <div className="relative w-20 h-20 shrink-0">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3" />
          <circle
            cx="18" cy="18" r="15.9"
            fill="none"
            stroke={score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'}
            strokeWidth="3"
            strokeDasharray={`${score} ${100 - score}`}
            strokeLinecap="round"
          />
        </svg>
        <span className={`absolute inset-0 flex items-center justify-center text-lg font-bold ${colour}`}>
          {score}
        </span>
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-700">Go Live Readiness</p>
        <p className={`text-sm font-bold ${colour} mt-0.5`}>{label}</p>
        <p className="text-xs text-slate-400 mt-1">Out of 100 — based on compliance, incidents &amp; onboarding</p>
      </div>
    </div>
  )
}

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok || !can(auth.ctx.role, 'tenants:read')) return <AccessDenied />

  const { id } = await params
  const [health, detail] = await Promise.all([getTenantHealth(id), getTenantDetail(id)])

  if (!detail?.company) {
    return (
      <div className="text-center py-24">
        <p className="text-slate-500">Tenant not found.</p>
        <Link href="/admin/system/tenants" className="text-indigo-600 text-sm mt-2 inline-block">
          Back to Tenants
        </Link>
      </div>
    )
  }

  const company  = detail.company
  const branding = detail.branding
  const config   = detail.config
  const score    = health ? goLiveScore(health) : 0

  const subNav = [
    { label: 'Health',       href: `/admin/system/tenants/${id}` },
    { label: 'Setup Wizard', href: `/admin/system/tenants/${id}/setup` },
    { label: 'Branding',     href: `/admin/system/tenants/${id}/branding` },
    { label: 'Config',       href: `/admin/system/tenants/${id}/config` },
    { label: 'Diagnostics',  href: `/admin/system/tenants/${id}/diagnostics` },
  ]

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/admin/system/tenants" className="hover:text-indigo-600">Tenants</Link>
        <span>/</span>
        <span className="text-slate-800 font-medium">{company.name}</span>
      </div>

      {/* Company header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0"
            style={{ backgroundColor: branding?.accent_colour ?? '#4f46e5' }}
          >
            {company.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{company.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-400">{company.slug}</span>
              {config?.is_pilot && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">Pilot</span>
              )}
              {!config?.is_active && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">Inactive</span>
              )}
            </div>
          </div>
        </div>
        {health && <RiskBadge level={health.compliance_risk_level} />}
      </div>

      {/* Sub-nav */}
      <nav className="flex gap-1 border-b border-slate-200 -mb-2">
        {subNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="px-4 py-2.5 text-sm font-medium text-slate-500 hover:text-slate-900 border-b-2 border-transparent hover:border-slate-300 transition-colors"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Go Live Readiness */}
      {health && <GoLiveGauge score={score} />}

      {/* Health cards */}
      {health && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <StatCard label="Critical Issues"      value={health.critical_issues}     colour={health.critical_issues > 0 ? 'text-red-600' : undefined} />
          <StatCard label="Blocked Staff"        value={health.blocked_staff}       colour={health.blocked_staff > 0 ? 'text-orange-600' : undefined} />
          <StatCard label="Uncovered Shifts"     value={health.uncovered_shifts}    colour={health.uncovered_shifts > 0 ? 'text-amber-600' : undefined} />
          <StatCard label="Safeguarding Alerts"  value={health.safeguarding_alerts} colour={health.safeguarding_alerts > 0 ? 'text-red-600' : undefined} />
          <StatCard label="Onboarding Backlog"   value={health.onboarding_backlog}  sub="Pre-employment &gt;30 days" />
          <StatCard label="Stale Applicants"     value={health.stale_applicants}    sub="Applied &gt;60 days" />
          <StatCard label="Open Incidents"       value={health.open_incidents} />
          <StatCard label="Expiring Soon"        value={health.expiring_soon}       sub="Compliance items" colour={health.expiring_soon > 0 ? 'text-amber-600' : undefined} />
        </div>
      )}

      {/* Onboarding checklist */}
      <div className="bg-surface-container-lowest border border-slate-200 rounded-xl p-5">
        <h2 className="font-semibold text-slate-800 mb-4">Onboarding Checklist</h2>
        <div className="space-y-2">
          {[
            { label: 'Company details set',           done: Boolean(company.name) },
            { label: 'Branding configured',           done: Boolean(branding?.accent_colour) },
            { label: 'Compliance defaults reviewed',  done: Boolean(config?.compliance_dbs_expiry_days) },
            { label: 'Timezone set',                  done: Boolean(config?.timezone) },
            { label: 'Admin user created',            done: Boolean(config) },
            { label: 'Setup wizard completed',        done: Boolean(config?.setup_completed_at) },
            { label: 'Go Live date scheduled',        done: Boolean(config?.go_live_date) },
            { label: 'Demo data generated',           done: false },
          ].map(({ label, done }) => (
            <div key={label} className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${done ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                {done ? (
                  <svg viewBox="0 0 20 20" fill="white" className="w-3 h-3"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586l-2.293-2.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" clipRule="evenodd" /></svg>
                ) : (
                  <div className="w-2 h-2 rounded-full bg-slate-400" />
                )}
              </div>
              <span className={`text-sm ${done ? 'text-slate-700 line-through decoration-slate-300' : 'text-slate-600'}`}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: 'Setup Wizard',  href: `/admin/system/tenants/${id}/setup` },
          { label: 'Branding',      href: `/admin/system/tenants/${id}/branding` },
          { label: 'Configuration', href: `/admin/system/tenants/${id}/config` },
          { label: 'Diagnostics',   href: `/admin/system/tenants/${id}/diagnostics` },
          { label: 'All Tenants',   href: '/admin/system/tenants' },
          { label: 'System Health', href: '/admin/system' },
        ].map(({ label, href }) => (
          <Link
            key={href}
            href={href}
            className="bg-surface-container-lowest border border-slate-200 rounded-xl p-4 text-sm font-medium text-slate-700 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-colors"
          >
            {label} &rarr;
          </Link>
        ))}
      </div>
    </div>
  )
}
