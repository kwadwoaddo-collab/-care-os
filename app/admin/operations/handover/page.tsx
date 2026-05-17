import Link            from 'next/link'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can }          from '@/lib/auth/permissions'
import AccessDenied     from '@/components/admin/AccessDenied'
import { adminFetch }   from '@/lib/admin/serverFetch'
import OperationsHandoverForm from '@/components/admin/OperationsHandoverForm'
import MobilePageHeader from '@/components/admin/MobilePageHeader'
import type { HandoverNote } from '@/lib/operations/priorityQueue'

async function getHandoverNotes(): Promise<HandoverNote[]> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const res  = await adminFetch(`${base}/api/admin/operations/handover?limit=20`, { cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json() as { data: HandoverNote[] }
  return data.data
}

export default async function HandoverPage() {
  const auth = await requireAdmin()
  if (!auth.ok || !can(auth.ctx.role, 'incidents:read')) return <AccessDenied />

  const notes = await getHandoverNotes()

  return (
    <div className="space-y-5">
      <MobilePageHeader title="Handover Notes" subtitle="Shift-to-shift coordination" />

      <div className="hidden lg:block">
        <div className="flex items-center gap-2 mb-1">
          <Link href="/admin/operations" className="text-sm text-on-surface-variant hover:text-primary transition-colors">
            ← Operations
          </Link>
        </div>
        <div>
          <h1 className="text-xl font-semibold text-primary">Handover Notes</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Record open issues, follow-up actions, and context for the incoming coordinator
          </p>
        </div>
      </div>

      <OperationsHandoverForm initialNotes={notes} />
    </div>
  )
}
