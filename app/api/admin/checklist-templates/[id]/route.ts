import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/auth/permissions'
import { forbidden } from '@/lib/auth/responses'

const ALLOWED_CATEGORIES = new Set(['documentation', 'training', 'meeting', 'task'])

interface ItemInput {
  title:       string
  description?: string
  category?:   string
  is_required?: boolean
  sort_order?: number
}

// ── GET /api/admin/checklist-templates/[id] ──────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'staff:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const { id } = await params

  const { data: template, error } = await adminClient
    .from('checklist_templates')
    .select('id, name, description, job_role, is_active, created_at, updated_at')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 })
  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

  const { data: items } = await adminClient
    .from('checklist_template_items')
    .select('id, title, description, category, is_required, sort_order')
    .eq('template_id', id)
    .order('sort_order', { ascending: true })

  return NextResponse.json({ data: { ...template, items: items ?? [] } })
}

// ── PATCH /api/admin/checklist-templates/[id] ────────────────────────────────
//
// Body: { name?, description?, job_role?, is_active?, items? }
// If items is provided, it fully replaces the template's item list — this
// only affects future assignments, since staff_checklist_items snapshot
// their own copy at assignment time.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'staff:write')) return forbidden('Insufficient permissions')
  const { companyId, userId } = auth.ctx

  const { id } = await params

  const { data: existing } = await adminClient
    .from('checklist_templates')
    .select('id')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const b = (body && typeof body === 'object') ? (body as Record<string, unknown>) : {}
  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if ('name' in b) {
    const v = typeof b.name === 'string' ? b.name.trim() : ''
    if (!v) return NextResponse.json({ error: 'name cannot be empty' }, { status: 422 })
    updatePayload.name = v
  }
  if ('description' in b) {
    updatePayload.description = typeof b.description === 'string' ? b.description.trim() || null : null
  }
  if ('job_role' in b) {
    updatePayload.job_role = typeof b.job_role === 'string' && b.job_role.trim() ? b.job_role.trim() : null
  }
  if ('is_active' in b) {
    updatePayload.is_active = b.is_active === true
  }

  const items = Array.isArray(b.items) ? (b.items as ItemInput[]) : null
  if (items) {
    for (const item of items) {
      if (!item.title || typeof item.title !== 'string' || !item.title.trim()) {
        return NextResponse.json({ error: 'Every item requires a title' }, { status: 422 })
      }
      if (item.category && !ALLOWED_CATEGORIES.has(item.category)) {
        return NextResponse.json({ error: `category must be one of: ${[...ALLOWED_CATEGORIES].join(', ')}` }, { status: 422 })
      }
    }
  }

  const { data: updated, error: updateErr } = await adminClient
    .from('checklist_templates')
    .update(updatePayload)
    .eq('id', id)
    .select('id, name, description, job_role, is_active, created_at, updated_at')
    .single()

  if (updateErr || !updated) {
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
  }

  let resultItems: unknown[] | null = null
  if (items) {
    await adminClient.from('checklist_template_items').delete().eq('template_id', id)

    const itemRows = items.map((item, i) => ({
      template_id:  id,
      title:        item.title.trim(),
      description:  item.description?.trim() || null,
      category:     item.category ?? 'task',
      is_required:  item.is_required ?? true,
      sort_order:   item.sort_order ?? i,
    }))

    const { data: insertedItems, error: itemsErr } = await adminClient
      .from('checklist_template_items')
      .insert(itemRows)
      .select('id, title, description, category, is_required, sort_order')

    if (itemsErr) {
      return NextResponse.json({ error: 'Failed to update checklist items' }, { status: 500 })
    }
    resultItems = insertedItems
  }

  void adminClient.from('audit_logs').insert({
    company_id:  companyId,
    actor_id:    userId,
    action:      'checklist_template.updated',
    entity_type: 'checklist_template',
    entity_id:   id,
    metadata:    { updated_fields: Object.keys(updatePayload), items_replaced: items !== null },
  })

  return NextResponse.json({ data: { ...updated, ...(resultItems ? { items: resultItems } : {}) } })
}

// ── DELETE /api/admin/checklist-templates/[id] ───────────────────────────────
//
// Safe to delete even if staff already have checklists assigned from it —
// staff_checklists.template_id is ON DELETE SET NULL and the checklist's
// items/name are already snapshotted independently.

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'staff:write')) return forbidden('Insufficient permissions')
  const { companyId, userId } = auth.ctx

  const { id } = await params

  const { data: existing } = await adminClient
    .from('checklist_templates')
    .select('id, name')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

  const { error } = await adminClient.from('checklist_templates').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })

  void adminClient.from('audit_logs').insert({
    company_id:  companyId,
    actor_id:    userId,
    action:      'checklist_template.deleted',
    entity_type: 'checklist_template',
    entity_id:   id,
    metadata:    { name: existing.name },
  })

  return NextResponse.json({ ok: true })
}
