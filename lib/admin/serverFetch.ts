import 'server-only'
import { cookies } from 'next/headers'

/**
 * Server-side fetch wrapper for admin Server Components.
 *
 * When a Server Component calls fetch() to a same-origin API route, Next.js
 * does NOT automatically forward the browser's session cookies. Without
 * cookies, requireAdmin() returns 401 and the page renders empty data.
 *
 * This wrapper reads the current request's cookies (via next/headers) and
 * forwards them in the Cookie header so the API route's requireAdmin() can
 * validate the Supabase session.
 *
 * Usage (same signature as fetch):
 *   const res = await adminFetch(`${BASE}/api/admin/clients?${params}`)
 *   if (!res.ok) return []
 *   return res.json()
 */
export async function adminFetch(url: string, init?: RequestInit): Promise<Response> {
  const cookieStore  = await cookies()
  const cookieHeader = cookieStore.getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join('; ')

  return fetch(url, {
    ...init,
    headers: {
      ...(init?.headers as Record<string, string> | undefined),
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
  })
}
