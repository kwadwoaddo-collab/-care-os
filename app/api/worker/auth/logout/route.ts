import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { adminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json() as { token?: string }

    if (!token) {
      return NextResponse.json({ ok: true }) // Already logged out or no token
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    // 1. Find profile to log audit
    const { data: sp } = await adminClient
      .from('staff_profiles')
      .select('id, company_id')
      .eq('portal_token_hash', tokenHash)
      .maybeSingle()

    if (sp) {
      // 2. Clear token (Invalidate access)
      await adminClient
        .from('staff_profiles')
        .update({ 
          portal_token_hash: null,
          portal_token_expires_at: null 
        })
        .eq('id', sp.id)

      // 3. Log audit
      void adminClient.from('audit_logs').insert({
        company_id:  sp.company_id,
        action:      'worker.logout',
        entity_type: 'staff_profile',
        entity_id:   sp.id,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[worker/auth/logout] crash:', err)
    return NextResponse.json({ ok: true }) // Still return ok for logout
  }
}
