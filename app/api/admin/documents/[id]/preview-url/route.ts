import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { adminClient }   from '@/lib/supabase/admin'

// Returns a 5-minute signed URL for inline preview — safe to expose to admin UI.

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { id } = await params

  const { data: doc, error: docErr } = await adminClient
    .from('documents')
    .select('id, file_path, mime_type, company_id')
    .eq('id', id)
    .eq('company_id', auth.ctx.companyId)
    .single()

  if (docErr || !doc?.file_path) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  const { data, error } = await adminClient.storage
    .from('care-os-documents')
    .createSignedUrl(doc.file_path, 300)  // 5 minutes for inline viewing

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Failed to generate preview URL' }, { status: 500 })
  }

  return NextResponse.json({
    url:      data.signedUrl,
    mimeType: doc.mime_type ?? null,
  })
}
