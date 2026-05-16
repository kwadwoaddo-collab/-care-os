import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { getPaginationParams, getRange, buildPaginationMeta } from '@/lib/pagination'
import { requireAdmin } from '@/lib/auth/requireAdmin'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const sp         = request.nextUrl.searchParams
  const search     = sp.get('search')      ?? ''
  const status     = sp.get('status')      ?? ''
  const formStatus = sp.get('form_status') ?? ''
  const archived   = sp.get('archived')    === 'true'
  const { page, pageSize } = getPaginationParams(Object.fromEntries(sp.entries()))

  let query = adminClient
    .from('applicants')
    .select(
      `id, first_name, last_name, email, job_role, status, created_at,
       rejected_at, rejection_reason,
       form_responses ( status, submitted_at ),
       staff_profiles!staff_profiles_applicant_id_fkey ( id, status )`,
      { count: 'exact' }
    )
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (archived) {
    // Archived view: only rejected applicants
    query = query.eq('status', 'rejected')
  } else if (status) {
    query = query.eq('status', status)
  } else {
    // Default active pipeline: exclude rejected
    query = query.neq('status', 'rejected')
  }

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,job_role.ilike.%${search}%`
    )
  }

  const { from, to } = getRange(page, pageSize)
  query = query.range(from, to)

  const { data, error, count } = await query

  if (error) {
    console.error('[admin/applicants] fetch failed:', error)
    return NextResponse.json({ error: 'Failed to fetch applicants', details: error }, { status: 500 })
  }

  const TERMINATED_STAFF_STATUSES = new Set(['terminated', 'inactive'])

  let applicants = (data ?? []).map((row) => {
    const responses    = row.form_responses as Array<{ status: string; submitted_at: string | null }> | null
    const formResponse = responses && responses.length > 0 ? responses[0] : null
    const staffRows    = row.staff_profiles as Array<{ id: string; status: string }> | null
    const linkedStaff  = staffRows && staffRows.length > 0 ? staffRows[0] : null
    return {
      id:               row.id,
      first_name:       row.first_name,
      last_name:        row.last_name,
      email:            row.email,
      job_role:         row.job_role,
      status:           row.status,
      created_at:       row.created_at,
      rejected_at:      row.rejected_at ?? null,
      rejection_reason: row.rejection_reason ?? null,
      form_status:      formResponse?.status       ?? null,
      submitted_at:     formResponse?.submitted_at ?? null,
      linked_staff_status: linkedStaff?.status     ?? null,
    }
  })

  // Exclude hired applicants whose linked staff profile is terminated/inactive
  // from the active pipeline — they should not show as "active" candidates
  if (!archived) {
    applicants = applicants.filter((a) => {
      if (a.linked_staff_status && TERMINATED_STAFF_STATUSES.has(a.linked_staff_status)) return false
      return true
    })
  }

  // form_status is computed post-join — filter in memory
  if (formStatus) applicants = applicants.filter((a) => a.form_status === formStatus)

  const total = formStatus ? applicants.length : (count ?? applicants.length)
  const meta  = buildPaginationMeta(total, page, pageSize)

  return NextResponse.json({ data: applicants, meta })
}
