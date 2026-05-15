import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/rbac/permissions'

const RESTORE_STATUSES = ['applied', 'shortlisted'] as const
type RestoreStatus = (typeof RESTORE_STATUSES)[number]

function isRestoreStatus(v: unknown): v is RestoreStatus {
  return typeof v === 'string' && (RESTORE_STATUSES as readonly string[]).includes(v)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId, userId, role } = auth.ctx

  if (!can(role, 'applicants:update')) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { new_status, restore_note } = body

  if (!isRestoreStatus(new_status)) {
    return NextResponse.json(
      { error: 'new_status must be "applied" or "shortlisted"' },
      { status: 422 }
    )
  }

  // Verify applicant exists, belongs to company, and is currently rejected
  const { data: existing, error: fetchError } = await adminClient
    .from('applicants')
    .select('id, status, company_id, first_name, last_name')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (fetchError) {
    console.error('[admin/applicants/[id]/restore] fetch failed:', fetchError)
    return NextResponse.json({ error: 'Failed to fetch applicant' }, { status: 500 })
  }
  if (!existing) {
    return NextResponse.json({ error: 'Applicant not found' }, { status: 404 })
  }
  if (existing.status !== 'rejected') {
    return NextResponse.json({ error: 'Only rejected applicants can be restored' }, { status: 422 })
  }

  // Clear rejection metadata and restore status
  const { data: applicant, error: updateError } = await adminClient
    .from('applicants')
    .update({
      status:           new_status,
      updated_at:       new Date().toISOString(),
      rejected_at:      null,
      rejected_by:      null,
      rejection_reason: null,
      rejection_notes:  null,
    })
    .eq('id', id)
    .eq('company_id', companyId)
    .select('id, first_name, last_name, email, status, company_id')
    .maybeSingle()

  if (updateError) {
    console.error('[admin/applicants/[id]/restore] update failed:', updateError)
    return NextResponse.json({ error: 'Failed to restore applicant' }, { status: 500 })
  }

  // Audit log (fire-and-forget)
  void (async () => {
    try {
      const { error } = await adminClient
        .from('audit_logs')
        .insert({
          company_id:  companyId,
          actor_id:    userId === 'dev-admin' ? null : userId,
          action:      'applicant.restored',
          entity_type: 'applicant',
          entity_id:   id,
          metadata: {
            new_status,
            restore_note: typeof restore_note === 'string' ? restore_note.trim() || null : null,
            timestamp:    new Date().toISOString(),
          },
        })
      if (error) console.error('[admin/applicants/[id]/restore] audit log failed:', error)
    } catch (err) {
      console.error('[admin/applicants/[id]/restore] audit log unexpected error:', err)
    }
  })()

  return NextResponse.json({ applicant })
}
