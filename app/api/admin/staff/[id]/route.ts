import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { getStaffDocuments } from '@/lib/staff/getStaffDocuments'
import { requireAdmin } from '@/lib/auth/requireAdmin'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ALLOWED_PROFILE_STATUSES = new Set(['pre_employment', 'active', 'suspended', 'inactive', 'terminated'])

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

  const first_name  = typeof b.first_name  === 'string' ? b.first_name.trim()  : ''
  const last_name   = typeof b.last_name   === 'string' ? b.last_name.trim()   : ''
  const email       = typeof b.email       === 'string' ? b.email.trim().toLowerCase() : ''
  const phone       = typeof b.phone       === 'string' ? b.phone.trim()       : ''
  const job_role    = typeof b.job_role    === 'string' ? b.job_role.trim()    : ''
  const start_date  = typeof b.start_date  === 'string' ? b.start_date.trim()  : ''
  const status      = typeof b.status      === 'string' ? b.status             : ''

  const errors: string[] = []
  if (!first_name)                                       errors.push('first_name is required')
  if (!last_name)                                        errors.push('last_name is required')
  if (!email)                                            errors.push('email is required')
  else if (!EMAIL_RE.test(email))                        errors.push('email must be valid')
  if (status && !ALLOWED_PROFILE_STATUSES.has(status))  errors.push(`status must be one of: ${[...ALLOWED_PROFILE_STATUSES].join(', ')}`)

  if (errors.length) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 422 })
  }

  // Fetch current profile for company_id + duplicate check
  const { data: current, error: fetchErr } = await adminClient
    .from('staff_profiles')
    .select('id, company_id, email, first_name, last_name, status')
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
  if (email !== (current.email ?? '').toLowerCase()) {
    const { data: dup } = await adminClient
      .from('staff_profiles')
      .select('id')
      .eq('company_id', current.company_id as string)
      .eq('email', email)
      .neq('id', staffProfileId)
      .maybeSingle()

    if (dup) {
      return NextResponse.json(
        { error: 'A staff member with this email already exists in this company' },
        { status: 422 }
      )
    }
  }

  const updatePayload: Record<string, unknown> = {
    first_name:  first_name || null,
    last_name:   last_name  || null,
    email,
    phone:       phone      || null,
    job_role:    job_role   || null,
    start_date:  start_date || null,
    updated_at:  new Date().toISOString(),
  }
  if (status) updatePayload.status = status

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

  // Audit log (fire-and-forget)
  void (async () => {
    try {
      await adminClient.from('audit_logs').insert({
        company_id:  current.company_id,
        actor_id:    null,
        action:      'staff.profile_updated',
        entity_type: 'staff_profile',
        entity_id:   staffProfileId,
        metadata: {
          previous: {
            first_name: current.first_name,
            last_name:  current.last_name,
            email:      current.email,
            status:     current.status,
          },
          updated:   updatePayload,
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

  // ── Staff profile ──────────────────────────────────────────────────────────
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

  // ── Documents: merged and deduplicated from both sources ──────────────────
  const documents = await getStaffDocuments(staffProfile.id, staffProfile.applicant_id as string | null)

  // ── Compliance items (if any) ─────────────────────────────────────────────
  const { data: complianceItems } = await adminClient
    .from('compliance_items')
    .select('id, item_type, status, expires_at, completed_at, notes')
    .eq('staff_profile_id', id)
    .order('item_type')

  return NextResponse.json({
    staff_profile:    staffProfile,
    applicant,
    documents,
    compliance_items: complianceItems ?? [],
  })
}
