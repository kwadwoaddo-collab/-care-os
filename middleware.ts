import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Bypass is opt-in: both NODE_ENV=development AND QA_BYPASS_AUTH=true must be set.
// Set QA_BYPASS_AUTH=true in .env.local to enable — never in production.
const shouldBypassAuth =
  process.env.NODE_ENV === 'development' &&
  process.env.QA_BYPASS_AUTH === 'true'

// Paths under /admin that are public (no session required)
const ADMIN_PUBLIC = new Set(['/admin/login', '/admin/logout'])

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── QA bypass (opt-in: NODE_ENV=development + QA_BYPASS_AUTH=true) ──────
  if (shouldBypassAuth) {
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
     * Match admin PAGE routes only — not API routes.
     *
     * API routes (/api/admin/*) are intentionally excluded: they are protected
     * by requireAdmin() which returns JSON { error: 'Unauthorized' } (401).
     * Including them here would cause the middleware to redirect unauthenticated
     * server-side fetches to /admin/login (HTML), making fetch().ok === true and
     * crashing JSON.parse with "Unexpected token '<'".
     *
     * Excludes: _next/static, _next/image, favicon, /apply/*, worker token routes.
     */
    '/admin/:path*',
  ],
}
