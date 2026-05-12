import { NextRequest, NextResponse } from 'next/server'
import { adminClient }               from '@/lib/supabase/admin'
import {
  calculateCompliance,
  type ComplianceDocument,
} from '@/lib/compliance/calculateCompliance'
import { parseAvailabilityRecord } from '@/lib/staff/types'
import { calculateReadiness }      from '@/lib/staff/calculateReadiness'
import { hasShiftOverlap }         from '@/lib/shifts/hasShiftOverlap'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { sendNotification } from '@/lib/notifications/sendNotification'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

// ── PATCH /api/admin/shifts/[id]/assign ───────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const { id: shiftId } = await params

  let body: { staff_profile_id?: string; staff_profile_ids?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { staff_profile_id, staff_profile_ids } = body
  const isDirectAssign = !!staff_profile_id
  const isBroadcast    = Array.isArray(staff_profile_ids) && staff_profile_ids.length > 0

  if (!isDirectAssign && !isBroadcast) {
    return NextResponse.json({ error: 'Provide staff_profile_id or staff_profile_ids' }, { status: 400 })
  }

  // ── Fetch the target shift ─────────────────────────────────────────────────
  const { data: shift, error: shiftErr } = await adminClient
    .from('shifts')
    .select('id, company_id, title, shift_date, start_time, end_time, shift_type, client_id, client_name, status, assigned_staff_id')
    .eq('id', shiftId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (shiftErr || !shift) {
    return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
  }

  const shiftStatus = shift.status as string
  if (shiftStatus === 'completed' || shiftStatus === 'cancelled' || shiftStatus === 'missed') {
    return NextResponse.json(
      { error: `Cannot assign or offer a ${shiftStatus} shift` },
      { status: 422 }
    )
  }

  const targetStaffIds = isDirectAssign ? [staff_profile_id] : staff_profile_ids

  // ── Validate all staff candidates ──────────────────────────────────────────
  const { data: staffList, error: staffListErr } = await adminClient
    .from('staff_profiles')
    .select('id, company_id, status, applicant_id, first_name, last_name, email, receive_shift_emails')
    .in('id', targetStaffIds!)
    .eq('company_id', companyId)

  if (staffListErr || !staffList || staffList.length !== targetStaffIds!.length) {
    return NextResponse.json({ error: 'One or more staff members not found' }, { status: 404 })
  }

  // Fetch docs for all
  const applicantIds = staffList.map(s => s.applicant_id).filter(Boolean) as string[]
  const [staffDocsRes, appDocsRes, availRes, nearbyShiftsRes] = await Promise.all([
    adminClient.from('documents').select('id, document_type, file_name, expiry_date, staff_profile_id').in('staff_profile_id', targetStaffIds!),
    applicantIds.length > 0 ? adminClient.from('documents').select('id, document_type, file_name, expiry_date, applicant_id').in('applicant_id', applicantIds) : Promise.resolve({ data: [] }),
    adminClient.from('staff_availability').select('*').in('staff_profile_id', targetStaffIds!),
    // Overlap check scope
    (async () => {
      const shiftDate = shift.shift_date as string
      const dateParts = shiftDate.split('-').map(Number) as [number, number, number]
      const baseDay   = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]))
      const dayBefore = new Date(baseDay); dayBefore.setUTCDate(baseDay.getUTCDate() - 1)
      const dayAfter  = new Date(baseDay); dayAfter.setUTCDate(baseDay.getUTCDate() + 1)
      return adminClient
        .from('shifts')
        .select('id, shift_date, start_time, end_time, assigned_staff_id')
        .in('assigned_staff_id', targetStaffIds!)
        .gte('shift_date', dayBefore.toISOString().slice(0, 10))
        .lte('shift_date', dayAfter.toISOString().slice(0, 10))
        .neq('status', 'cancelled')
        .neq('id', shiftId)
    })()
  ])

  const targetSpan = {
    shift_date: shift.shift_date as string,
    start_time: shift.start_time as string,
    end_time:   shift.end_time   as string,
  }

  let complianceWarning = false

  for (const staff of staffList) {
    if (staff.status !== 'active') {
      return NextResponse.json({ error: `Staff ${staff.first_name} must be active to be assigned` }, { status: 422 })
    }

    // Docs
    const docs = [
      ...(staffDocsRes.data?.filter(d => (d as any).staff_profile_id === staff.id) ?? []),
      ...(appDocsRes.data?.filter(d => (d as any).applicant_id === staff.applicant_id) ?? [])
    ] as ComplianceDocument[]

    const compliance = calculateCompliance(docs)

    // Readiness
    const availRaw = availRes.data?.find(a => (a as any).staff_profile_id === staff.id)
    const availability = availRaw ? parseAvailabilityRecord(staff.id, availRaw as Record<string, unknown>) : null
    const readiness = calculateReadiness(staff.status, compliance.compliant, availability)

    if (!readiness.ready) {
      return NextResponse.json({
        error:    `Staff ${staff.first_name} is not ready — resolve compliance or availability issues first`,
        blockers: readiness.blockers,
        warnings: readiness.warnings,
      }, { status: 422 })
    }

    // Overlaps
    const existingSpans = (nearbyShiftsRes.data ?? [])
      .filter(s => (s as any).assigned_staff_id === staff.id)
      .map((s) => ({
        shift_date: s.shift_date as string,
        start_time: s.start_time as string,
        end_time:   s.end_time   as string,
      }))

    if (hasShiftOverlap(targetSpan, existingSpans)) {
      return NextResponse.json({ error: `Staff ${staff.first_name} has an overlapping shift` }, { status: 422 })
    }

    const now = Date.now()
    const expSoon = docs.some(d => {
      if (!d.expiry_date) return false
      const exp = new Date(d.expiry_date).getTime()
      return exp > now && exp - now <= SEVEN_DAYS_MS
    })
    if (expSoon) complianceWarning = true
  }

  // ── Apply Assignment / Offers ──────────────────────────────────────────────
  let updatedShift
  if (isDirectAssign) {
    // Direct assignment -> 'accepted'
    const { data: updated, error: updateErr } = await adminClient
      .from('shifts')
      .update({
        assigned_staff_id: staff_profile_id,
        status:            'accepted',
        updated_at:        new Date().toISOString(),
      })
      .eq('id', shiftId)
      .eq('company_id', companyId)
      .select()
      .single()

    if (updateErr) return NextResponse.json({ error: 'Failed to assign shift', supabase_message: updateErr.message }, { status: 500 })
    updatedShift = updated
  } else {
    // Broadcast offers -> 'offered', clear assigned_staff_id
    const { data: updated, error: updateErr } = await adminClient
      .from('shifts')
      .update({
        assigned_staff_id: null,
        status:            'offered',
        updated_at:        new Date().toISOString(),
      })
      .eq('id', shiftId)
      .eq('company_id', companyId)
      .select()
      .single()

    if (updateErr) return NextResponse.json({ error: 'Failed to update shift', supabase_message: updateErr.message }, { status: 500 })
    updatedShift = updated

    // Clear existing pending offers
    await adminClient.from('shift_offers').update({ status: 'expired' }).eq('shift_id', shiftId).eq('status', 'pending')

    // Create new offers
    const offersToInsert = staffList.map(s => ({
      shift_id: shiftId,
      staff_profile_id: s.id,
      status: 'pending'
    }))
    await adminClient.from('shift_offers').insert(offersToInsert)
  }

  // ── Notifications ────────────────────────────────────────────────────────
  void (async () => {
    try {
      await adminClient.from('audit_logs').insert({
        company_id:  companyId,
        actor_id:    null,
        action:      isDirectAssign ? 'shift.assigned' : 'shift.offered',
        entity_type: 'shift',
        entity_id:   shiftId,
        metadata:    { targetStaffIds }
      })
    } catch { /* ignore */ }

    const portalLink = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/worker/dashboard`
    for (const staff of staffList) {
      const receiveEmails = staff.receive_shift_emails ?? true
      if (staff.email && receiveEmails) {
        await sendNotification({
          type:           isDirectAssign ? 'shift.assigned' : 'shift.offered', // you might need to add shift.offered to types
          companyId,
          entityId:       shiftId,
          recipientEmail: staff.email,
          data: {
            companyName: '',
            workerName:  [staff.first_name, staff.last_name].filter(Boolean).join(' ') || 'Worker',
            shiftTitle:  shift.title    as string,
            shiftDate:   shift.shift_date as string,
            startTime:   (shift.start_time as string).slice(0, 5),
            endTime:     (shift.end_time   as string).slice(0, 5),
            clientName:  shift.client_id ? null : (shift.client_name as string | null),
            location:    null,
            portalLink,
          },
        }).catch(() => {})
      }
    }
  })()

  if (complianceWarning) {
    return NextResponse.json({ ...updatedShift, compliance_warning: { message: 'One or more compliance documents expire within 7 days' } })
  }

  return NextResponse.json(updatedShift)
}
