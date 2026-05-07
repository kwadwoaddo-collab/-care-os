import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// TODO: Remove DEV_BYPASS_AUTH before production deployment.
const DEV_BYPASS_AUTH = process.env.NODE_ENV === 'development'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── Development: allow all requests through ──────────────────────────────
  if (DEV_BYPASS_AUTH) {
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
  if (pathname.startsWith('/admin')) {
    if (!user) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // ── Worker API routes: token-based auth handled by route handlers ───────
  // Worker portal pages (/worker/*) — the client app validates its own token.
  // Worker API routes (/api/worker/*) use requireWorker() in the handler.
  // We allow these through middleware and let the handler enforce auth.

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
