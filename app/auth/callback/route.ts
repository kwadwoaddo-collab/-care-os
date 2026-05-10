import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Supabase PKCE auth callback.
 *
 * After email-based auth flows (admin invite, email confirmation, password
 * reset), Supabase redirects here with a one-time ?code= query parameter.
 * This handler exchanges the code for a session and redirects the user to
 * the appropriate destination.
 *
 * Without this route, email auth flows fail silently — the code is never
 * exchanged, no session is created, and the user lands on the login page
 * still unauthenticated.
 *
 * Supabase dashboard → Auth → URL Configuration → Redirect URLs must include:
 *   {NEXT_PUBLIC_APP_URL}/auth/callback
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code     = searchParams.get('code')
  const next     = searchParams.get('next') ?? '/admin'
  const errorParam = searchParams.get('error')
  const errorDesc  = searchParams.get('error_description')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  if (errorParam) {
    console.error('[auth/callback] Supabase returned error:', errorParam, errorDesc)
    return NextResponse.redirect(
      `${appUrl}/admin/login?error=${encodeURIComponent(errorDesc ?? errorParam)}`
    )
  }

  if (!code) {
    return NextResponse.redirect(`${appUrl}/admin/login`)
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    },
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[auth/callback] code exchange failed:', error.message)
    return NextResponse.redirect(
      `${appUrl}/admin/login?error=${encodeURIComponent(error.message)}`
    )
  }

  return NextResponse.redirect(`${appUrl}${next}`)
}
