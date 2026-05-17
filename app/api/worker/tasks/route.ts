import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { validateWorkerToken } from '@/lib/worker/auth'

function today()   { return new Date().toISOString().slice(0, 10) }
function in30Days() {
  const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10)
}

export async function GET(request: NextRequest) {
  const token  = request.nextUrl.searchParams.get('token')
  const result = await validateWorkerToken(token)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const { id: staffProfileId, company_id: companyId } = result.worker
  const td   = today()
  const in30 = in30Days()

  // 1. Get worker's visit notes (to find tasks)
  const { data: myNotes } = await adminClient
    .from('visit_notes')
    .select('id, shift_id, arrived_at, submitted_at, shifts!shift_id(id, title, shift_date, start_time, client_name)')
    .eq('staff_profile_id', staffProfileId)
    .eq('company_id', companyId)
    .is('submitted_at', null)
    .order('arrived_at', { ascending: false })
    .limit(20)

  const noteIds = (myNotes ?? []).map(n => n.id)

  // 2. Pending visit task items for those notes
  let visitTasks: unknown[] = []
  if (noteIds.length > 0) {
    const { data } = await adminClient
      .from('visit_task_items')
      .select('id, task_type, task_name, task_description, status, notes, completed_at, sequence_order, visit_note_id')
      .eq('company_id', companyId)
      .eq('status', 'pending')
      .in('visit_note_id', noteIds)
      .order('sequence_order', { ascending: true })
      .limit(50)
    visitTasks = (data ?? []).map(t => {
      const note = (myNotes ?? []).find(n => n.id === t.visit_note_id)
      return { ...t, visit_notes: note ?? null }
    })
  }

  // 3. Documentation tasks — expired or expiring docs
  const { data: docs } = await adminClient
    .from('documents')
    .select('id, document_type, expiry_date, status')
    .eq('staff_profile_id', staffProfileId)
    .eq('company_id', companyId)

  const docTasks = (docs ?? [])
    .filter(d => d.expiry_date && d.expiry_date <= in30)
    .map(d => ({
      id:               `doc-${d.id}`,
      task_type:        'documentation',
      task_name:        `Upload ${(d.document_type as string).replace(/_/g, ' ')}`,
      task_description: (d.expiry_date as string) < td ? 'This document has expired' : 'Expiring within 30 days',
      status:           'pending',
      priority:         (d.expiry_date as string) < td ? 'overdue' : 'upcoming',
      href:             '/worker/documents',
    }))

  // 4. Unacknowledged shifts
  const { data: unackedShifts } = await adminClient
    .from('shifts')
    .select('id, title, shift_date, start_time')
    .eq('assigned_staff_id', staffProfileId)
    .eq('company_id', companyId)
    .is('worker_ack_status', null)
    .gte('shift_date', td)
    .not('status', 'eq', 'cancelled')
    .order('shift_date', { ascending: true })
    .limit(10)

  const ackTasks = (unackedShifts ?? []).map(s => ({
    id:               `ack-${s.id}`,
    task_type:        'acknowledgement',
    task_name:        `Confirm: ${s.title}`,
    task_description: `${new Date(s.shift_date as string).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} at ${(s.start_time as string).slice(0, 5)}`,
    status:           'pending',
    priority:         s.shift_date === td ? 'today' : 'upcoming',
    href:             `/worker/shifts/${s.id}`,
  }))

  return NextResponse.json({
    visit_tasks:   visitTasks,
    doc_tasks:     docTasks,
    ack_tasks:     ackTasks,
    total_pending: (visitTasks as unknown[]).length + docTasks.length + ackTasks.length,
  })
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as {
    token?:    string
    task_id?:  string
    status?:   string
    notes?:    string
  }

  const result = await validateWorkerToken(body.token)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const { company_id: companyId } = result.worker
  if (!body.task_id || !body.status) return NextResponse.json({ error: 'task_id and status required' }, { status: 400 })

  const allowed = ['completed', 'skipped', 'partial', 'refused']
  if (!allowed.includes(body.status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

  const { error } = await adminClient.from('visit_task_items').update({
    status:       body.status,
    notes:        body.notes ?? null,
    completed_at: body.status === 'completed' ? new Date().toISOString() : null,
    updated_at:   new Date().toISOString(),
  }).eq('id', body.task_id).eq('company_id', companyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
