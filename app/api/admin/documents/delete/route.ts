import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { adminClient } from '@/lib/supabase/admin'

// Permanent deletion is restricted to roles with delete permission.
// Preferred path: archive first. Permanent delete is only allowed
// when the document is already archived or from the Archive folder.

const BodySchema = z.object({
  documentId:      z.string().uuid(),
  confirm:         z.literal(true),   // caller must explicitly pass confirm: true
  deleteFromStorage: z.boolean().optional().default(false),
})

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId, userId, role } = auth.ctx

  // Only registered_manager / company_admin / super_admin may permanently delete
  const allowedRoles = new Set(['registered_manager', 'company_admin', 'super_admin'])
  if (!allowedRoles.has(role ?? '')) {
    return NextResponse.json({ error: 'Insufficient permissions to permanently delete documents' }, { status: 403 })
  }

  const body   = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request — confirm:true is required', issues: parsed.error.issues }, { status: 400 })
  }

  const { documentId, deleteFromStorage } = parsed.data

  // Fetch document — must belong to company and be archived or in Archive folder
  const { data: doc } = await adminClient
    .from('documents')
    .select(`
      id, file_path, document_type, archived_at, folder_id,
      staff_document_folders ( slug )
    `)
    .eq('id', documentId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  const folderSlug = (doc.staff_document_folders as { slug?: string } | null)?.slug
  const isArchived   = !!doc.archived_at
  const isInArchive  = folderSlug === 'archive'

  if (!isArchived && !isInArchive) {
    return NextResponse.json({
      error: 'Document must be archived first before permanent deletion. Use POST /api/admin/documents/archive.',
    }, { status: 422 })
  }

  // Audit log BEFORE deletion so the record can reference the document
  await adminClient.from('document_audit_log').insert({
    company_id:  companyId,
    document_id: documentId,
    event:       'deleted',
    actor_type:  'admin',
    actor_label: userId,
    metadata: {
      file_path:          doc.file_path,
      document_type:      doc.document_type,
      delete_from_storage: deleteFromStorage,
    },
  })

  await adminClient.from('audit_logs').insert({
    company_id:  companyId,
    actor_id:    userId,
    action:      'document.permanently_deleted',
    entity_type: 'document',
    entity_id:   documentId,
    metadata: {
      file_path:     doc.file_path,
      document_type: doc.document_type,
    },
  })

  // Optionally delete from storage
  if (deleteFromStorage && doc.file_path) {
    const { error: storageErr } = await adminClient.storage
      .from('care-os-documents')
      .remove([doc.file_path])

    if (storageErr) {
      console.warn('[delete] Storage removal failed (continuing with DB delete):', storageErr.message)
    }
  }

  // Soft-delete: set deleted_at
  const { error } = await adminClient
    .from('documents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', documentId)
    .eq('company_id', companyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
