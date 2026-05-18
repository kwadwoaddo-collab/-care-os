import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin }    from '@/lib/auth/requireAdmin'
import { approveDocument } from '@/lib/documents/verification'

const BodySchema = z.object({
  documentId:         z.string().uuid(),
  staffProfileId:     z.string().uuid().optional(),
  verificationNotes:  z.string().max(2000).optional(),
})

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const body   = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', issues: parsed.error.issues }, { status: 400 })
  }

  const result = await approveDocument({
    documentId:        parsed.data.documentId,
    companyId:         auth.ctx.companyId,
    approvedBy:        auth.ctx.userId,
    staffProfileId:    parsed.data.staffProfileId,
    verificationNotes: parsed.data.verificationNotes,
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
