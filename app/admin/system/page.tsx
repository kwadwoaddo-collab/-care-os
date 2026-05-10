// app/admin/system/page.tsx
// System health dashboard for pre-launch operational visibility.
import { adminFetch } from '@/lib/admin/serverFetch'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/auth/permissions'
import AccessDenied from '@/components/admin/AccessDenied'

interface HealthData {
  database:             boolean
  storage:              boolean
  resendConfigured:     boolean
  emailFromConfigured:  boolean
  appUrlConfigured:     boolean
  authSession:          boolean
  timestamp:            string
}

async function getHealth(): Promise<HealthData | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res = await adminFetch(`${baseUrl}/api/admin/system/health`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    return res.json() as Promise<HealthData>
  } catch {
    return null
  }
}

// ── Build timestamp ──────────────────────────────────────────────────────────
// Set at build time; falls back to process start.
const BUILD_TIMESTAMP =
  process.env.NEXT_PUBLIC_BUILD_TIME ??
  new Date().toISOString()

// ── Components ───────────────────────────────────────────────────────────────

function StatusDot({ ok, warn }: { ok: boolean; warn?: boolean }) {
  const colour = ok
    ? 'bg-green-500'
    : warn
    ? 'bg-yellow-400'
    : 'bg-red-500'
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${colour} shrink-0`}
      aria-hidden="true"
    />
  )
}

function StatusCard({
  label,
  ok,
  detail,
  warn = false,
}: {
  label: string
  ok: boolean
  detail?: string
  warn?: boolean
}) {
  const border = ok
    ? 'border-green-200 bg-green-50'
    : warn
    ? 'border-yellow-200 bg-yellow-50'
    : 'border-red-200 bg-red-50'
  const text = ok
    ? 'text-green-700'
    : warn
    ? 'text-yellow-700'
    : 'text-red-700'
  const badge = ok ? 'OK' : warn ? 'Warning' : 'Error'

  return (
    <div className={`rounded-lg border px-4 py-4 flex items-start gap-3 ${border}`}>
      <StatusDot ok={ok} warn={warn} />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${text}`}>{label}</p>
        {detail && (
          <p className="text-xs text-gray-500 mt-0.5 truncate">{detail}</p>
        )}
      </div>
      <span
        className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
          ok
            ? 'bg-green-100 text-green-800'
            : warn
            ? 'bg-yellow-100 text-yellow-800'
            : 'bg-red-100 text-red-800'
        }`}
      >
        {badge}
      </span>
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h2>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function SystemPage() {
  const auth = await requireAdmin()
  if (!auth.ok || !can(auth.ctx.role, 'system:read')) return <AccessDenied />

  const health = await getHealth()

  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? 'Not set'
  const supaUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'Not set'
  const nodeEnv  = process.env.NODE_ENV ?? 'unknown'
  const hasResend = Boolean(process.env.RESEND_API_KEY)
  const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

  const fetchedAt = health?.timestamp
    ? new Date(health.timestamp).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'medium' })
    : 'Unavailable'

  const builtAt = new Date(BUILD_TIMESTAMP).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  })

  // Overall status
  const allOk = health
    ? health.database && health.storage && health.resendConfigured && health.emailFromConfigured && health.appUrlConfigured
    : false
  const hasWarnings = health
    ? !health.database || !health.storage
    : true

  return (
    <div className="space-y-8 max-w-3xl">

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">System Health</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Operational status and environment checks
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
            allOk
              ? 'bg-green-100 text-green-800'
              : hasWarnings
              ? 'bg-red-100 text-red-800'
              : 'bg-yellow-100 text-yellow-800'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${allOk ? 'bg-green-500' : hasWarnings ? 'bg-red-500' : 'bg-yellow-400'}`}
          />
          {allOk ? 'All systems operational' : hasWarnings ? 'Degraded' : 'Warnings present'}
        </span>
      </div>

      {/* Connectivity checks */}
      <div className="space-y-3">
        <SectionHeader
          title="Connectivity"
          subtitle={`Last checked: ${fetchedAt}`}
        />
        <div className="grid gap-3">
          <StatusCard
            label="Database (Supabase)"
            ok={health?.database ?? false}
            detail={`Connected to: ${supaUrl.replace('https://', '').split('.')[0]}…`}
          />
          <StatusCard
            label="Storage (Supabase)"
            ok={health?.storage ?? false}
            detail="care-os-documents bucket accessible"
          />
        </div>
      </div>

      {/* Configuration */}
      <div className="space-y-3">
        <SectionHeader
          title="Configuration"
          subtitle="Environment variable checks"
        />
        <div className="grid gap-3">
          <StatusCard
            label="Supabase URL"
            ok={supaUrl !== 'Not set'}
            detail={supaUrl !== 'Not set' ? supaUrl : 'NEXT_PUBLIC_SUPABASE_URL not set'}
          />
          <StatusCard
            label="Supabase Service Role Key"
            ok={hasServiceKey}
            detail={hasServiceKey ? 'SUPABASE_SERVICE_ROLE_KEY configured' : 'Not configured — admin APIs will fail'}
          />
          <StatusCard
            label="App URL"
            ok={health?.appUrlConfigured ?? (appUrl !== 'Not set')}
            detail={appUrl}
          />
          <StatusCard
            label="Resend API Key"
            ok={health?.resendConfigured ?? hasResend}
            detail={hasResend ? 'RESEND_API_KEY configured' : 'Not configured — all emails will fail'}
          />
          <StatusCard
            label="Email From Address"
            ok={health?.emailFromConfigured ?? Boolean(process.env.EMAIL_FROM ?? process.env.INVITE_FROM_EMAIL)}
            detail={
              process.env.EMAIL_FROM
                ? process.env.EMAIL_FROM
                : process.env.INVITE_FROM_EMAIL
                ? process.env.INVITE_FROM_EMAIL
                : 'EMAIL_FROM not set — using fallback sender'
            }
          />
          <StatusCard
            label="Auth Supabase client"
            ok={health?.authSession ?? false}
            detail="Anon key + URL configured for session management"
          />
        </div>
      </div>

      {/* Environment */}
      <div className="space-y-3">
        <SectionHeader title="Build Info" />
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100 text-sm">
          {[
            { label: 'NODE_ENV',       value: nodeEnv },
            { label: 'App URL',        value: appUrl },
            { label: 'Built at',       value: builtAt },
            { label: 'Health checked', value: fetchedAt },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between px-4 py-3">
              <span className="text-gray-500 font-medium">{label}</span>
              <span className="text-gray-900 font-mono text-xs truncate max-w-xs text-right">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div className="space-y-3">
        <SectionHeader title="Quick Links" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { href: '/admin', label: 'Dashboard' },
            { href: '/admin/staff', label: 'Staff' },
            { href: '/admin/clients', label: 'Clients' },
            { href: '/admin/shifts', label: 'Shifts' },
            { href: '/admin/incidents', label: 'Incidents' },
            { href: '/api/admin/system/health', label: 'Health JSON ↗', external: true },
          ].map(({ href, label, external }) => (
            <a
              key={href}
              href={href}
              target={external ? '_blank' : undefined}
              rel={external ? 'noopener noreferrer' : undefined}
              className="flex items-center gap-2 px-4 py-3 bg-white rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              {label}
            </a>
          ))}
        </div>
      </div>

    </div>
  )
}
