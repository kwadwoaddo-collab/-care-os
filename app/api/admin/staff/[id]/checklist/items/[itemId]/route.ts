import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/auth/permissions'
import { forbidden } from '@/lib/auth/responses'

// ── PATCH /api/admin/staff/[id]/checklist/items/[itemId] ─────────────────────
//
// Toggles a checklist item's completion, and rolls the parent
// staff_checklists.completed_at up/down when all/not-all items are done.
// Body: { is_complete, notes? }

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'staff:write')) return forbidden('Insufficient permissions')
  const { companyId, userId } = auth.ctx

  const { id: staffProfileId, itemId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const b = (body && typeof body === 'object') ? (body as Record<string, unknown>) : {}
  if (!('is_complete' in b) && !('notes' in b)) {
    return NextResponse.json({ error: 'is_complete or notes is required' }, { status: 422 })
  }

  // Verify the item belongs to a checklist owned by this staff member and company
  const { data: item } = await adminClient
    .from('staff_checklist_items')
    .select('id, staff_checklist_id, staff_checklists!inner(id, staff_profile_id, company_id)')
    .eq('id', itemId)
    .maybeSingle()

  const parentChecklist = item?.staff_checklists as unknown as { id: string; staff_profile_id: string; company_id: string } | undefined

  if (!item || !parentChecklist || parentChecklist.staff_profile_id !== staffProfileId || parentChecklist.company_id !== companyId) {
    return NextResponse.json({ error: 'Checklist item not found' }, { status: 404 })
  }

  const updatePayload: Record<string, unknown> = {}
  if ('is_complete' in b) {
    const isComplete = b.is_complete === true
    updatePayload.is_complete  = isComplete
    updatePayload.completed_at = isComplete ? new Date().toISOString() : null
    updatePayload.completed_by = isComplete ? userId : null
  }
  if ('notes' in b) {
    updatePayload.notes = typeof b.notes === 'string' ? b.notes.trim() || null : null
  }

  const { data: updated, error: updateErr } = await adminClient
    .from('staff_checklist_items')
    .update(updatePayload)
    .eq('id', itemId)
    .select('id, title, description, category, is_required, sort_order, is_complete, completed_at, notes')
    .single()

  if (updateErr || !updated) {
    return NextResponse.json({ error: 'Failed to update checklist item' }, { status: 500 })
  }

  // Roll the parent checklist's completed_at up/down based on all items' state
  const { data: siblingItems } = await adminClient
    .from('staff_checklist_items')
    .select('is_complete')
    .eq('staff_checklist_id', parentChecklist.id)

  const allComplete = (siblingItems ?? []).length > 0 && (siblingItems ?? []).every((i) => i.is_complete)

  const { data: checklist } = await adminClient
    .from('staff_checklists')
    .select('completed_at')
    .eq('id', parentChecklist.id)
    .maybeSingle()

  if (allComplete && !checklist?.completed_at) {
    await adminClient.from('staff_checklists').update({ completed_at: new Date().toISOString() }).eq('id', parentChecklist.id)
  } else if (!allComplete && checklist?.completed_at) {
    await adminClient.from('staff_checklists').update({ completed_at: null }).eq('id', parentChecklist.id)
  }

  void adminClient.from('audit_logs').insert({
    company_id:  companyId,
    actor_id:    userId,
    action:      'staff_checklist_item.updated',
    entity_type: 'staff_profile',
    entity_id:   staffProfileId,
    metadata:    { item_id: itemId, title: updated.title, is_complete: updated.is_complete },
  })

  return NextResponse.json({ data: updated })
}
