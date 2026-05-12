import { NextResponse } from 'next/server'
import { adminClient }  from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { calculateCompliance } from '@/lib/compliance/calculateCompliance'
import { getStaffDocuments } from '@/lib/staff/getStaffDocuments'

// ── PATCH /api/admin/staff/[id]/documents/[docId]/approve ─────────────────────
//
// Approves or rejects an individual uploaded document.
// Body: { action: 'approve' | 'reject', notes?: string }
//
// Returns: { document, complianceSummary } — the summary is recalculated
// immediately after approval so the UI can update without a second fetch.
//
// Ownership model after the applicant → staff conversion:
//
//   Before conversion: documents have applicant_id set, staff_profile_id = NULL
//   After  conversion: the convert route sets staff_profile_id on all applicant
//                      docs (see applicants/[id]/convert/route.ts).
//
// However, for documents uploaded before migration (or if the document migration
// step failed non-fatally), staff_profile_id may still be NULL. We therefore
// accept a document as belonging to this staff member if EITHER:
//   a) doc.staff_profile_id matches the URL param, OR
//   b) the staff profile's applicant_id matches doc.applicant_id
//
// Either path requires the staff profile to belong to the admin's company.

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

  // ── Verify the staff profile belongs to this company ──────────────────────
  const { data: staff, error: staffErr } = await adminClient
    .from('staff_profiles')
    .select('id, company_id, applicant_id')
    .eq('id', staffProfileId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (staffErr || !staff) {
    return NextResponse.json({ error: 'Staff profile not found' }, { status: 404 })
  }

  // ── Fetch the document ─────────────────────────────────────────────────────
  const { data: doc, error: fetchErr } = await adminClient
    .from('documents')
    .select('id, staff_profile_id, applicant_id, document_type')
    .eq('id', docId)
    .maybeSingle()

  if (fetchErr || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  // ── Ownership check ────────────────────────────────────────────────────────
  //
  // Accept the document if it is linked to this staff profile directly, OR
  // if it is linked to the applicant that was converted into this staff profile.
  //
  const ownedByStaff     = doc.staff_profile_id === staffProfileId
  const ownedByApplicant =
    doc.applicant_id !== null &&
    staff.applicant_id !== null &&
    doc.applicant_id === staff.applicant_id

  if (!ownedByStaff && !ownedByApplicant) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  // ── If the doc is still applicant-only, backfill staff_profile_id ──────────
  // This handles the case where the migration step in the convert route failed
  // non-fatally. We fix it lazily here so subsequent approvals work immediately.
  if (!ownedByStaff && ownedByApplicant) {
    await adminClient
      .from('documents')
      .update({ staff_profile_id: staffProfileId })
      .eq('id', docId)
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
    .select('id, document_type, training_category, expiry_date, issue_date, reviewed_status, review_notes, reviewed_by, reviewed_at')
    .maybeSingle()

  if (updateErr || !updated) {
    console.error('[document-approve] update error:', updateErr?.message)
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 })
  }

  // ── Renewal workflow — supersede older certs for the same training category ─
  // When a new training certificate is approved for a category, mark any
  // previously-approved cert for the same category as 'superseded'.
  // The superseded cert is kept for audit history but ignored by the
  // compliance engine (only 'approved' status satisfies training requirements).
  if (action === 'approve' && doc.document_type === 'training_certificate') {
    const { training_category } = updated as { training_category: string | null }
    if (training_category) {
      await adminClient
        .from('documents')
        .update({ reviewed_status: 'superseded' })
        .eq('reviewed_status', 'approved')
        .eq('training_category', training_category)
        .neq('id', docId)
        // Scope to this staff member (by staff_profile_id OR applicant_id)
        .or(
          `staff_profile_id.eq.${staffProfileId}${staff.applicant_id ? `,applicant_id.eq.${staff.applicant_id}` : ''}`
        )
    }
  }

  // ── Recalculate compliance immediately after approval ──────────────────────
  // Fetch all documents for this staff member and recompute compliance so the
  // UI can update without a separate GET /compliance call.
  let complianceSummary = null
  try {
    const allDocs = await getStaffDocuments(staffProfileId, staff.applicant_id as string | null)
    complianceSummary = calculateCompliance(allDocs)
  } catch (err) {
    // Non-fatal: the document was still approved successfully
    console.error('[document-approve] compliance recalculation failed:', err)
  }

  return NextResponse.json({ document: updated, complianceSummary })
}


