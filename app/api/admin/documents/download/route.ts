import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'

// TODO: RESTORE AUTH — remove DEV_BYPASS_AUTH before deploying or merging to main.
const DEV_BYPASS_AUTH = process.env.NODE_ENV === 'development'

export async function GET(request: NextRequest) {
  if (!DEV_BYPASS_AUTH) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const filePath = searchParams.get('path')

  if (!filePath) {
    return NextResponse.json({ error: 'path query param required' }, { status: 400 })
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
