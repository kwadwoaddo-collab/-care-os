import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'

const SIGNED_URL_EXPIRY = 3600 // 1 hour

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const { id: applicantId } = await params

  // ── Verify applicant belongs to this company ────────────────────────────────
  const { data: applicant, error: applicantError } = await adminClient
    .from('applicants')
    .select('id')
    .eq('id', applicantId)
    .eq('company_id', companyId)
    .maybeSingle()

  if (applicantError) {
    console.error('[applicant/documents] lookup failed:', applicantError.message)
    return NextResponse.json({ error: 'Failed to look up applicant' }, { status: 500 })
  }
  if (!applicant) {
    return NextResponse.json({ error: 'Applicant not found' }, { status: 404 })
  }

  // ── Fetch all documents linked to this applicant ────────────────────────────
  // These are applicant-stage uploads: applicant_id is set regardless of
  // whether staff_profile_id was subsequently populated during conversion.
  const { data: docs, error: docsError } = await adminClient
    .from('documents')
    .select(
      'id, document_type, file_name, file_path, file_size, mime_type, expiry_date, issue_date, created_at, reviewed_status, reviewed_at, reviewed_by, staff_profile_id, applicant_id'
    )
    .eq('applicant_id', applicantId)
    .order('created_at', { ascending: false })

  if (docsError) {
    console.error('[applicant/documents] fetch failed:', docsError.message)
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
  }

  const documents = docs ?? []

  // ── Generate signed URLs for private storage ────────────────────────────────
  const docsWithUrls = await Promise.all(
    documents.map(async (doc) => {
      let signedUrl: string | null = null
      if (doc.file_path) {
        const { data } = await adminClient.storage
          .from('care-os-documents')
          .createSignedUrl(doc.file_path, SIGNED_URL_EXPIRY)
        signedUrl = data?.signedUrl ?? null
      }
      return { ...doc, signed_url: signedUrl }
    })
  )

  return NextResponse.json(docsWithUrls)
}
