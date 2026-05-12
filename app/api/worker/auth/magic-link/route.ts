import { NextRequest, NextResponse } from 'next/server'
import { requestWorkerMagicLink } from '@/lib/worker/magic-link'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json() as { email?: string }

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const result = await requestWorkerMagicLink(email)

    // We always return 200/OK if the process didn't crash (Generic Success)
    if (result.success) {
      return NextResponse.json({ 
        ok: true, 
        message: 'If an account exists for this email, a login link has been sent.' 
      })
    }

    return NextResponse.json({ error: result.error ?? 'Something went wrong' }, { status: result.status })
  } catch (err) {
    console.error('[worker/auth/magic-link] crash:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
