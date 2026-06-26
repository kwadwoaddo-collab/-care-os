import { requireAdmin } from '@/lib/auth/requireAdmin'
import { adminClient }   from '@/lib/supabase/admin'
import { getRoutingDiagnostics } from '@/lib/documents/routing'
import RoutingReviewClient from './RoutingReviewClient'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function DocumentRoutingPage() {
  const auth = await requireAdmin()
  if (!auth.ok) return null

  const { companyId } = auth.ctx

  const [diagnostics, pendingRes, foldersRes] = await Promise.all([
    getRoutingDiagnostics(companyId),

    adminClient
      .from('documents')
      .select(`
        id, document_type, file_name, original_filename, mime_type,
        source_stage, review_status, requires_manual_review,
        created_at, applicant_id, staff_profile_id, folder_id,
        staff_document_folders ( id, name, slug )
      `)
      .eq('company_id', companyId)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(300),

    adminClient
      .from('staff_document_folders')
      .select('id, name, slug, sort_order')
      .eq('company_id', companyId)
      .neq('slug', 'archive')
      .order('sort_order', { ascending: true }),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pending = (pendingRes.data ?? []) as any as Parameters<typeof RoutingReviewClient>[0]['pending']
  const folders      = foldersRes.data ?? []
  const unrecognised = pending.filter((d) => d.review_status === 'unrecognised')

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Document Routing</h1>
          <p className="text-sm text-gray-500 mt-1">
            Review and manage automatic document classification across all staff folders.
          </p>
        </div>
        <Link
          href="/admin/staff"
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors"
        >
          <span className="material-symbols-outlined text-[14px]">arrow_back</span>
          Back to staff
        </Link>
      </div>

      <RoutingReviewClient
        diagnostics={diagnostics}
        pending={pending}
        unrecognised={unrecognised}
        folders={folders}
      />
    </div>
  )
}
