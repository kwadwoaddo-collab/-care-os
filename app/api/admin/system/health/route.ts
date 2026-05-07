import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'

// Public-ish — no auth guard intentionally (health checks run before session).
// In production, restrict to internal network or add a secret header check.

export async function GET() {
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
    appUrlConfigured,
    authSession,
    timestamp,
  })
}
