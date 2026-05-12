import { Suspense }  from 'react'
import ComplianceDashboardClient from './ComplianceDashboardClient'

// ── GET /admin/compliance ─────────────────────────────────────────────────────
//
// Thin server wrapper — all data fetching happens client-side in
// ComplianceDashboardClient so filters/search work without page reload.

export const metadata = {
  title: 'Compliance | Care OS',
  description: 'Staff compliance dashboard — monitor, filter, and act on compliance across your team.',
}

export default function CompliancePage() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Compliance</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Monitor mandatory training, document expiry, and activation blockers across your team.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/admin/compliance/reminders/send"
            data-method="post"
            id="send-digest-btn"
            className="rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1.5 text-xs font-medium hover:bg-indigo-100 transition-colors"
          >
            Send digest
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
        <ComplianceDashboardClient />
      </Suspense>
    </div>
  )
}
