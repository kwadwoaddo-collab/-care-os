import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/auth/permissions'
import { forbidden } from '@/lib/auth/responses'

// Previously public — now requires an authenticated admin session with system:read.
// External health monitors should use a dedicated /api/health route (future work).
export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'system:read')) return forbidden('Insufficient permissions')
  const timestamp = new Date().toISOString()

  // ── Database ────────────────────────────────────────────────────────────────
  let database = false
  try {
    const { error } = await adminClient
      .from('companies')
      .select('id')
      .limit(1)
    database = !error
  } catch { /* stays false */ }

  // ── Storage ─────────────────────────────────────────────────────────────────
  let storage = false
  try {
    const { error } = await adminClient.storage.listBuckets()
    storage = !error
  } catch { /* stays false */ }

  // ── Config checks ────────────────────────────────────────────────────────────
  const resendConfigured = Boolean(
    process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.length > 10
  )
  const emailFromConfigured = Boolean(
    process.env.EMAIL_FROM ?? process.env.INVITE_FROM_EMAIL
  )
  const appUrlConfigured = Boolean(
    process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL.startsWith('http')
  )

  // ── Auth session — not testable server-side without cookies; report config ──
  const authSession = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  return NextResponse.json({
    database,
    storage,
    resendConfigured,
    emailFromConfigured,
    appUrlConfigured,
    authSession,
    timestamp,
  })
}
