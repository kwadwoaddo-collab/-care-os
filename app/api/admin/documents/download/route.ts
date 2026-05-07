import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const { searchParams } = new URL(request.url)
  const filePath = searchParams.get('path')

  if (!filePath) {
    return NextResponse.json({ error: 'path query param required' }, { status: 400 })
  }

  // Verify the path belongs to a real document row owned by this company
  const { data: docRow, error: docErr } = await adminClient
    .from('documents')
    .select('id, company_id')
    .eq('file_path', filePath)
    .eq('company_id', companyId)
    .maybeSingle()

  if (docErr) {
    console.error('[admin/documents/download] doc lookup error:', docErr.message)
    return NextResponse.json({ error: 'Failed to verify document' }, { status: 500 })
  }

  if (!docRow) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  // Generate a short-lived signed URL (60 seconds — enough for the browser to start the download)
  const { data, error } = await adminClient.storage
    .from('care-os-documents')
    .createSignedUrl(filePath, 60)

  if (error || !data?.signedUrl) {
    console.error('[admin/documents/download] signed URL failed:', error)
    return NextResponse.json({ error: 'Failed to generate download link' }, { status: 500 })
  }

  // Redirect the browser to the signed URL — the file will download directly from Storage
  return NextResponse.redirect(data.signedUrl)
}
