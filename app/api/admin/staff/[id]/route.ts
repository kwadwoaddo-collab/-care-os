import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { getStaffDocuments } from '@/lib/staff/getStaffDocuments'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/auth/permissions'
import { calculateHrReadiness, type HrReadinessInput } from '@/lib/staff/calculateHrReadiness'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ALLOWED_PROFILE_STATUSES = new Set(['pre_employment', 'active', 'suspended', 'inactive', 'terminated'])

// Basic profile fields — validated when present
const BASIC_FIELDS = ['first_name', 'last_name', 'email', 'phone', 'job_role', 'start_date', 'status'] as const

// HR / payroll fields — optional, no hard validation
const HR_FIELDS = [
  'middle_name', 'date_of_birth', 'gender', 'nationality',
  'address_line_1', 'address_line_2', 'city', 'postcode',
  'emergency_contact_name', 'emergency_contact_phone', 'emergency_contact_relationship',
  'ni_number', 'tax_code', 'payroll_number',
  'bank_name', 'bank_account_name', 'bank_account_number', 'bank_sort_code',
  'starter_declaration', 'utr_number',
  'employment_type', 'contracted_hours', 'start_date_confirmed',
  'right_to_work_checked', 'dbs_checked', 'dbs_number', 'dbs_expiry_date',
] as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const { id: staffProfileId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const b = (body ?? {}) as Record<string, unknown>

  // ── Detect update type ────────────────────────────────────────────────────
  const isBasicUpdate = BASIC_FIELDS.some((f) => f in b)
  const isHrUpdate    = HR_FIELDS.some((f) => f in b)

  if (!isBasicUpdate && !isHrUpdate) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 })
  }

  // ── Validate basic fields when present ────────────────────────────────────
  const errors: string[] = []
  if ('first_name' in b) {
    const v = typeof b.first_name === 'string' ? b.first_name.trim() : ''
    if (!v) errors.push('first_name is required')
  }
  if ('last_name' in b) {
    const v = typeof b.last_name === 'string' ? b.last_name.trim() : ''
    if (!v) errors.push('last_name is required')
  }
  if ('email' in b) {
    const v = typeof b.email === 'string' ? b.email.trim() : ''
    if (!v)             errors.push('email is required')
    else if (!EMAIL_RE.test(v)) errors.push('email must be valid')
  }
  if ('status' in b) {
    const v = typeof b.status === 'string' ? b.status : ''
    if (v && !ALLOWED_PROFILE_STATUSES.has(v)) errors.push(`status must be one of: ${[...ALLOWED_PROFILE_STATUSES].join(', ')}`)
  }
  if ('starter_declaration' in b) {
    const v = b.starter_declaration
    if (v !== null && v !== undefined && !['A', 'B', 'C'].includes(String(v))) {
      errors.push('starter_declaration must be A, B, or C')
    }
  }
  if ('employment_type' in b) {
    const v = b.employment_type
    const allowed = ['full_time', 'part_time', 'zero_hours', 'agency']
    if (v !== null && v !== undefined && !allowed.includes(String(v))) {
      errors.push(`employment_type must be one of: ${allowed.join(', ')}`)
    }
  }

  if (errors.length) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 422 })
  }

  // ── Fetch current profile for company check + duplicate email guard ───────
  const { data: current, error: fetchErr } = await adminClient
    .from('staff_profiles')
    .select('*')
    .eq('id', staffProfileId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (fetchErr) {
    console.error('[staff/patch] fetch error:', fetchErr.message)
    return NextResponse.json({ error: 'Failed to fetch staff profile' }, { status: 500 })
  }
  if (!current) {
    return NextResponse.json({ error: 'Staff profile not found' }, { status: 404 })
  }

  // Duplicate email check — only when email changed
  if ('email' in b) {
    const newEmail = (b.email as string).trim().toLowerCase()
    if (newEmail !== (current.email ?? '').toLowerCase()) {
      const { data: dup } = await adminClient
        .from('staff_profiles')
        .select('id')
        .eq('company_id', companyId)
        .eq('email', newEmail)
        .neq('id', staffProfileId)
        .maybeSingle()

      if (dup) {
        return NextResponse.json(
          { error: 'A staff member with this email already exists in this company' },
          { status: 422 }
        )
      }
    }
  }

  // ── Build update payload ──────────────────────────────────────────────────
  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (isBasicUpdate) {
    if ('first_name'  in b) updatePayload.first_name  = typeof b.first_name  === 'string' ? b.first_name.trim()  || null : null
    if ('last_name'   in b) updatePayload.last_name   = typeof b.last_name   === 'string' ? b.last_name.trim()   || null : null
    if ('email'       in b) updatePayload.email       = typeof b.email       === 'string' ? b.email.trim().toLowerCase() : null
    if ('phone'       in b) updatePayload.phone       = typeof b.phone       === 'string' ? b.phone.trim()       || null : null
    if ('job_role'    in b) updatePayload.job_role    = typeof b.job_role    === 'string' ? b.job_role.trim()    || null : null
    if ('start_date'  in b) updatePayload.start_date  = typeof b.start_date  === 'string' ? b.start_date.trim()  || null : null
    if ('status'      in b && b.status) updatePayload.status = b.status
  }

  if (isHrUpdate) {
    for (const field of HR_FIELDS) {
      if (field in b) {
        const v = b[field]
        // Coerce empty strings to null; keep booleans and numbers as-is
        if (typeof v === 'string') {
          updatePayload[field] = v.trim() || null
        } else {
          updatePayload[field] = v ?? null
        }
      }
    }
  }

  // ── Auto-compute onboarding_completed ─────────────────────────────────────
  // Merge current DB values with the pending update to evaluate HR readiness
  const merged: HrReadinessInput = {
    date_of_birth:          (updatePayload.date_of_birth          ?? current.date_of_birth)          as string | null,
    address_line_1:         (updatePayload.address_line_1         ?? current.address_line_1)         as string | null,
    ni_number:              (updatePayload.ni_number              ?? current.ni_number)              as string | null,
    bank_account_number:    (updatePayload.bank_account_number    ?? current.bank_account_number)    as string | null,
    emergency_contact_name: (updatePayload.emergency_contact_name ?? current.emergency_contact_name) as string | null,
    employment_type:        (updatePayload.employment_type        ?? current.employment_type)        as string | null,
    starter_declaration:    (updatePayload.starter_declaration    ?? current.starter_declaration)    as string | null,
  }
  const { ready: hrReady } = calculateHrReadiness(merged)
  updatePayload.onboarding_completed = hrReady

  // ── Persist ───────────────────────────────────────────────────────────────
  const { data: updated, error: updateErr } = await adminClient
    .from('staff_profiles')
    .update(updatePayload)
    .eq('id', staffProfileId)
    .eq('company_id', companyId)
    .select()
    .single()

  if (updateErr || !updated) {
    console.error('[staff/patch] update error:', updateErr?.message)
    return NextResponse.json({ error: 'Failed to update staff profile' }, { status: 500 })
  }

  // ── Audit log ─────────────────────────────────────────────────────────────
  void (async () => {
    try {
      const action = isHrUpdate && !isBasicUpdate ? 'staff.hr_updated' : 'staff.profile_updated'
      await adminClient.from('audit_logs').insert({
        company_id:  companyId,
        actor_id:    auth.ctx.userId,
        action,
        entity_type: 'staff_profile',
        entity_id:   staffProfileId,
        metadata: {
          fields_updated: Object.keys(updatePayload).filter((k) => k !== 'updated_at'),
          onboarding_completed: hrReady,
          timestamp: new Date().toISOString(),
        },
      })
    } catch (err) {
      console.error('[staff/patch] audit log error:', err)
    }
  })()

  return NextResponse.json({ staff_profile: updated })
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const { id } = await params

  const { data: staffProfile, error: spError } = await adminClient
    .from('staff_profiles')
    .select('*')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (spError) {
    console.error('[admin/staff/[id]] fetch error:', spError.message)
    return NextResponse.json(
      { error: 'Failed to fetch staff profile', supabase_message: spError.message },
      { status: 500 }
    )
  }

  if (!staffProfile) {
    return NextResponse.json({ error: 'Staff profile not found' }, { status: 404 })
  }

  // ── Linked applicant (if any) ──────────────────────────────────────────────
  let applicant: Record<string, unknown> | null = null
  if (staffProfile.applicant_id) {
    const { data } = await adminClient
      .from('applicants')
      .select('id, first_name, last_name, email, phone, job_role, status, created_at')
      .eq('id', staffProfile.applicant_id)
      .maybeSingle()
    applicant = data ?? null
  }

  // ── Documents ─────────────────────────────────────────────────────────────
  const documents = await getStaffDocuments(staffProfile.id, staffProfile.applicant_id as string | null)

  // ── Compliance items ──────────────────────────────────────────────────────
  const { data: complianceItems } = await adminClient
    .from('compliance_items')
    .select('id, item_type, status, expires_at, completed_at, notes')
    .eq('staff_profile_id', id)
    .order('item_type')

  // ── HR readiness ──────────────────────────────────────────────────────────
  const hrReadiness = calculateHrReadiness({
    date_of_birth:          staffProfile.date_of_birth          as string | null,
    address_line_1:         staffProfile.address_line_1         as string | null,
    ni_number:              staffProfile.ni_number              as string | null,
    bank_account_number:    staffProfile.bank_account_number    as string | null,
    emergency_contact_name: staffProfile.emergency_contact_name as string | null,
    employment_type:        staffProfile.employment_type        as string | null,
    starter_declaration:    staffProfile.starter_declaration    as string | null,
  })

  return NextResponse.json({
    staff_profile:    staffProfile,
    applicant,
    documents,
    compliance_items: complianceItems ?? [],
    hr_readiness:     hrReadiness,
  })
}

