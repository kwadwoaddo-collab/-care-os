import { requireAdmin } from '@/lib/auth/requireAdmin'
import { adminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function DocumentsHubPage() {
  const auth = await requireAdmin()
  if (!auth.ok) return null

  const { companyId } = auth.ctx

  const [pendingVerificationRes, unrecognisedRes, totalRes] = await Promise.all([
    adminClient
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('review_status', 'pending_review')
      .is('archived_at', null),

    adminClient
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('review_status', 'unrecognised')
      .is('archived_at', null),

    adminClient
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .is('archived_at', null),
  ])

  const pendingVerification = pendingVerificationRes.count ?? 0
  const unrecognised = unrecognisedRes.count ?? 0
  const total = totalRes.count ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-primary tracking-tight">Documents</h1>
        <p className="text-sm text-on-surface-variant mt-0.5">
          Manage staff document verification and routing rules.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4">
          <p className="text-xs text-on-surface-variant font-medium uppercase tracking-wide">Total Documents</p>
          <p className="text-3xl font-bold text-on-surface mt-1">{total}</p>
        </div>
        <div className={`border rounded-xl p-4 ${pendingVerification > 0 ? 'bg-amber-50 border-amber-200' : 'bg-surface-container-lowest border-outline-variant'}`}>
          <p className="text-xs text-on-surface-variant font-medium uppercase tracking-wide">Awaiting Verification</p>
          <p className={`text-3xl font-bold mt-1 ${pendingVerification > 0 ? 'text-amber-700' : 'text-on-surface'}`}>{pendingVerification}</p>
        </div>
        <div className={`border rounded-xl p-4 ${unrecognised > 0 ? 'bg-red-50 border-red-200' : 'bg-surface-container-lowest border-outline-variant'}`}>
          <p className="text-xs text-on-surface-variant font-medium uppercase tracking-wide">Unrecognised</p>
          <p className={`text-3xl font-bold mt-1 ${unrecognised > 0 ? 'text-red-700' : 'text-on-surface'}`}>{unrecognised}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <a
          href="/admin/documents/verification"
          className="group flex items-start gap-4 bg-surface-container-lowest border border-outline-variant hover:border-primary rounded-xl p-5 transition-colors"
        >
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-[20px]">verified</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-on-surface group-hover:text-primary transition-colors">
                Document Verification
              </p>
              {pendingVerification > 0 && (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                  {pendingVerification} pending
                </span>
              )}
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Review and approve uploaded documents before they satisfy compliance requirements.
            </p>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary text-[18px] flex-shrink-0 mt-0.5 transition-colors">arrow_forward</span>
        </a>

        <a
          href="/admin/documents/routing"
          className="group flex items-start gap-4 bg-surface-container-lowest border border-outline-variant hover:border-primary rounded-xl p-5 transition-colors"
        >
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-[20px]">route</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-on-surface group-hover:text-primary transition-colors">
                Routing Rules
              </p>
              {unrecognised > 0 && (
                <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800">
                  {unrecognised} unrecognised
                </span>
              )}
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Manage automatic document classification and folder routing across all staff files.
            </p>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary text-[18px] flex-shrink-0 mt-0.5 transition-colors">arrow_forward</span>
        </a>
      </div>
    </div>
  )
}
