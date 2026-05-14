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
       form_responses ( status, submitted_at )`,
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
    return NextResponse.json({ error: 'Failed to fetch applicants' }, { status: 500 })
  }

  let applicants = (data ?? []).map((row) => {
    const responses    = row.form_responses as Array<{ status: string; submitted_at: string | null }> | null
    const formResponse = responses && responses.length > 0 ? responses[0] : null
    return {
      id:               row.id,
      first_name:       row.first_name,
      last_name:        row.last_name,
      email:            row.email,
      job_role:         row.job_role,
      status:           row.status,
      created_at:       row.created_at,
      rejected_at:      (row as Record<string, unknown>).rejected_at as string | null ?? null,
      rejection_reason: (row as Record<string, unknown>).rejection_reason as string | null ?? null,
      form_status:      formResponse?.status       ?? null,
      submitted_at:     formResponse?.submitted_at ?? null,
    }
  })

  // form_status is computed post-join — filter in memory
  if (formStatus) applicants = applicants.filter((a) => a.form_status === formStatus)

  const total = formStatus ? applicants.length : (count ?? applicants.length)
  const meta  = buildPaginationMeta(total, page, pageSize)

  return NextResponse.json({ data: applicants, meta })
}
