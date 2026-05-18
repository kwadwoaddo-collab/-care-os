import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin }   from '@/lib/auth/requireAdmin'
import { rejectDocument } from '@/lib/documents/verification'

const BodySchema = z.object({
  documentId:     z.string().uuid(),
  rejectedReason: z.string().min(1).max(1000),
  staffProfileId: z.string().uuid().optional(),
})

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body   = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', issues: parsed.error.issues }, { status: 400 })
  }

  const result = await rejectDocument({
    documentId:     parsed.data.documentId,
    companyId:      auth.ctx.companyId,
    rejectedBy:     auth.ctx.userId,
    rejectedReason: parsed.data.rejectedReason,
    staffProfileId: parsed.data.staffProfileId,
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
