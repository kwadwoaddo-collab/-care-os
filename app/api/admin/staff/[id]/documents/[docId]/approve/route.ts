import { NextResponse } from 'next/server'
import { adminClient }  from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'

// ── PATCH /api/admin/staff/[id]/documents/[docId]/approve ─────────────────────
//
// Approves or rejects an individual uploaded document.
// Body: { action: 'approve' | 'reject', notes?: string }

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId, userId } = auth.ctx

  const { id: staffProfileId, docId } = await params

  let body: { action?: string; notes?: string }
  try {
    body = await request.json() as { action?: string; notes?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { action, notes } = body

  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json(
      { error: 'action must be "approve" or "reject"' },
      { status: 400 }
    )
  }

  // Verify the document belongs to this company's staff
  const { data: doc, error: fetchErr } = await adminClient
    .from('documents')
    .select('id, staff_profile_id, document_type')
    .eq('id', docId)
    .maybeSingle()

  if (fetchErr || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  // Ensure the document is scoped to the staff profile in the URL
  if (doc.staff_profile_id !== staffProfileId) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  // Verify the staff profile belongs to this company
  const { data: staff, error: staffErr } = await adminClient
    .from('staff_profiles')
    .select('id, company_id')
    .eq('id', staffProfileId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (staffErr || !staff) {
    return NextResponse.json({ error: 'Staff profile not found' }, { status: 404 })
  }

  const reviewed_status = action === 'approve' ? 'approved' : 'rejected'
  const reviewed_at     = new Date().toISOString()

  const { data: updated, error: updateErr } = await adminClient
    .from('documents')
    .update({
      reviewed_status,
      review_notes:  notes?.trim() || null,
      reviewed_by:   userId,
      reviewed_at,
    })
    .eq('id', docId)
    .select('id, reviewed_status, review_notes, reviewed_by, reviewed_at')
    .maybeSingle()

  if (updateErr || !updated) {
    console.error('[document-approve] update error:', updateErr?.message)
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 })
  }

  return NextResponse.json({ document: updated })
}
