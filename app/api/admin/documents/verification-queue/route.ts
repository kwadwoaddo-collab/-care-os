import { NextResponse }          from 'next/server'
import { requireAdmin }          from '@/lib/auth/requireAdmin'
import { getVerificationQueue }  from '@/lib/documents/verification'

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const result = await getVerificationQueue(auth.ctx.companyId)
  return NextResponse.json(result)
}
