import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { validateWorkerToken } from '@/lib/worker/auth'

const DOC_SELECT = [
  'id', 'document_type', 'training_category',
  'file_name', 'file_path', 'file_size',
  'expiry_date', 'issue_date', 'created_at',
  'reviewed_status', 'review_notes',
].join(', ')

interface DocRecord {
  id:                string
  document_type:     string
  training_category: string | null
  file_name:         string
  file_path:         string | null
  file_size:         number | null
  expiry_date:       string | null
  issue_date:        string | null
  created_at:        string
  reviewed_status:   string | null
  review_notes:      string | null
}

export async function GET(request: NextRequest) {
  const token  = request.nextUrl.searchParams.get('token')
  const result = await validateWorkerToken(token)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  const { id: staffProfileId, applicant_id } = result.worker

  // Fetch by staff_profile_id — worker_visible=true enforces visibility governance
  const { data: staffDocs, error: e1 } = await adminClient
    .from('documents')
    .select(DOC_SELECT)
    .eq('staff_profile_id', staffProfileId)
    .eq('worker_visible', true)
    .is('archived_at', null)
    .order('created_at', { ascending: false })

  if (e1) {
    console.error('[worker/documents] staff_profile fetch error:', e1.message)
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
  }

  let applicantDocs: DocRecord[] = []

  // Also fetch docs uploaded via applicant flow (deduped by id)
  if (applicant_id) {
    const { data: aDocs } = await adminClient
      .from('documents')
      .select(DOC_SELECT)
      .eq('applicant_id', applicant_id)
      .eq('worker_visible', true)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
    applicantDocs = (aDocs ?? []) as unknown as DocRecord[]
  }

  const typed    = (staffDocs ?? []) as unknown as DocRecord[]
  const seenIds  = new Set(typed.map((d) => d.id))
  const merged   = [
    ...typed,
    ...applicantDocs.filter((d) => !seenIds.has(d.id)),
  ]

  return NextResponse.json(merged)
}
