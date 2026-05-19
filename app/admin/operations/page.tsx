import { requireAdmin }              from '@/lib/auth/requireAdmin'
import { can }                       from '@/lib/auth/permissions'
import AccessDenied                  from '@/components/admin/AccessDenied'
import { adminFetch }                from '@/lib/admin/serverFetch'
import OperationsControlCenter       from '@/components/admin/OperationsControlCenter'
import TopPrioritiesSection          from '@/components/admin/TopPrioritiesSection'
import MobilePageHeader              from '@/components/admin/MobilePageHeader'
import type { OccSummary }           from '@/lib/operations/priorityQueue'
import type { OrchestrationResult }  from '@/lib/operations/orchestration'

async function getSummary(): Promise<OccSummary | null> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res  = await adminFetch(`${base}/api/admin/operations/summary`, { cache: 'no-store' })
  if (!res.ok) return null
  return res.json() as Promise<OccSummary>
}

async function getPriorities(): Promise<OrchestrationResult | null> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res  = await adminFetch(`${base}/api/admin/operations/priorities`, { cache: 'no-store' })
  if (!res.ok) return null
  return res.json() as Promise<OrchestrationResult>
}

export default async function OperationsPage() {
  const auth = await requireAdmin()
  if (!auth.ok || !can(auth.ctx.role, 'incidents:read')) return <AccessDenied />

  const [summary, priorities] = await Promise.all([getSummary(), getPriorities()])

  if (!summary) {
    return (
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-10 text-center">
        <p className="text-sm font-medium text-primary">Failed to load operations data</p>
        <p className="text-xs text-gray-400 mt-1">Please refresh the page.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <MobilePageHeader
        title="Operations"
        subtitle="Control center"
      />

      {/* Unified priority stream — always shown first */}
      <TopPrioritiesSection initialData={priorities} />

      {/* Existing OCC summary */}
      <OperationsControlCenter summary={summary} />
    </div>
  )
}
