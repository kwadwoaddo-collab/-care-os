import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'

// ── Types ─────────────────────────────────────────────────────────────────────

type CheckType = 'dbs' | 'right_to_work' | 'reference' | 'id_verification'
type CheckStatus = 'not_started' | 'in_progress' | 'complete' | 'rejected'

const VALID_CHECK_TYPES = new Set<CheckType>(['dbs', 'right_to_work', 'reference', 'id_verification'])
const VALID_STATUSES = new Set<CheckStatus>(['not_started', 'in_progress', 'complete', 'rejected'])
const VALID_DBS_TYPES = new Set(['basic', 'standard', 'enhanced', 'enhanced_barred'])

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const { id: staffProfileId } = await params

  // Verify staff belongs to this company
  const { data: staffProfile, error: spError } = await adminClient
    .from('staff_profiles')
    .select('id')
    .eq('id', staffProfileId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (spError) {
    console.error('[pre-employment/get] staff fetch error:', spError.message)
    return NextResponse.json({ error: 'Failed to verify staff profile' }, { status: 500 })
  }
  if (!staffProfile) {
    return NextResponse.json({ error: 'Staff profile not found' }, { status: 404 })
  }

  // Fetch all checks for this staff member
  const { data: checks, error: checksError } = await adminClient
    .from('pre_employment_checks')
    .select('*')
    .eq('staff_profile_id', staffProfileId)
    .order('check_type')

  if (checksError) {
    console.error('[pre-employment/get] checks fetch error:', checksError.message)
    return NextResponse.json({ error: 'Failed to fetch pre-employment checks' }, { status: 500 })
  }

  return NextResponse.json({ checks: checks ?? [] })
}

// ── POST (upsert by check_type) ────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId, userId } = auth.ctx

  const { id: staffProfileId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const b = (body ?? {}) as Record<string, unknown>

  // ── Validate required fields ──────────────────────────────────────────────

  const checkType = b.check_type
  if (!checkType || !VALID_CHECK_TYPES.has(checkType as CheckType)) {
    return NextResponse.json(
      { error: `check_type must be one of: ${[...VALID_CHECK_TYPES].join(', ')}` },
      { status: 422 }
    )
  }

  const status = b.status
  if (status !== undefined && !VALID_STATUSES.has(status as CheckStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${[...VALID_STATUSES].join(', ')}` },
      { status: 422 }
    )
  }

  const dbsType = b.dbs_type
  if (dbsType !== undefined && dbsType !== null && !VALID_DBS_TYPES.has(dbsType as string)) {
    return NextResponse.json(
      { error: `dbs_type must be one of: ${[...VALID_DBS_TYPES].join(', ')}` },
      { status: 422 }
    )
  }

  // ── Verify staff belongs to this company ─────────────────────────────────

  const { data: staffProfile, error: spError } = await adminClient
    .from('staff_profiles')
    .select('id')
    .eq('id', staffProfileId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (spError) {
    console.error('[pre-employment/post] staff fetch error:', spError.message)
    return NextResponse.json({ error: 'Failed to verify staff profile' }, { status: 500 })
  }
  if (!staffProfile) {
    return NextResponse.json({ error: 'Staff profile not found' }, { status: 404 })
  }

  // ── Build upsert payload ──────────────────────────────────────────────────

  function str(v: unknown): string | null {
    if (typeof v === 'string') return v.trim() || null
    return null
  }

  const now = new Date().toISOString()
  const newStatus = (status as CheckStatus | undefined) ?? 'not_started'

  const upsertPayload: Record<string, unknown> = {
    staff_profile_id: staffProfileId,
    check_type: checkType,
    status: newStatus,
    updated_at: now,
    // DBS fields
    dbs_type:               b.dbs_type !== undefined ? (str(b.dbs_type) ?? null) : undefined,
    dbs_certificate_number: b.dbs_certificate_number !== undefined ? str(b.dbs_certificate_number) : undefined,
    dbs_issue_date:         b.dbs_issue_date !== undefined ? str(b.dbs_issue_date) : undefined,
    dbs_expiry_date:        b.dbs_expiry_date !== undefined ? str(b.dbs_expiry_date) : undefined,
    // Right to Work fields
    rtw_document_type: b.rtw_document_type !== undefined ? str(b.rtw_document_type) : undefined,
    rtw_checked_date:  b.rtw_checked_date !== undefined ? str(b.rtw_checked_date) : undefined,
    rtw_expiry_date:   b.rtw_expiry_date !== undefined ? str(b.rtw_expiry_date) : undefined,
    rtw_checked_by:    b.rtw_checked_by !== undefined ? str(b.rtw_checked_by) : undefined,
    // Reference fields
    ref_referee_name:    b.ref_referee_name !== undefined ? str(b.ref_referee_name) : undefined,
    ref_referee_role:    b.ref_referee_role !== undefined ? str(b.ref_referee_role) : undefined,
    ref_referee_email:   b.ref_referee_email !== undefined ? str(b.ref_referee_email) : undefined,
    ref_requested_date:  b.ref_requested_date !== undefined ? str(b.ref_requested_date) : undefined,
    ref_received_date:   b.ref_received_date !== undefined ? str(b.ref_received_date) : undefined,
    ref_employer_name:   b.ref_employer_name !== undefined ? str(b.ref_employer_name) : undefined,
    // General
    notes:        b.notes !== undefined ? str(b.notes) : undefined,
    completed_by: newStatus === 'complete' ? (str(b.completed_by) ?? userId) : (b.completed_by !== undefined ? str(b.completed_by) : undefined),
    completed_at: newStatus === 'complete' ? now : (newStatus === 'not_started' || newStatus === 'in_progress' ? null : undefined),
  }

  // Remove undefined keys so Supabase upsert only sets defined fields
  const cleanPayload = Object.fromEntries(
    Object.entries(upsertPayload).filter(([, v]) => v !== undefined)
  )

  // ── Upsert (one record per check_type per staff_profile) ─────────────────

  const { data: upserted, error: upsertErr } = await adminClient
    .from('pre_employment_checks')
    .upsert(cleanPayload, {
      onConflict: 'staff_profile_id,check_type',
      ignoreDuplicates: false,
    })
    .select()
    .single()

  if (upsertErr) {
    console.error('[pre-employment/post] upsert error:', upsertErr.message)
    return NextResponse.json({ error: 'Failed to save pre-employment check', details: upsertErr.message }, { status: 500 })
  }

  // ── Audit log (fire-and-forget) ───────────────────────────────────────────

  void (async () => {
    try {
      await adminClient.from('audit_logs').insert({
        company_id:  companyId,
        actor_id:    userId,
        action:      'staff.pre_employment_check_updated',
        entity_type: 'staff_profile',
        entity_id:   staffProfileId,
        metadata: {
          check_type: checkType,
          status:     newStatus,
          timestamp:  now,
        },
      })
    } catch (err) {
      console.error('[pre-employment/post] audit log error:', err)
    }
  })()

  return NextResponse.json({ check: upserted })
}
