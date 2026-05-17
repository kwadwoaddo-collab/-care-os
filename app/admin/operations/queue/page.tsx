import Link            from 'next/link'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can }          from '@/lib/auth/permissions'
import AccessDenied     from '@/components/admin/AccessDenied'
import { adminFetch }   from '@/lib/admin/serverFetch'
import OperationsPriorityQueue from '@/components/admin/OperationsPriorityQueue'
import MobilePageHeader from '@/components/admin/MobilePageHeader'
import type { QueueItem } from '@/lib/operations/priorityQueue'

async function getQueue(): Promise<QueueItem[]> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res  = await adminFetch(`${base}/api/admin/operations/queue?pageSize=50`, { cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json() as { data: QueueItem[] }
  return data.data
}

export default async function QueuePage() {
  const auth = await requireAdmin()
  if (!auth.ok || !can(auth.ctx.role, 'incidents:read')) return <AccessDenied />

  const items = await getQueue()

  return (
    <div className="space-y-5">
      <MobilePageHeader title="Priority Queue" subtitle="Operational action items" />

      <div className="hidden lg:block">
        <div className="flex items-center gap-2 mb-1">
          <Link href="/admin/operations" className="text-sm text-on-surface-variant hover:text-primary transition-colors">
            ← Operations
          </Link>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-primary">Priority Queue</h1>
            <p className="text-sm text-on-surface-variant mt-0.5">Manage operational action items, assign owners, track resolution</p>
          </div>
        </div>
      </div>

      <OperationsPriorityQueue initialItems={items} />
    </div>
  )
}
