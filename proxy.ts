/**
 * proxy.ts (formerly middleware.ts — renamed for Next.js 16 compatibility)
 *
 * Protects /admin/* PAGE routes.
 *
 * Design notes:
 * - API routes (/api/admin/*) are NOT included in the matcher. They are
 *   protected by requireAdmin() which returns JSON 401 on auth failure.
 *   Including them here would redirect unauthenticated server-side fetches
 *   (from Server Components) to the HTML login page, breaking JSON parsing.
 * - QA bypass requires NODE_ENV=development AND QA_BYPASS_AUTH=true.
 *   It is structurally impossible to activate in production.
 */
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Bypass is opt-in: both NODE_ENV=development AND QA_BYPASS_AUTH=true must be set.
const shouldBypassAuth =
  process.env.NODE_ENV === 'development' &&
  process.env.QA_BYPASS_AUTH === 'true'

// Public paths that don't require authentication
const ADMIN_PUBLIC = new Set(['/admin/login', '/admin/logout'])

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── QA bypass (opt-in, dev-only) ─────────────────────────────────────────
  if (shouldBypassAuth) {
    return NextResponse.next()
  }

  // ── Allow public admin paths ──────────────────────────────────────────────
  if (ADMIN_PUBLIC.has(pathname)) {
    return NextResponse.next()
  }

  // ── Refresh Supabase session via cookie ───────────────────────────────────
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()

  // ── Require authenticated session for all admin pages ─────────────────────
  if (!user) {
    const loginUrl = new URL('/admin/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/admin/:path*'],
}
