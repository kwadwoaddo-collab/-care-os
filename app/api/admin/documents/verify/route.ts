import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin }    from '@/lib/auth/requireAdmin'
import { verifyDocument }  from '@/lib/documents/verification'

const BodySchema = z.object({
  documentId:         z.string().uuid(),
  verificationMethod: z.enum(['original_seen','certified_copy','digital_check','dbs_update_service','sponsor_check','internal_review']),
  originalSeen:       z.boolean().optional(),
  originalSeenMethod: z.enum(['in_person','video_call','certified_copy','digital']).optional(),
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

  const result = await verifyDocument({
    ...parsed.data,
    companyId:  auth.ctx.companyId,
    verifiedBy: auth.ctx.userId,
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
