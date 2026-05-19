import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { adminClient } from '@/lib/supabase/admin'

// ── PATCH /api/admin/documents/folders/[id] ───────────────────────────────────
// Rename or reorder a custom folder. System folders are protected.

const UpdateSchema = z.object({
  name:        z.string().min(2).max(80).optional(),
  icon:        z.string().max(40).optional(),
  colour:      z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  description: z.string().max(200).optional(),
  sort_order:  z.number().int().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId, userId } = auth.ctx

  const { id } = await params

  const { data: folder } = await adminClient
    .from('staff_document_folders')
    .select('id, name, is_system')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!folder) return NextResponse.json({ error: 'Folder not found' }, { status: 404 })

  if (folder.is_system) {
    return NextResponse.json({ error: 'System folders cannot be modified' }, { status: 403 })
  }

  const body   = await req.json().catch(() => null)
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', issues: parsed.error.issues }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (parsed.data.name        !== undefined) updates.name        = parsed.data.name
  if (parsed.data.icon        !== undefined) updates.icon        = parsed.data.icon
  if (parsed.data.colour      !== undefined) updates.colour      = parsed.data.colour
  if (parsed.data.description !== undefined) updates.description = parsed.data.description
  if (parsed.data.sort_order  !== undefined) updates.sort_order  = parsed.data.sort_order

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data: updated, error } = await adminClient
    .from('staff_document_folders')
    .update(updates)
    .eq('id', id)
    .eq('company_id', companyId)
    .select('id, name, slug, sort_order, icon, colour, description, is_system, is_custom')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await adminClient.from('audit_logs').insert({
    company_id:  companyId,
    actor_id:    userId,
    action:      'document_folder.renamed',
    entity_type: 'staff_document_folder',
    entity_id:   id,
    metadata:    { previous_name: folder.name, updates },
  })

  return NextResponse.json({ folder: updated })
}

// ── DELETE /api/admin/documents/folders/[id] ──────────────────────────────────
// Archives a custom folder (soft delete). System folders are protected.
// Documents inside are moved to unclassified (folder_id = null) unless
// the query param `move_to_archive=true` is set.

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId, userId } = auth.ctx

  const { id } = await params
  const moveToArchive = new URL(req.url).searchParams.get('move_to_archive') === 'true'

  const { data: folder } = await adminClient
    .from('staff_document_folders')
    .select('id, name, is_system')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!folder) return NextResponse.json({ error: 'Folder not found' }, { status: 404 })

  if (folder.is_system) {
    return NextResponse.json({ error: 'System folders cannot be archived' }, { status: 403 })
  }

  // Resolve archive folder id if requested
  let archiveFolderId: string | null = null
  if (moveToArchive) {
    const { data: archiveFolder } = await adminClient
      .from('staff_document_folders')
      .select('id')
      .eq('company_id', companyId)
      .eq('slug', 'archive')
      .maybeSingle()
    archiveFolderId = archiveFolder?.id ?? null
  }

  // Move documents out of this folder
  const { error: moveErr } = await adminClient
    .from('documents')
    .update({ folder_id: archiveFolderId })
    .eq('folder_id', id)
    .eq('company_id', companyId)

  if (moveErr) return NextResponse.json({ error: moveErr.message }, { status: 500 })

  // Soft-archive the folder
  const { error: archiveErr } = await adminClient
    .from('staff_document_folders')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', companyId)

  if (archiveErr) return NextResponse.json({ error: archiveErr.message }, { status: 500 })

  await adminClient.from('audit_logs').insert({
    company_id:  companyId,
    actor_id:    userId,
    action:      'document_folder.archived',
    entity_type: 'staff_document_folder',
    entity_id:   id,
    metadata:    { folder_name: folder.name, move_to_archive: moveToArchive },
  })

  return NextResponse.json({ ok: true })
}
