import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { adminClient } from '@/lib/supabase/admin'
import { archiveDocument } from '@/lib/documents/lifecycle'

const BodySchema = z.object({
  documentId: z.string().uuid(),
  reason:     z.string().optional(),
})

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body   = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { companyId, userId } = auth.ctx

  const { data: doc } = await adminClient
    .from('documents')
    .select('id')
    .eq('id', parsed.data.documentId)
    .eq('company_id', companyId)
    .single()

  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  await archiveDocument({
    documentId:  parsed.data.documentId,
    companyId,
    archivedBy:  userId,
    reason:      parsed.data.reason,
  })

  return NextResponse.json({ ok: true })
}
