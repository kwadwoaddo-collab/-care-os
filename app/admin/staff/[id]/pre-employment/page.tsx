import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import PreEmploymentChecksClient from './PreEmploymentChecksClient'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PreEmploymentCheck {
  id: string
  staff_profile_id: string
  check_type: 'dbs' | 'right_to_work' | 'reference' | 'id_verification'
  status: 'not_started' | 'in_progress' | 'complete' | 'rejected'
  dbs_type: string | null
  dbs_certificate_number: string | null
  dbs_issue_date: string | null
  dbs_expiry_date: string | null
  rtw_document_type: string | null
  rtw_checked_date: string | null
  rtw_expiry_date: string | null
  rtw_checked_by: string | null
  ref_referee_name: string | null
  ref_referee_role: string | null
  ref_referee_email: string | null
  ref_requested_date: string | null
  ref_received_date: string | null
  ref_employer_name: string | null
  notes: string | null
  completed_at: string | null
  completed_by: string | null
  created_at: string
  updated_at: string
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PreEmploymentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // Require admin session
  const auth = await requireAdmin()
  if (!auth.ok) {
    redirect('/admin/login')
  }
  const { companyId } = auth.ctx

  // Fetch staff profile to get display name and validate ownership
  const { data: sp, error: spError } = await adminClient
    .from('staff_profiles')
    .select('id, first_name, last_name, email, job_role, job_title, status')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (spError) {
    throw new Error(`Failed to fetch staff profile: ${spError.message}`)
  }
  if (!sp) notFound()

  const displayName =
    [sp.first_name, sp.last_name].filter(Boolean).join(' ') ||
    sp.email ||
    'Unknown'

  // Fetch pre-employment checks
  const { data: checks, error: checksError } = await adminClient
    .from('pre_employment_checks')
    .select('*')
    .eq('staff_profile_id', id)
    .order('check_type')

  if (checksError) {
    // Non-fatal: table may not exist yet (migration pending) — render with empty state
    console.error('[pre-employment/page] checks fetch error:', checksError.message)
  }

  const typedChecks = (checks ?? []) as PreEmploymentCheck[]

  const completeCount = typedChecks.filter((c) => c.status === 'complete').length

  return (
    <div className="max-w-3xl mx-auto">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="mb-6">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-on-surface-variant mb-3">
          <Link href="/admin/staff" className="hover:text-primary transition-colors">
            Staff Directory
          </Link>
          <span className="text-outline-variant">›</span>
          <Link href={`/admin/staff/${id}`} className="hover:text-primary transition-colors">
            {displayName}
          </Link>
          <span className="text-outline-variant">›</span>
          <span className="text-on-surface font-medium">Pre-Employment Checks</span>
        </nav>

        {/* Title row */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1
              className="text-2xl font-bold text-on-surface leading-tight"
              style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}
            >
              Pre-Employment Checks
            </h1>
            <p className="text-sm text-on-surface-variant mt-1">
              {displayName}
              {(sp.job_title ?? sp.job_role) && (
                <>
                  <span className="mx-2 text-outline-variant">·</span>
                  {sp.job_title ?? (sp.job_role as string).replace(/_/g, ' ')}
                </>
              )}
            </p>
          </div>

          {/* Summary pill */}
          <div
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ring-1 ring-inset ${
              completeCount === 4
                ? 'bg-green-50 text-green-700 ring-green-500/30'
                : completeCount > 0
                ? 'bg-yellow-50 text-yellow-700 ring-yellow-500/30'
                : 'bg-gray-100 text-gray-600 ring-gray-400/30'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">
              {completeCount === 4 ? 'verified' : 'pending'}
            </span>
            {completeCount} / 4 Complete
          </div>
        </div>
      </div>

      {/* ── Info banner ─────────────────────────────────────────────────── */}
      <div className="mb-5 flex items-start gap-3 bg-surface-container-low border border-outline-variant rounded-xl p-4">
        <span className="material-symbols-outlined text-[20px] text-on-surface-variant shrink-0 mt-0.5">info</span>
        <p className="text-sm text-on-surface-variant">
          These checks must be completed before the staff member can be moved to{' '}
          <span className="font-semibold text-on-surface">Active</span> status. Click{' '}
          <span className="font-semibold text-on-surface">Update Check</span> on any card to record details and change the status.
        </p>
      </div>

      {/* ── Check Cards ─────────────────────────────────────────────────── */}
      <PreEmploymentChecksClient staffProfileId={id} checks={typedChecks} />

      {/* ── Back link ───────────────────────────────────────────────────── */}
      <div className="mt-6">
        <Link
          href={`/admin/staff/${id}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-secondary hover:text-secondary/80 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to Staff Profile
        </Link>
      </div>
    </div>
  )
}
