import { NextResponse } from 'next/server'
import { adminClient }  from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'

// ── PATCH /api/admin/staff/[id]/documents/[docId]/expiry ───────────────────
// Updates the expiry_date of a document linked to this staff profile.
// Body: { expiry_date: string } — ISO date string YYYY-MM-DD

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const { id: staffProfileId, docId } = await params

  let body: { expiry_date?: string }
  try {
    body = await request.json() as { expiry_date?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { expiry_date } = body
  if (!expiry_date || !/^\d{4}-\d{2}-\d{2}$/.test(expiry_date)) {
    return NextResponse.json({ error: 'expiry_date must be YYYY-MM-DD' }, { status: 400 })
  }

  // Verify staff profile belongs to this company
  const { data: staff, error: staffErr } = await adminClient
    .from('staff_profiles')
    .select('id, company_id, applicant_id')
    .eq('id', staffProfileId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (staffErr || !staff) {
    return NextResponse.json({ error: 'Staff profile not found' }, { status: 404 })
  }

  // Fetch and verify ownership of the document
  const { data: doc, error: fetchErr } = await adminClient
    .from('documents')
    .select('id, staff_profile_id, applicant_id')
    .eq('id', docId)
    .maybeSingle()

  if (fetchErr || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  const ownedByStaff     = doc.staff_profile_id === staffProfileId
  const ownedByApplicant =
    doc.applicant_id !== null &&
    staff.applicant_id !== null &&
    doc.applicant_id === staff.applicant_id

  if (!ownedByStaff && !ownedByApplicant) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  const { data: updated, error: updateErr } = await adminClient
    .from('documents')
    .update({ expiry_date })
    .eq('id', docId)
    .select('id, expiry_date, document_type, file_name')
    .maybeSingle()

  if (updateErr || !updated) {
    console.error('[document-expiry] update error:', updateErr?.message)
    return NextResponse.json({ error: 'Failed to update expiry date' }, { status: 500 })
  }

  return NextResponse.json({ document: updated })
}