// ── DELETE ─────────────────────────────────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId, userId, role } = auth.ctx

  // Only company_admin or registered_manager can delete staff
  if (!can(role, 'staff:delete')) {
    return NextResponse.json({ error: 'You do not have permission to delete staff members.' }, { status: 403 })
  }

  // Permanent delete is restricted to company_admin and super_admin only
  if (role !== 'company_admin' && role !== 'super_admin') {
    return NextResponse.json({ error: 'Only company admins can permanently delete staff records.' }, { status: 403 })
  }

  const { id: staffProfileId } = await params

  // Verify staff belongs to this company
  const { data: profile, error: fetchErr } = await adminClient
    .from('staff_profiles')
    .select('id, first_name, last_name, email, status, profile_id')
    .eq('id', staffProfileId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (fetchErr || !profile) {
    return NextResponse.json({ error: 'Staff profile not found' }, { status: 404 })
  }

  // Staff must be terminated before permanent deletion
  if (profile.status !== 'terminated') {
    return NextResponse.json(
      { error: 'Staff must be set to Terminated status before permanent deletion.' },
      { status: 422 }
    )
  }

  // Safety check: unassign any future shifts still linked to this staff member
  const today = new Date().toISOString().split('T')[0]
  const { count: futureShiftCount } = await adminClient
    .from('shifts')
    .select('id', { count: 'exact', head: true })
    .eq('assigned_staff_id', staffProfileId)
    .gte('shift_date', today)
    .in('status', ['open', 'offered', 'accepted', 'in_progress'])

  if ((futureShiftCount ?? 0) > 0) {
    await adminClient
      .from('shifts')
      .update({ assigned_staff_id: null, status: 'open', updated_at: new Date().toISOString() })
      .eq('assigned_staff_id', staffProfileId)
      .gte('shift_date', today)
      .in('status', ['open', 'offered', 'accepted', 'in_progress'])
  }

  // Delete related records (compliance items, documents references, etc.)
  await adminClient.from('compliance_items').delete().eq('staff_profile_id', staffProfileId)

  // Delete staff profile
  const { error: deleteErr } = await adminClient
    .from('staff_profiles')
    .delete()
    .eq('id', staffProfileId)
    .eq('company_id', companyId)

  if (deleteErr) {
    console.error('[staff/delete] error:', deleteErr.message)
    return NextResponse.json({ error: 'Failed to delete staff profile' }, { status: 500 })
  }

  // Audit log
  void (async () => {
    try {
      await adminClient.from('audit_logs').insert({
        company_id:  companyId,
        actor_id:    userId,
        action:      'staff.permanently_deleted',
        entity_type: 'staff_profile',
        entity_id:   staffProfileId,
        metadata: {
          deleted_name: [profile.first_name, profile.last_name].filter(Boolean).join(' '),
          deleted_email: profile.email,
          had_future_shifts: (futureShiftCount ?? 0) > 0,
          timestamp: new Date().toISOString(),
        },
      })
    } catch (err) {
      console.error('[staff/delete] audit log error:', err)
    }
  })()

  return NextResponse.json({ ok: true })
}
