import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { adminClient }   from '@/lib/supabase/admin'
import { getRoutingDiagnostics } from '@/lib/documents/routing'

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const companyId = auth.ctx.companyId

  const [diagnostics, pendingRes, unrecognisedRes] = await Promise.all([
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
      .limit(200),

    adminClient
      .from('documents')
      .select('id, document_type, file_name, source_stage, created_at')
      .eq('company_id', companyId)
      .eq('review_status', 'unrecognised')
      .is('archived_at', null)
      .order('created_at', { ascending: false }),
  ])

  return NextResponse.json({
    diagnostics,
    pending:      pendingRes.data ?? [],
    unrecognised: unrecognisedRes.data ?? [],
  })
}
