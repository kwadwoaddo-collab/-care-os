import { NextRequest, NextResponse } from 'next/server'
import { adminClient }               from '@/lib/supabase/admin'
import {
  calculateCompliance,
  type ComplianceDocument,
} from '@/lib/compliance/calculateCompliance'
import { parseAvailabilityRecord } from '@/lib/staff/types'
import { calculateReadiness }      from '@/lib/staff/calculateReadiness'
import { hasShiftOverlap }         from '@/lib/shifts/hasShiftOverlap'
import { explainShiftBlock }       from '@/lib/compliance/explainability'
import { requireAdmin }            from '@/lib/auth/requireAdmin'
import { sendNotification }        from '@/lib/notifications/sendNotification'
import { createNotification }      from '@/lib/notifications/createNotification'
import { checkRestPeriod, checkConsecutiveDays } from '@/lib/scheduling/restPeriod'
import type { ShiftSpan }          from '@/lib/shifts/hasShiftOverlap'

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
    .select('id, company_id, status, applicant_id, first_name, last_name, email, receive_shift_emails, job_role')
    .in('id', targetStaffIds!)
    .eq('company_id', companyId)

  if (staffListErr || !staffList || staffList.length !== targetStaffIds!.length) {
    return NextResponse.json({ error: 'One or more staff members not found' }, { status: 404 })
  }

  // Fetch docs for all
  const applicantIds = staffList.map(s => s.applicant_id).filter(Boolean) as string[]

  const shiftDateStr  = shift.shift_date as string
  const sdParts       = shiftDateStr.split('-').map(Number) as [number, number, number]
  const shiftBaseDay  = new Date(Date.UTC(sdParts[0], sdParts[1] - 1, sdParts[2]))
  const overlapBefore = new Date(shiftBaseDay); overlapBefore.setUTCDate(shiftBaseDay.getUTCDate() - 1)
  const overlapAfter  = new Date(shiftBaseDay); overlapAfter.setUTCDate(shiftBaseDay.getUTCDate() + 1)
  // 7-day window for consecutive days and rest period checks
  const fatigueBefore = new Date(shiftBaseDay); fatigueBefore.setUTCDate(shiftBaseDay.getUTCDate() - 7)
  const fatigueAfter  = new Date(shiftBaseDay); fatigueAfter.setUTCDate(shiftBaseDay.getUTCDate() + 2)

  const [staffDocsRes, appDocsRes, availRes, nearbyShiftsRes, fatigueShiftsRes] = await Promise.all([
    adminClient.from('documents').select('id, document_type, file_name, expiry_date, staff_profile_id').in('staff_profile_id', targetStaffIds!),
    applicantIds.length > 0 ? adminClient.from('documents').select('id, document_type, file_name, expiry_date, applicant_id').in('applicant_id', applicantIds) : Promise.resolve({ data: [] }),
    adminClient.from('staff_availability').select('*').in('staff_profile_id', targetStaffIds!),
    // ±1 day for overlap
    adminClient
      .from('shifts')
      .select('id, shift_date, start_time, end_time, assigned_staff_id')
      .in('assigned_staff_id', targetStaffIds!)
      .gte('shift_date', overlapBefore.toISOString().slice(0, 10))
      .lte('shift_date', overlapAfter.toISOString().slice(0, 10))
      .neq('status', 'cancelled')
      .neq('id', shiftId),
    // 7-day window for fatigue checks
    adminClient
      .from('shifts')
      .select('shift_date, start_time, end_time, assigned_staff_id')
      .in('assigned_staff_id', targetStaffIds!)
      .gte('shift_date', fatigueBefore.toISOString().slice(0, 10))
      .lte('shift_date', fatigueAfter.toISOString().slice(0, 10))
      .neq('status', 'cancelled')
      .neq('id', shiftId),
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
    ] as unknown as ComplianceDocument[]

    const compliance = calculateCompliance(docs, (staff as { job_role?: string | null }).job_role ?? null)

    // Check for active compliance override (allows blocked staff to be assigned)
    const nowIso = new Date().toISOString()
    const { data: activeOverride } = await adminClient
      .from('compliance_overrides')
      .select('id, reason, expires_at')
      .eq('company_id', companyId)
      .eq('staff_profile_id', staff.id)
      .is('revoked_at', null)
      .gt('expires_at', nowIso)
      .limit(1)
      .maybeSingle()

    // Readiness
    const availRaw = availRes.data?.find(a => (a as any).staff_profile_id === staff.id)
    const availability = availRaw ? parseAvailabilityRecord(staff.id, availRaw as Record<string, unknown>) : null

    // If there's an active override, treat compliance as passing
    const effectivelyCompliant = compliance.compliant || !!activeOverride
    const readiness = calculateReadiness(staff.status, effectivelyCompliant, availability)

    if (!readiness.ready) {
      // Generate detailed blocking explanation
      const blockExplanation = explainShiftBlock(
        compliance.complianceState,
        compliance.missingDocuments,
        compliance.expiredDocuments,
        compliance.missingTraining,
        compliance.expiredTraining,
        staff.status,
      )

      return NextResponse.json({
        error:       `${staff.first_name} cannot be assigned — compliance issues must be resolved first`,
        blockers:    readiness.blockers,
        warnings:    readiness.warnings,
        blockDetail: blockExplanation,
        staffId:     staff.id,
        overrideable: blockExplanation.overrideable,
        overrideHint: blockExplanation.overrideable
          ? `A compliance_manager or company_admin can grant a temporary override at /admin/staff/${staff.id}`
          : null,
      }, { status: 422 })
    }

    // Log if override was used
    if (activeOverride && !compliance.compliant) {
      complianceWarning = true
      void adminClient.from('audit_logs').insert({
        company_id:  companyId,
        actor_id:    null,
        action:      'compliance.override_used',
        entity_type: 'shift',
        entity_id:   shiftId,
        metadata: {
          staff_id:    staff.id,
          override_id: activeOverride.id,
          override_reason: activeOverride.reason,
        },
      })
    }

    // Overlaps (±1 day window)
    const existingSpans: ShiftSpan[] = (nearbyShiftsRes.data ?? [])
      .filter(s => (s as Record<string, unknown>).assigned_staff_id === staff.id)
      .map((s) => ({
        shift_date: s.shift_date as string,
        start_time: s.start_time as string,
        end_time:   s.end_time   as string,
      }))

    if (hasShiftOverlap(targetSpan, existingSpans)) {
      return NextResponse.json({ error: `${staff.first_name} has an overlapping shift on this date` }, { status: 422 })
    }

    // Fatigue checks (7-day window for rest period + consecutive days)
    const fatigueSpans: ShiftSpan[] = (fatigueShiftsRes.data ?? [])
      .filter(s => (s as Record<string, unknown>).assigned_staff_id === staff.id)
      .map((s) => ({
        shift_date: s.shift_date as string,
        start_time: s.start_time as string,
        end_time:   s.end_time   as string,
      }))

    const restResult = checkRestPeriod(targetSpan, fatigueSpans)
    if (restResult.level === 'block') {
      return NextResponse.json({
        error:            `${staff.first_name}: ${restResult.message}`,
        rule:             'rest_period',
        gapMinutes:       restResult.gapMinutes,
        overrideable:     true,
        overrideHint:     `A registered_manager or company_admin can override rest period checks in exceptional circumstances.`,
      }, { status: 422 })
    }
    if (restResult.level === 'warn') complianceWarning = true

    const consecResult = checkConsecutiveDays(targetSpan.shift_date, fatigueSpans)
    if (consecResult.level === 'block') {
      return NextResponse.json({
        error:            `${staff.first_name}: ${consecResult.message}`,
        rule:             'consecutive_days',
        consecutiveDays:  consecResult.consecutiveDays,
        overrideable:     true,
        overrideHint:     `A registered_manager or company_admin can override consecutive day limits.`,
      }, { status: 422 })
    }
    if (consecResult.level === 'warn') complianceWarning = true

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
        metadata:    {
          target_staff_ids: targetStaffIds,
          compliance_warning: complianceWarning,
          shift_date:  shift.shift_date,
          shift_title: shift.title,
          assignment_type: isDirectAssign ? 'direct' : 'broadcast',
        },
      })
    } catch { /* ignore */ }

    const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const portalLink = `${appUrl}/worker/dashboard`
    const eventType  = isDirectAssign ? 'shift_assigned' : 'shift_offer'

    for (const staff of staffList) {
      const workerName = [staff.first_name, staff.last_name].filter(Boolean).join(' ') || 'Worker'

      // In-app notification (fire-and-forget)
      void createNotification({
        recipient:       'worker',
        staffProfileId:  staff.id,
        companyId,
        eventType,
        title:     isDirectAssign
          ? `Shift assigned: ${shift.title as string}`
          : `New shift offer: ${shift.title as string}`,
        message:   `${shift.shift_date as string} · ${(shift.start_time as string).slice(0, 5)}–${(shift.end_time as string).slice(0, 5)}`,
        actionUrl: `${appUrl}/worker/shifts`,
        entityId:  shiftId,
      })

      // Email notification
      const receiveEmails = staff.receive_shift_emails ?? true
      if (staff.email && receiveEmails) {
        await sendNotification({
          type:           'shift.assigned',
          companyId,
          entityId:       shiftId,
          recipientEmail: staff.email,
          data: {
            companyName: '',
            workerName,
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
