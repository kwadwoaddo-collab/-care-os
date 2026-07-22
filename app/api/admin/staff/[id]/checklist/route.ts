import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/auth/permissions'
import { forbidden } from '@/lib/auth/responses'

// ── GET /api/admin/staff/[id]/checklist ──────────────────────────────────────
//
// Lists every checklist assigned to this staff member, each with its items
// and computed progress.

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'staff:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const { id: staffProfileId } = await params

  const { data: staffProfile } = await adminClient
    .from('staff_profiles')
    .select('id')
    .eq('id', staffProfileId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!staffProfile) return NextResponse.json({ error: 'Staff profile not found' }, { status: 404 })

  const { data: checklists, error } = await adminClient
    .from('staff_checklists')
    .select('id, template_id, template_name, assigned_at, completed_at, staff_checklist_items(id, title, description, category, is_required, sort_order, is_complete, completed_at, notes)')
    .eq('staff_profile_id', staffProfileId)
    .order('assigned_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Failed to fetch checklists' }, { status: 500 })

  const data = (checklists ?? []).map((c) => {
    const items = ((c.staff_checklist_items as unknown as Array<{ is_complete: boolean; sort_order: number }>) ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
    const total = items.length
    const done  = items.filter((i) => i.is_complete).length

    return {
      ...c,
      staff_checklist_items: items,
      progress: total > 0 ? Math.round((done / total) * 100) : 0,
    }
  })

  return NextResponse.json({ data })
}

// ── POST /api/admin/staff/[id]/checklist ─────────────────────────────────────
//
// Assigns a template to this staff member — instantiates a staff_checklists
// row and snapshots each template item into staff_checklist_items.
// Body: { template_id }

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'staff:write')) return forbidden('Insufficient permissions')
  const { companyId, userId } = auth.ctx

  const { id: staffProfileId } = await params

  const { data: staffProfile } = await adminClient
    .from('staff_profiles')
    .select('id')
    .eq('id', staffProfileId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!staffProfile) return NextResponse.json({ error: 'Staff profile not found' }, { status: 404 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const b = (body && typeof body === 'object') ? (body as Record<string, unknown>) : {}
  const templateId = typeof b.template_id === 'string' ? b.template_id : ''

  if (!templateId) {
    return NextResponse.json({ error: 'template_id is required' }, { status: 422 })
  }

  const { data: template } = await adminClient
    .from('checklist_templates')
    .select('id, name')
    .eq('id', templateId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

  const { data: templateItems } = await adminClient
    .from('checklist_template_items')
    .select('id, title, description, category, is_required, sort_order')
    .eq('template_id', templateId)
    .order('sort_order', { ascending: true })

  if (!templateItems || templateItems.length === 0) {
    return NextResponse.json({ error: 'Template has no items to assign' }, { status: 422 })
  }

  const { data: checklist, error: checklistErr } = await adminClient
    .from('staff_checklists')
    .insert({
      company_id:       companyId,
      staff_profile_id: staffProfileId,
      template_id:      template.id,
      template_name:    template.name,
      assigned_by:      userId,
    })
    .select('id, template_id, template_name, assigned_at, completed_at')
    .single()

  if (checklistErr || !checklist) {
    return NextResponse.json({ error: 'Failed to assign checklist' }, { status: 500 })
  }

  const itemRows = templateItems.map((item) => ({
    staff_checklist_id: checklist.id,
    template_item_id:   item.id,
    title:               item.title,
    description:         item.description,
    category:            item.category,
    is_required:         item.is_required,
    sort_order:          item.sort_order,
  }))

  const { data: insertedItems, error: itemsErr } = await adminClient
    .from('staff_checklist_items')
    .insert(itemRows)
    .select('id, title, description, category, is_required, sort_order, is_complete, completed_at, notes')

  if (itemsErr) {
    await adminClient.from('staff_checklists').delete().eq('id', checklist.id)
    return NextResponse.json({ error: 'Failed to assign checklist items' }, { status: 500 })
  }

  void adminClient.from('audit_logs').insert({
    company_id:  companyId,
    actor_id:    userId,
    action:      'staff_checklist.assigned',
    entity_type: 'staff_profile',
    entity_id:   staffProfileId,
    metadata:    { template_id: template.id, template_name: template.name, item_count: itemRows.length },
  })

  return NextResponse.json(
    { data: { ...checklist, staff_checklist_items: insertedItems ?? [], progress: 0 } },
    { status: 201 }
  )
}
