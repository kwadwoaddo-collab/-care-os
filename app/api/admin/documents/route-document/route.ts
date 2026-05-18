import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { routeDocument, routeUnroutedDocuments } from '@/lib/documents/routing'

const BodySchema = z.union([
  z.object({ mode: z.literal('single'), documentId: z.string().uuid(), documentType: z.string() }),
  z.object({ mode: z.literal('batch') }),
])

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body   = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { companyId, userId } = auth.ctx

  if (parsed.data.mode === 'batch') {
    const result = await routeUnroutedDocuments(companyId)
    return NextResponse.json({ ok: true, ...result })
  }

  const result = await routeDocument({
    documentId:   parsed.data.documentId,
    documentType: parsed.data.documentType,
    companyId,
    routedBy:     userId,
  })

  return NextResponse.json({ ...result })
}
