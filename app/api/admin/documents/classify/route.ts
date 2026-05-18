import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { adminClient } from '@/lib/supabase/admin'
import { routeDocument, type FolderSlug } from '@/lib/documents/routing'
import { logDocumentEvent } from '@/lib/documents/lifecycle'

const BodySchema = z.object({
  documentId: z.string().uuid(),
  folderSlug: z.string(),
  notes:      z.string().optional(),
})

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body   = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', issues: parsed.error.issues }, { status: 400 })
  }

  const { documentId, folderSlug, notes } = parsed.data
  const { companyId, userId } = auth.ctx

  const { data: doc, error: docErr } = await adminClient
    .from('documents')
    .select('id, document_type, folder_id, review_status')
    .eq('id', documentId)
    .eq('company_id', companyId)
    .single()

  if (docErr || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  const { data: folder, error: fErr } = await adminClient
    .from('staff_document_folders')
    .select('id, name, slug')
    .eq('company_id', companyId)
    .eq('slug', folderSlug)
    .single()

  if (fErr || !folder) {
    return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
  }

  const prevValue = { folder_id: doc.folder_id, review_status: doc.review_status }

  await routeDocument({
    documentId,
    documentType: doc.document_type ?? 'other',
    companyId,
    routedBy:    userId,
    manual:      true,
    manualSlug:  folderSlug as FolderSlug,
    notes,
  })

  await adminClient
    .from('documents')
    .update({ review_status: 'manually_classified', requires_manual_review: false })
    .eq('id', documentId)

  await logDocumentEvent({
    companyId,
    documentId,
    event:      'manually_classified',
    actorId:    userId,
    actorType:  'admin',
    actorLabel: userId,
    prevValue,
    newValue:   { folder_id: folder.id, folder_slug: folderSlug, notes },
  })

  return NextResponse.json({ ok: true, folder })
}
