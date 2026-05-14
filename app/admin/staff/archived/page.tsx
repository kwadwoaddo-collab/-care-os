import Link from 'next/link'
import { adminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can } from '@/lib/auth/permissions'
import AccessDenied from '@/components/admin/AccessDenied'
import ArchivedStaffClient, { type ArchivedStaffMember } from './ArchivedStaffClient'

export default async function ArchivedStaffPage() {
  const auth = await requireAdmin()
  if (!auth.ok || !can(auth.ctx.role, 'staff:read')) return <AccessDenied />

  const { companyId, role } = auth.ctx

  const { data: staff } = await adminClient
    .from('staff_profiles')
    .select('id, first_name, last_name, email, job_role, left_at, exit_reason, exit_notes, terminated_at')
    .eq('company_id', companyId)
    .eq('status', 'terminated')
    .order('terminated_at', { ascending: false, nullsFirst: false })

  const canDelete = role === 'company_admin' || role === 'super_admin'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/admin/staff"
              className="text-sm text-on-surface-variant hover:text-primary transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Staff & Recruitment
            </Link>
          </div>
          <h1 className="text-xl font-semibold text-primary tracking-tight">Archived Staff</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Staff members with Terminated status. Records are preserved for audit purposes.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20">
            {staff?.length ?? 0} archived
          </span>
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
        <span className="material-symbols-outlined text-amber-600 text-[20px] shrink-0 mt-0.5">info</span>
        <div className="text-sm text-amber-800">
          <span className="font-semibold">Archive view only.</span>{' '}
          Terminated staff are hidden from all active lists, shift assignments, and compliance dashboards.
          All historical data is preserved. Use the Restore action to reinstate a staff member.
          {canDelete && (
            <> Permanent deletion is irreversible and restricted to company admins.</>
          )}
        </div>
      </div>

      <ArchivedStaffClient
        staff={(staff ?? []) as ArchivedStaffMember[]}
        canDelete={canDelete}
      />
    </div>
  )
}
