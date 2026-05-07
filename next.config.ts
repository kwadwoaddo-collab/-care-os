import type { NextConfig } from 'next'

// ── Security headers ──────────────────────────────────────────────────────────
// Applied to all routes. CSP is intentionally permissive on script/style to
// support Next.js inline hydration and Supabase auth. Tighten in future sprints.

const SUPABASE_HOSTS = [
  process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
    : '*.supabase.co',
]

const cspDirectives = [
  "default-src 'self'",
  // Scripts: Next.js requires 'unsafe-inline' for hydration chunks in dev;
  // in production, nonce-based CSP would be stricter but requires custom server.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  // Styles: Tailwind inlines critical CSS
  "style-src 'self' 'unsafe-inline'",
  // Images: allow data URIs and Supabase storage
  `img-src 'self' data: blob: https://${SUPABASE_HOSTS[0]}`,
  // Fonts: local only (no Google Fonts)
  "font-src 'self'",
  // Supabase API calls and Resend webhooks
  `connect-src 'self' https://${SUPABASE_HOSTS[0]} wss://${SUPABASE_HOSTS[0]}`,
  // File uploads via form
  "form-action 'self'",
  // Prevent framing
  "frame-ancestors 'none'",
  // Disable object tags
  "object-src 'none'",
  // Upgrade insecure requests in production
  ...(process.env.NODE_ENV === 'production' ? ['upgrade-insecure-requests'] : []),
].join('; ')

const securityHeaders = [
  // Prevent clickjacking
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Prevent MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Control referrer info sent to external sites
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Restrict browser features not needed by this app
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
  // Enable DNS prefetch for performance
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  // CSP
  { key: 'Content-Security-Policy', value: cspDirectives },
]

const nextConfig: NextConfig = {
  // Strict mode surfaces React double-invocation bugs early
  reactStrictMode: true,

  async headers() {
    return [
      {
        // Apply to all routes
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },

  // Suppress source maps in production to avoid exposing business logic
  productionBrowserSourceMaps: false,
}

export default nextConfig
