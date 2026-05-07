import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// TODO: Remove DEV_BYPASS_AUTH before production deployment.
const DEV_BYPASS_AUTH = process.env.NODE_ENV === 'development'

// Paths under /admin that are public (no session required)
const ADMIN_PUBLIC = new Set(['/admin/login', '/admin/logout'])

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Development: allow all requests through ──────────────────────────────
  if (DEV_BYPASS_AUTH) {
    return NextResponse.next()
  }

  // ── Always allow public admin paths (login, logout) ───────────────────────
  if (ADMIN_PUBLIC.has(pathname)) {
    return NextResponse.next()
  }

  // ── Refresh Supabase session via cookie ──────────────────────────────────
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

  // ── Admin routes: require authenticated user ────────────────────────────
  if (!user) {
    const loginUrl = new URL('/admin/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all admin routes (pages and API).
     * Exclude:
     *   - _next/static, _next/image, favicon
     *   - Public applicant routes (/apply/*, /api/applicant/*)
     *   - Worker token-based routes (handled in-handler)
     */
    '/admin/:path*',
    '/api/admin/:path*',
  ],
}
