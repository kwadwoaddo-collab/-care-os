import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const { id: shiftId } = await params

  const { data: shift, error: shiftErr } = await adminClient
    .from('shifts')
    .select('id, company_id, assigned_staff_id, status, shift_date')
    .eq('id', shiftId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (shiftErr || !shift) {
    return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
  }

  if (!shift.assigned_staff_id) {
    return NextResponse.json({ error: 'Shift is not currently assigned' }, { status: 422 })
  }

  const shiftStatus = shift.status as string
  if (shiftStatus === 'completed' || shiftStatus === 'cancelled') {
    return NextResponse.json(
      { error: `Cannot unassign a ${shiftStatus} shift` },
      { status: 422 }
    )
  }

  // When unassigning an accepted shift, revert to open (unassigned pool)
  const newStatus = shiftStatus === 'accepted' ? 'open' : (shiftStatus === 'in_progress' ? 'open' : shiftStatus)
  const previousStaffId  = shift.assigned_staff_id as string

  const { data: updated, error: updateErr } = await adminClient
    .from('shifts')
    .update({
      assigned_staff_id: null,
      status:            newStatus,
      updated_at:        new Date().toISOString(),
    })
    .eq('id', shiftId)
    .eq('company_id', companyId)
    .select()
    .single()

  if (updateErr || !updated) {
    console.error('[shift/unassign] update error:', updateErr?.message)
    return NextResponse.json({ error: 'Failed to unassign shift' }, { status: 500 })
  }

  void (async () => {
    try {
      await adminClient.from('audit_logs').insert({
        company_id:  shift.company_id,
        actor_id:    null,
        action:      'shift.unassigned',
        entity_type: 'shift',
        entity_id:   shiftId,
        metadata: {
          previous_staff_id: previousStaffId,
          previous_status:   shiftStatus,
          new_status:        newStatus,
          shift_date:        shift.shift_date,
          timestamp:         new Date().toISOString(),
        },
      })
    } catch (err) {
      console.error('[shift/unassign] audit log error:', err)
    }
  })()

  return NextResponse.json({ shift: updated })
}
