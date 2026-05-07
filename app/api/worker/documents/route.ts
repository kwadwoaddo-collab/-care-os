import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { validateWorkerToken } from '@/lib/worker/auth'

export async function GET(request: NextRequest) {
  const token  = request.nextUrl.searchParams.get('token')
  const result = await validateWorkerToken(token)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  const { id: staffProfileId, applicant_id } = result.worker

  // Fetch by staff_profile_id
  const { data: staffDocs, error: e1 } = await adminClient
    .from('documents')
    .select('id, document_type, file_name, file_path, file_size, expiry_date, created_at')
    .eq('staff_profile_id', staffProfileId)
    .order('created_at', { ascending: false })

  if (e1) {
    console.error('[worker/documents] staff_profile fetch error:', e1.message)
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
  }

  let applicantDocs: typeof staffDocs = []

  // Also fetch docs uploaded via applicant flow (deduped by id)
  if (applicant_id) {
    const { data: aDocs } = await adminClient
      .from('documents')
      .select('id, document_type, file_name, file_path, file_size, expiry_date, created_at')
      .eq('applicant_id', applicant_id)
      .order('created_at', { ascending: false })
    applicantDocs = aDocs ?? []
  }

  const seenIds = new Set((staffDocs ?? []).map((d) => d.id))
  const merged  = [
    ...(staffDocs ?? []),
    ...(applicantDocs ?? []).filter((d) => !seenIds.has(d.id)),
  ]

  return NextResponse.json(merged)
}
