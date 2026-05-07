/**
 * lib/rateLimit.ts
 *
 * Lightweight in-process rate limiter for API route handlers.
 *
 * Design decisions:
 * - In-memory (Map) — zero dependencies, works on Vercel serverless.
 * - Per-key sliding window: resets after `windowMs` from first request.
 * - Returns { allowed, retryAfter } — callers decide how to respond.
 * - Easy to swap for a Redis-backed implementation: replace the Map with
 *   ioredis or @upstash/ratelimit without changing call sites.
 *
 * Typical usage in a Route Handler:
 *
 *   const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
 *   const rl = rateLimit({ key: `upload:${ip}`, limit: 5, windowMs: 60_000 })
 *   if (!rl.allowed) {
 *     return NextResponse.json({ error: 'Too many requests' }, {
 *       status: 429,
 *       headers: { 'Retry-After': String(Math.ceil(rl.retryAfter / 1000)) },
 *     })
 *   }
 *
 * NOTE: because Vercel may run multiple serverless instances, this in-memory
 * store is per-instance. For global rate limiting across instances, replace
 * the store with Redis (e.g. Upstash). For most launch-phase traffic the
 * per-instance limit is sufficient.
 */

interface Window {
  count:     number
  resetAt:   number
}

const store = new Map<string, Window>()

export interface RateLimitResult {
  allowed:    boolean
  retryAfter: number
}

export interface RateLimitOptions {
  key:      string
  limit:    number
  windowMs: number
}

export function rateLimit({ key, limit, windowMs }: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  const win = store.get(key)

  if (!win || now >= win.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfter: 0 }
  }

  if (win.count < limit) {
    win.count++
    return { allowed: true, retryAfter: 0 }
  }

  return { allowed: false, retryAfter: win.resetAt - now }
}

// Convenience factory that partially applies common defaults.
export function ipRateLimit(request: Request, route: string, limit: number, windowMs = 60_000) {
  const ip  = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
           ?? request.headers.get('x-real-ip')
           ?? 'unknown'
  return rateLimit({ key: `${route}:${ip}`, limit, windowMs })
}
