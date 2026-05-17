// app/admin/system/page.tsx
// System health dashboard for pre-launch operational visibility.
import { adminFetch } from '@/lib/admin/serverFetch'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/auth/permissions'
import AccessDenied from '@/components/admin/AccessDenied'
import SystemHealthMobile from '@/components/admin/SystemHealthMobile'
import SystemHealthDesktop from '@/components/admin/SystemHealthDesktop'
import type { HealthResponse } from '@/app/api/admin/system/health/route'

async function getHealth(): Promise<HealthResponse | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res = await adminFetch(`${baseUrl}/api/admin/system/health`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    return res.json() as Promise<HealthResponse>
  } catch {
    return null
  }
}

// ── Build timestamp ──────────────────────────────────────────────────────────
// Set at build time; falls back to process start.
const BUILD_TIMESTAMP =
  process.env.NEXT_PUBLIC_BUILD_TIME ??
  new Date().toISOString()

export default async function SystemPage() {
  const auth = await requireAdmin()
  if (!auth.ok || !can(auth.ctx.role, 'system:read')) return <AccessDenied />

  const health = await getHealth()

  const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? 'Not set'
  const supaUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'Not set'
  const nodeEnv  = process.env.NODE_ENV ?? 'unknown'
  
  const builtAt = new Date(BUILD_TIMESTAMP).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  })

  const systemData = {
    health,
    appUrl,
    supaUrl,
    nodeEnv,
    builtAt
  }

  return (
    <div className="h-full bg-background min-h-screen lg:bg-transparent lg:min-h-0">
      {/* Mobile View */}
      <div className="block lg:hidden h-full">
        <SystemHealthMobile data={systemData} />
      </div>

      {/* Desktop View */}
      <div className="hidden lg:block">
        <SystemHealthDesktop data={systemData} />
      </div>
    </div>
  )
}
