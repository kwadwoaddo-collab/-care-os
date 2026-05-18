import { requireAdmin }         from '@/lib/auth/requireAdmin'
import { getVerificationQueue } from '@/lib/documents/verification'
import VerificationQueueClient  from './VerificationQueueClient'

export const dynamic = 'force-dynamic'

export default async function DocumentVerificationPage() {
  const auth = await requireAdmin()
  if (!auth.ok) return null

  const { queue, diagnostics } = await getVerificationQueue(auth.ctx.companyId)

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Document Verification</h1>
          <p className="text-sm text-gray-500 mt-1">
            Review, verify, and approve workforce documents before they satisfy compliance requirements.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/admin/documents/routing"
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">route</span>
            Routing review
          </a>
          <a
            href="/admin/staff"
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">arrow_back</span>
            Back to staff
          </a>
        </div>
      </div>

      {/* Pending alert */}
      {diagnostics.pendingVerification > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <span className="material-symbols-outlined text-amber-600 text-[20px] mt-0.5">pending_actions</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {diagnostics.pendingVerification} document{diagnostics.pendingVerification !== 1 ? 's' : ''} awaiting verification
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              Unverified documents do not satisfy compliance requirements until approved.
            </p>
          </div>
        </div>
      )}

      <VerificationQueueClient queue={queue} diagnostics={diagnostics} />
    </div>
  )
}
