import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin }       from '@/lib/auth/requireAdmin'
import { adminClient }        from '@/lib/supabase/admin'
import { approveDocument }    from '@/lib/documents/verification'
import { archiveDocument }    from '@/lib/documents/lifecycle'
import { routeDocument }      from '@/lib/documents/routing'

const BodySchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1).max(100),
  action:      z.enum(['approve', 'archive', 'set_visibility', 'set_worker_visible', 'route']),
  // action-specific
  visibility:     z.enum(['worker_visible','management_only','compliance_only','confidential']).optional(),
  workerVisible:  z.boolean().optional(),
  folderSlug:     z.string().optional(),
})

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body   = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', issues: parsed.error.issues }, { status: 400 })
  }

  const { documentIds, action } = parsed.data
  const { companyId, userId }   = auth.ctx

  // Verify all docs belong to this company
  const { data: docs } = await adminClient
    .from('documents')
    .select('id, document_type, staff_profile_id')
    .in('id', documentIds)
    .eq('company_id', companyId)

  const validIds = new Set((docs ?? []).map((d) => d.id))
  const allowed  = documentIds.filter((id) => validIds.has(id))

  if (allowed.length === 0) {
    return NextResponse.json({ error: 'No valid documents found' }, { status: 404 })
  }

  const results = { ok: 0, failed: 0 }

  if (action === 'approve') {
    for (const docId of allowed) {
      const doc = (docs ?? []).find((d) => d.id === docId)
      const res = await approveDocument({
        documentId:     docId,
        companyId,
        approvedBy:     userId,
        staffProfileId: doc?.staff_profile_id ?? undefined,
      })
      res.ok ? results.ok++ : results.failed++
    }

  } else if (action === 'archive') {
    for (const docId of allowed) {
      await archiveDocument({ documentId: docId, companyId, archivedBy: userId })
      results.ok++
    }

  } else if (action === 'set_visibility' && parsed.data.visibility) {
    const { error } = await adminClient
      .from('documents')
      .update({ visibility: parsed.data.visibility })
      .in('id', allowed)
      .eq('company_id', companyId)
    error ? (results.failed = allowed.length) : (results.ok = allowed.length)

  } else if (action === 'set_worker_visible' && parsed.data.workerVisible !== undefined) {
    const { error } = await adminClient
      .from('documents')
      .update({ worker_visible: parsed.data.workerVisible })
      .in('id', allowed)
      .eq('company_id', companyId)
    error ? (results.failed = allowed.length) : (results.ok = allowed.length)

  } else if (action === 'route') {
    for (const docId of allowed) {
      const doc = (docs ?? []).find((d) => d.id === docId)
      await routeDocument({
        documentId:   docId,
        documentType: doc?.document_type ?? 'other',
        companyId,
        routedBy:     userId,
      })
      results.ok++
    }
  }

  return NextResponse.json({ ...results, ok: true, total: allowed.length })
}
