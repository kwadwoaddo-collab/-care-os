import { NextRequest, NextResponse } from 'next/server'
import { adminClient }               from '@/lib/supabase/admin'
import { requireAdmin }              from '@/lib/auth/requireAdmin'
import { can }                       from '@/lib/auth/permissions'
import { forbidden }                 from '@/lib/auth/responses'

const ALLOWED_PATCH = [
  'priority', 'category', 'title', 'description',
  'assigned_to', 'due_date', 'status',
  'escalation_acknowledged_by',
  'resolution_notes',
] as const

// ── PATCH /api/admin/operations/queue/[id] ────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'incidents:write')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx
  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  for (const key of ALLOWED_PATCH) {
    if (key in body) updates[key] = body[key] ?? null
  }

  // Side effects for specific transitions
  if (updates.status === 'resolved') {
    updates.resolved_at = new Date().toISOString()
    if (body.resolved_by) updates.resolved_by = body.resolved_by
  }

  if (updates.assigned_to) {
    updates.assigned_at = new Date().toISOString()
  }

  if (updates.escalation_acknowledged_by) {
    updates.escalation_acknowledged_at = new Date().toISOString()
  }

  const { data, error } = await adminClient
    .from('operations_queue')
    .update(updates)
    .eq('id', id)
    .eq('company_id', companyId)
    .select()
    .single()

  if (error) {
    console.error('[ops-queue] PATCH error:', error.message)
    return NextResponse.json({ error: 'Failed to update queue item' }, { status: 500 })
  }

  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Audit
  try {
    await adminClient.from('audit_logs').insert({
      company_id:  companyId,
      actor_id:    null,
      action:      'operations_queue.updated',
      entity_type: 'operations_queue',
      entity_id:   id,
      metadata:    updates,
    })
  } catch { /* non-critical */ }

  return NextResponse.json(data)
}

// ── DELETE /api/admin/operations/queue/[id] ───────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'incidents:write')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx
  const { id } = await params

  const { error } = await adminClient
    .from('operations_queue')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
