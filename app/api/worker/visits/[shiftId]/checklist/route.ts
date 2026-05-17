import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { validateWorkerToken } from '@/lib/worker/auth'

// GET — fetch checklist items for a visit
export async function GET(req: NextRequest, { params }: { params: Promise<{ shiftId: string }> }) {
  const token  = req.nextUrl.searchParams.get('token')
  const result = await validateWorkerToken(token)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const { id: staffProfileId, company_id: companyId } = result.worker
  const { shiftId } = await params

  // Verify shift ownership
  const { data: shift } = await adminClient.from('shifts').select('assigned_staff_id').eq('id', shiftId).eq('company_id', companyId).maybeSingle()
  if (!shift || shift.assigned_staff_id !== staffProfileId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: note } = await adminClient.from('visit_notes').select('id').eq('shift_id', shiftId).eq('company_id', companyId).maybeSingle()
  if (!note) return NextResponse.json({ tasks: [] })

  const { data: tasks } = await adminClient
    .from('visit_task_items')
    .select('id, task_type, task_name, task_description, status, refused_reason, notes, completed_at, sequence_order')
    .eq('visit_note_id', note.id)
    .eq('company_id', companyId)
    .order('sequence_order', { ascending: true })

  return NextResponse.json({ tasks: tasks ?? [], visit_note_id: note.id })
}

// POST — add a task item
export async function POST(req: NextRequest, { params }: { params: Promise<{ shiftId: string }> }) {
  const body   = await req.json().catch(() => ({})) as { token?: string; task_type?: string; task_name?: string; task_description?: string; sequence_order?: number }
  const result = await validateWorkerToken(body.token)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const { id: staffProfileId, company_id: companyId } = result.worker
  const { shiftId } = await params

  if (!body.task_name) return NextResponse.json({ error: 'task_name required' }, { status: 400 })

  // Ensure visit note exists
  let { data: note } = await adminClient.from('visit_notes').select('id').eq('shift_id', shiftId).eq('company_id', companyId).maybeSingle()
  if (!note) {
    const { data: inserted } = await adminClient.from('visit_notes').insert({ company_id: companyId, shift_id: shiftId, staff_profile_id: staffProfileId, status: 'draft', arrived_at: new Date().toISOString() }).select('id').single()
    note = inserted
  }

  const { data: task, error } = await adminClient.from('visit_task_items').insert({
    visit_note_id:    note!.id,
    company_id:       companyId,
    shift_id:         shiftId,
    task_type:        body.task_type ?? 'care',
    task_name:        body.task_name.slice(0, 200),
    task_description: body.task_description ?? null,
    sequence_order:   body.sequence_order ?? 0,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task }, { status: 201 })
}

// PATCH — update task status
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ shiftId: string }> }) {
  const body   = await req.json().catch(() => ({})) as { token?: string; task_id?: string; status?: string; refused_reason?: string; notes?: string }
  const result = await validateWorkerToken(body.token)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const { id: staffProfileId, company_id: companyId } = result.worker
  const { shiftId } = await params

  if (!body.task_id || !body.status) return NextResponse.json({ error: 'task_id and status required' }, { status: 400 })

  const allowed = ['completed', 'skipped', 'partial', 'refused', 'pending']
  if (!allowed.includes(body.status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

  const now = new Date().toISOString()
  const { error } = await adminClient.from('visit_task_items').update({
    status:          body.status,
    refused_reason:  body.refused_reason ?? null,
    notes:           body.notes ?? null,
    completed_at:    body.status === 'completed' ? now : null,
    completed_by:    body.status === 'completed' ? staffProfileId : null,
    updated_at:      now,
  }).eq('id', body.task_id).eq('company_id', companyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
