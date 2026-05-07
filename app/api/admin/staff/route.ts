import { NextRequest, NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import {
  calculateCompliance,
  complianceTier,
  type ComplianceDocument,
} from '@/lib/compliance/calculateCompliance'
import { parseAvailabilityRecord } from '@/lib/staff/types'
import { calculateReadiness }      from '@/lib/staff/calculateReadiness'
import { getPaginationParams, getRange, buildPaginationMeta } from '@/lib/pagination'
import { requireAdmin } from '@/lib/auth/requireAdmin'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  const { companyId } = auth.ctx

  const sp         = request.nextUrl.searchParams
  const search     = sp.get('search')     ?? ''
  const status     = sp.get('status')     ?? ''
  const compliance = sp.get('compliance') ?? '' // compliant | non_compliant | expiring
  const readiness  = sp.get('readiness')  ?? '' // ready | not_ready
  const { page, pageSize } = getPaginationParams(Object.fromEntries(sp.entries()))

  // ── Build DB query with search + status ────────────────────────────────────
  let query = adminClient
    .from('staff_profiles')
    .select('id, first_name, last_name, email, job_role, status, start_date, created_at, applicant_id, company_id, onboarding_completed')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,job_role.ilike.%${search}%`
    )
  }

  const { data: staff, error: staffError } = await query

  if (staffError) {
    console.error('[admin/staff] list error:', staffError.message)
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 })
  }

  if (!staff || staff.length === 0) {
    return NextResponse.json({ data: [], meta: buildPaginationMeta(0, page, pageSize) })
  }

  const staffIds     = staff.map((s) => s.id)
  const applicantIds = staff.map((s) => s.applicant_id).filter((id): id is string => id !== null)

  // ── Batch-fetch documents + availability in parallel ──────────────────────
  const [docsStaffResult, docsApplicantResult, availResult] = await Promise.all([
    adminClient
      .from('documents')
      .select('id, document_type, file_name, expiry_date, staff_profile_id')
      .in('staff_profile_id', staffIds),

    applicantIds.length > 0
      ? adminClient
          .from('documents')
          .select('id, document_type, file_name, expiry_date, applicant_id')
          .in('applicant_id', applicantIds)
      : Promise.resolve({ data: [], error: null }),

    adminClient
      .from('staff_availability')
      .select('*')
      .in('staff_profile_id', staffIds),
  ])

  // Index by staff_profile_id
  const docsByStaff: Record<string, ComplianceDocument[]> = {}
  for (const doc of docsStaffResult.data ?? []) {
    const spid = (doc as { staff_profile_id: string }).staff_profile_id
    if (!docsByStaff[spid]) docsByStaff[spid] = []
    docsByStaff[spid].push(doc as ComplianceDocument)
  }

  // Index applicant docs by applicant_id
  const docsByApplicant: Record<string, ComplianceDocument[]> = {}
  for (const doc of docsApplicantResult.data ?? []) {
    const aid = (doc as { applicant_id: string }).applicant_id
    if (!docsByApplicant[aid]) docsByApplicant[aid] = []
    docsByApplicant[aid].push(doc as ComplianceDocument)
  }

  // Index availability
  const availByStaff: Record<string, Record<string, unknown>> = {}
  for (const row of availResult.data ?? []) {
    const spid = (row as { staff_profile_id: string }).staff_profile_id
    availByStaff[spid] = row as Record<string, unknown>
  }

  // ── Build result with compliance + readiness ───────────────────────────────
  let result = staff.map((s) => {
    // Merge docs from both sources, dedup by id
    const seen = new Set<string>()
    const docs: ComplianceDocument[] = []
    for (const d of docsByStaff[s.id] ?? []) {
      if (!seen.has(d.id)) { seen.add(d.id); docs.push(d) }
    }
    if (s.applicant_id) {
      for (const d of docsByApplicant[s.applicant_id] ?? []) {
        if (!seen.has(d.id)) { seen.add(d.id); docs.push(d) }
      }
    }

    const summary      = calculateCompliance(docs)
    const availRaw     = availByStaff[s.id] ?? null
    const availability = availRaw ? parseAvailabilityRecord(s.id, availRaw) : null
    const ready        = calculateReadiness(s.status, summary.compliant, availability)

    return {
      ...s,
      compliance: {
        percentage:   summary.percentage,
        tier:         complianceTier(summary.percentage),
        compliant:    summary.compliant,
        expiringSoon: summary.expiringSoon.length > 0,
        hasExpired:   summary.expiredDocuments.length > 0,
      },
      readiness: { ready: ready.ready, score: ready.score },
    }
  })

  // ── In-memory compliance/readiness filter ─────────────────────────────────
  if (compliance === 'compliant')     result = result.filter((s) => s.compliance.compliant)
  if (compliance === 'non_compliant') result = result.filter((s) => !s.compliance.compliant)
  if (compliance === 'expiring')      result = result.filter((s) => s.compliance.expiringSoon || s.compliance.hasExpired)
  if (readiness  === 'ready')         result = result.filter((s) => s.readiness.ready)
  if (readiness  === 'not_ready')     result = result.filter((s) => !s.readiness.ready)

  // ── Paginate ──────────────────────────────────────────────────────────────
  const total       = result.length
  const { from, to } = getRange(page, pageSize)
  const pageData    = result.slice(from, to + 1)
  const meta        = buildPaginationMeta(total, page, pageSize)

  return NextResponse.json({ data: pageData, meta })
}
