import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { adminClient } from '@/lib/supabase/admin'

const BodySchema = z.object({
  documentId: z.string().uuid(),
  folderId:   z.string().uuid().nullable(),  // null = move to unclassified
})

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId, userId } = auth.ctx

  const body   = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', issues: parsed.error.issues }, { status: 400 })
  }

  const { documentId, folderId } = parsed.data

  // Verify document belongs to company
  const { data: doc } = await adminClient
    .from('documents')
    .select('id, folder_id, document_type')
    .eq('id', documentId)
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  // Verify target folder belongs to company (if specified)
  if (folderId) {
    const { data: folder } = await adminClient
      .from('staff_document_folders')
      .select('id, name')
      .eq('id', folderId)
      .eq('company_id', companyId)
      .maybeSingle()

    if (!folder) return NextResponse.json({ error: 'Target folder not found' }, { status: 404 })
  }

  const { error } = await adminClient
    .from('documents')
    .update({
      folder_id:     folderId,
      review_status: folderId ? 'manually_classified' : 'unrecognised',
      requires_manual_review: !folderId,
    })
    .eq('id', documentId)
    .eq('company_id', companyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Audit log
  await adminClient.from('document_audit_log').insert({
    company_id:   companyId,
    document_id:  documentId,
    event:        'manually_classified',
    actor_type:   'admin',
    actor_label:  userId,
    previous_value: { folder_id: doc.folder_id },
    new_value:      { folder_id: folderId },
  })

  await adminClient.from('audit_logs').insert({
    company_id:  companyId,
    actor_id:    userId,
    action:      'document.moved',
    entity_type: 'document',
    entity_id:   documentId,
    metadata:    { from_folder_id: doc.folder_id, to_folder_id: folderId },
  })

  return NextResponse.json({ ok: true })
}
