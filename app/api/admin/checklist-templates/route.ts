import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/auth/permissions'
import { forbidden } from '@/lib/auth/responses'

// ── GET /api/admin/checklist-templates ───────────────────────────────────────
//
// Lists checklist templates for the caller's company, with item counts.
// Optional query params: ?jobRole=<role>  ?activeOnly=true

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'staff:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const sp        = request.nextUrl.searchParams
  const jobRole   = sp.get('jobRole')
  const activeOnly = sp.get('activeOnly') === 'true'

  let query = adminClient
    .from('checklist_templates')
    .select('id, name, description, job_role, is_active, created_at, updated_at, checklist_template_items(count)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (jobRole)    query = query.eq('job_role', jobRole)
  if (activeOnly) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: 'Failed to fetch checklist templates' }, { status: 500 })
  }

  const templates = (data ?? []).map((t) => ({
    ...t,
    item_count: (t.checklist_template_items as unknown as Array<{ count: number }>)?.[0]?.count ?? 0,
    checklist_template_items: undefined,
  }))

  return NextResponse.json({ data: templates })
}

// ── POST /api/admin/checklist-templates ──────────────────────────────────────
//
// Creates a template with its ordered items in one call.
// Body: { name, description?, job_role?, items: [{ title, description?, category?, is_required?, sort_order? }] }

interface CreateItemInput {
  title:       string
  description?: string
  category?:   string
  is_required?: boolean
  sort_order?: number
}

const ALLOWED_CATEGORIES = new Set(['documentation', 'training', 'meeting', 'task'])

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'staff:write')) return forbidden('Insufficient permissions')
  const { companyId, userId } = auth.ctx

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const b = (body && typeof body === 'object') ? (body as Record<string, unknown>) : {}
  const name        = typeof b.name === 'string' ? b.name.trim() : ''
  const description = typeof b.description === 'string' ? b.description.trim() : null
  const jobRole      = typeof b.job_role === 'string' && b.job_role.trim() ? b.job_role.trim() : null
  const items        = Array.isArray(b.items) ? (b.items as CreateItemInput[]) : []

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 422 })
  }
  if (items.length === 0) {
    return NextResponse.json({ error: 'At least one checklist item is required' }, { status: 422 })
  }
  for (const item of items) {
    if (!item.title || typeof item.title !== 'string' || !item.title.trim()) {
      return NextResponse.json({ error: 'Every item requires a title' }, { status: 422 })
    }
    if (item.category && !ALLOWED_CATEGORIES.has(item.category)) {
      return NextResponse.json({ error: `category must be one of: ${[...ALLOWED_CATEGORIES].join(', ')}` }, { status: 422 })
    }
  }

  const { data: template, error: templateErr } = await adminClient
    .from('checklist_templates')
    .insert({
      company_id:  companyId,
      name,
      description,
      job_role:    jobRole,
      created_by:  userId,
    })
    .select('id, name, description, job_role, is_active, created_at, updated_at')
    .single()

  if (templateErr || !template) {
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }

  const itemRows = items.map((item, i) => ({
    template_id:  template.id,
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
    // Roll back the template so we don't leave an empty/broken one behind
    await adminClient.from('checklist_templates').delete().eq('id', template.id)
    return NextResponse.json({ error: 'Failed to create checklist items' }, { status: 500 })
  }

  void adminClient.from('audit_logs').insert({
    company_id:  companyId,
    actor_id:    userId,
    action:      'checklist_template.created',
    entity_type: 'checklist_template',
    entity_id:   template.id,
    metadata:    { name, job_role: jobRole, item_count: itemRows.length },
  })

  return NextResponse.json(
    { data: { ...template, items: insertedItems ?? [] } },
    { status: 201 }
  )
}
