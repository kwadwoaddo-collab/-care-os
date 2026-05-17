import Link from 'next/link'
import { requireAdmin }    from '@/lib/auth/requireAdmin'
import { can }             from '@/lib/auth/permissions'
import AccessDenied        from '@/components/admin/AccessDenied'
import { adminFetch }      from '@/lib/admin/serverFetch'
import IncidentIntelligenceDashboard from '@/components/admin/IncidentIntelligenceDashboard'
import MobilePageHeader    from '@/components/admin/MobilePageHeader'
import type { IntelligenceResponse } from '@/app/api/admin/incidents/intelligence/route'

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getIntelligence(): Promise<IntelligenceResponse | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res = await adminFetch(`${baseUrl}/api/admin/incidents/intelligence`, { cache: 'no-store' })
  if (!res.ok) return null
  return res.json() as Promise<IntelligenceResponse>
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function IncidentIntelligencePage() {
  const auth = await requireAdmin()
  if (!auth.ok || !can(auth.ctx.role, 'incidents:read')) return <AccessDenied />

  const data = await getIntelligence()

  return (
    <div className="space-y-5">

      {/* Mobile header */}
      <MobilePageHeader
        title="Incident Intelligence"
        subtitle="Safeguarding risk & operational patterns"
      />

      {/* Desktop header */}
      <div className="hidden lg:flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/admin/incidents"
              className="text-sm text-on-surface-variant hover:text-primary transition-colors"
            >
              ← Incidents
            </Link>
          </div>
          <h1 className="text-xl font-semibold text-primary">Incident Intelligence</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Safeguarding risk detection · Staff & client risk profiles · Operational patterns
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/incidents"
            className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-3.5 py-2 text-sm font-medium text-primary hover:bg-gray-50 transition-colors"
          >
            View all incidents
          </Link>
        </div>
      </div>

      {data === null ? (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] p-10 text-center">
          <p className="text-sm font-medium text-primary">Unable to load intelligence data</p>
          <p className="text-xs text-gray-400 mt-1">Please refresh the page to try again.</p>
        </div>
      ) : (
        <IncidentIntelligenceDashboard data={data} />
      )}
    </div>
  )
}
