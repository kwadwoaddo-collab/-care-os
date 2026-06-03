import { Suspense }  from 'react'
import Link from 'next/link'
import MobilePageHeader from '@/components/admin/MobilePageHeader'
import ComplianceDashboardClient from './ComplianceDashboardClient'
import { createClient } from '@/lib/supabase/server'
import { normaliseRole } from '@/lib/rbac/roles'

// ── GET /admin/compliance ─────────────────────────────────────────────────────
//
// Thin server wrapper — all data fetching happens client-side in
// ComplianceDashboardClient so filters/search work without page reload.

export const metadata = {
  title: 'Compliance Command | Care OS',
  description: 'Staff compliance dashboard — monitor, filter, and act on compliance across your team.',
}

export default async function CompliancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let userRole = ''
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    userRole = normaliseRole((profile?.role as string | null) ?? '')
  }

  return (
    <div className="space-y-4">
      {/* Mobile header */}
      <MobilePageHeader
        title="Compliance Command"
        subtitle="Active monitoring of credentials, onboarding, and training health."
      />

      {/* Mobile: Training Matrix quick link */}
      <div className="lg:hidden">
        <Link
          href="/admin/compliance/training-matrix"
          className="flex items-center gap-3 bg-secondary-container/10 border border-secondary-container/20 text-secondary rounded-xl px-4 py-3 text-sm font-medium hover:bg-secondary-container/20 transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">grid_view</span>
          <div>
            <p className="font-semibold">Training Matrix</p>
            <p className="text-xs font-normal text-secondary/70">View mandatory training compliance across all staff</p>
          </div>
          <span className="material-symbols-outlined text-[18px] ml-auto">chevron_right</span>
        </Link>
      </div>

      {/* Desktop header */}
      <div className="hidden lg:flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-primary tracking-tight">Compliance Command</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Active monitoring of credentials, onboarding, and training health.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/compliance/training-matrix"
            id="training-matrix-link"
            className="bg-secondary-container/10 text-secondary font-medium py-2 px-4 rounded-lg hover:bg-secondary-container/20 transition-colors flex items-center gap-2 text-sm"
          >
            <span className="material-symbols-outlined text-[18px]">grid_view</span>
            Training Matrix
          </Link>
          <a
            href="/api/admin/compliance/export"
            download
            id="export-report-btn"
            className="bg-secondary-container/10 text-secondary font-medium py-2 px-4 rounded-lg hover:bg-secondary-container/20 transition-colors flex items-center gap-2 text-sm"
          >
            <span className="material-symbols-outlined text-[18px]">cloud_download</span>
            Export Report
          </a>
          <a
            href="/admin/documents"
            id="upload-documents-btn"
            className="bg-primary text-on-primary font-medium py-2 px-4 rounded-lg hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2 text-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Upload Documents
          </a>
        </div>
      </div>

      {/* Client dashboard — handles filter chips, search, table, bulk actions */}
      <Suspense
        fallback={
          <div className="py-12 text-center text-sm text-gray-400 animate-pulse">
            Loading compliance dashboard…
          </div>
        }
      >
        <ComplianceDashboardClient userRole={userRole} />
      </Suspense>
    </div>
  )
}
