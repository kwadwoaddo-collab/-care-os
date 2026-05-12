import { NextRequest, NextResponse } from 'next/server'
import { adminClient }  from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { can }          from '@/lib/auth/permissions'
import { forbidden }    from '@/lib/auth/responses'
import { buildComplianceSnapshot } from '@/lib/compliance/buildComplianceSnapshot'
import { getExpiryBand, type ExpiryBand } from '@/lib/compliance/expiryBands'
import { getPaginationParams, getRange, buildPaginationMeta } from '@/lib/pagination'
import type { ComplianceDocument } from '@/lib/compliance/calculateCompliance'
import type { ComplianceState }    from '@/lib/compliance/buildComplianceSnapshot'

// ── Public types ──────────────────────────────────────────────────────────────

export interface ExpiringItem {
  type:       string   // document_type or training_category
  expiryDate: string
  band:       ExpiryBand
}

export interface StaffComplianceRow {
  staffId:         string
  staffName:       string
  email:           string | null
  jobRole:         string | null
  status:          string
  complianceState: ComplianceState
  percentage:      number
  missingDocs:     string[]
  missingTraining: string[]
  expiringSoon:    ExpiringItem[]
  lastDocUpdated:  string | null
}

export interface StaffComplianceResponse {
  data:    StaffComplianceRow[]
  meta:    ReturnType<typeof buildPaginationMeta>
  summary: {
    total:        number
    compliant:    number
    warning:      number
    non_compliant: number
    blocked:      number
    expiring7d:   number
    expiring14d:  number
    expiring30d:  number
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sName(first: string | null, last: string | null, email: string | null): string {
  return [first, last].filter(Boolean).join(' ') || email || 'Unknown'
}

// ── GET /api/admin/compliance/staff ──────────────────────────────────────────
//
// Query params:
//   filter   — compliant | warning | non_compliant | blocked |
//              expiring7d | expiring14d | expiring30d |
//              missing_dbs | missing_rtw | missing_training
//   search   — partial name match
//   page     — 1-based
//   pageSize — default 50

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'compliance:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const sp       = request.nextUrl.searchParams
  const filter   = sp.get('filter')  ?? ''
  const search   = sp.get('search')  ?? ''
  const { page, pageSize } = getPaginationParams(Object.fromEntries(sp.entries()))

  // ── Fetch all staff for this company ──────────────────────────────────────
  const { data: staff, error: staffErr } = await adminClient
    .from('staff_profiles')
    .select('id, first_name, last_name, email, job_role, status, applicant_id')
    .eq('company_id', companyId)
    .not('status', 'eq', 'terminated')
    .order('first_name', { ascending: true })

  if (staffErr || !staff) {
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 })
  }

  const staffIds     = staff.map((s) => s.id)
  const applicantIds = staff.map((s) => s.applicant_id).filter((id): id is string => id !== null)

  if (staffIds.length === 0) {
    return NextResponse.json({
      data: [],
      meta: buildPaginationMeta(0, page, pageSize),
      summary: { total: 0, compliant: 0, warning: 0, non_compliant: 0, blocked: 0, expiring7d: 0, expiring14d: 0, expiring30d: 0 },
    })
  }

  // ── Batch-fetch documents ─────────────────────────────────────────────────
  const [sDocs, aDocs] = await Promise.all([
    adminClient
      .from('documents')
      .select('id, document_type, file_name, expiry_date, training_category, reviewed_status, issue_date, staff_profile_id, created_at')
      .in('staff_profile_id', staffIds),

    applicantIds.length > 0
      ? adminClient
          .from('documents')
          .select('id, document_type, file_name, expiry_date, training_category, reviewed_status, issue_date, applicant_id, created_at')
          .in('applicant_id', applicantIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  // Index by staff_profile_id
  const docsByStaff: Record<string, (ComplianceDocument & { created_at: string })[]> = {}
  for (const d of (sDocs.data ?? []) as Array<ComplianceDocument & { staff_profile_id: string; created_at: string }>) {
    if (!docsByStaff[d.staff_profile_id]) docsByStaff[d.staff_profile_id] = []
    docsByStaff[d.staff_profile_id].push(d)
  }

  // Index applicant docs by applicant_id
  const docsByApplicant: Record<string, (ComplianceDocument & { created_at: string })[]> = {}
  for (const d of (aDocs.data ?? []) as Array<ComplianceDocument & { applicant_id: string; created_at: string }>) {
    if (!docsByApplicant[d.applicant_id]) docsByApplicant[d.applicant_id] = []
    docsByApplicant[d.applicant_id].push(d)
  }

  // ── Build per-staff compliance rows ──────────────────────────────────────
  const summaryAcc = { compliant: 0, warning: 0, non_compliant: 0, blocked: 0, expiring7d: 0, expiring14d: 0, expiring30d: 0 }

  let rows: StaffComplianceRow[] = staff.map((s) => {
    // Merge docs, dedupe by id
    const seen = new Set<string>()
    const docs: (ComplianceDocument & { created_at: string })[] = []
    for (const d of docsByStaff[s.id] ?? []) {
      if (!seen.has(d.id)) { seen.add(d.id); docs.push(d) }
    }
    if (s.applicant_id) {
      for (const d of docsByApplicant[s.applicant_id] ?? []) {
        if (!seen.has(d.id)) { seen.add(d.id); docs.push(d) }
      }
    }

    const snap = buildComplianceSnapshot(docs)

    // Build expiring-soon items with band detail
    const expiringItems: ExpiringItem[] = []
    for (const d of docs) {
      if (!d.expiry_date) continue
      const band = getExpiryBand(d.expiry_date)
      if (band === 'ok') continue
      expiringItems.push({
        type:       d.training_category ?? d.document_type,
        expiryDate: d.expiry_date,
        band,
      })
    }
    // Sort: worst band first, then soonest date
    expiringItems.sort((a, b) => {
      const ORDER: ExpiryBand[] = ['expired', 'critical', 'warning', 'notice', 'ok']
      const bi = ORDER.indexOf(a.band) - ORDER.indexOf(b.band)
      if (bi !== 0) return bi
      return a.expiryDate.localeCompare(b.expiryDate)
    })

    const lastDocUpdated = docs
      .map((d) => d.created_at)
      .sort()
      .reverse()[0] ?? null

    // Accumulate summary
    summaryAcc[snap.state]++
    if (expiringItems.some((e) => e.band === 'critical')) summaryAcc.expiring7d++
    if (expiringItems.some((e) => e.band === 'critical' || e.band === 'warning')) summaryAcc.expiring14d++
    if (expiringItems.some((e) => e.band !== 'ok' && e.band !== 'expired')) summaryAcc.expiring30d++

    return {
      staffId:         s.id,
      staffName:       sName(s.first_name, s.last_name, s.email),
      email:           s.email ?? null,
      jobRole:         s.job_role ?? null,
      status:          s.status,
      complianceState: snap.state,
      percentage:      snap.percentage,
      missingDocs:     snap.missingDocuments,
      missingTraining: snap.missingTraining,
      expiringSoon:    expiringItems,
      lastDocUpdated,
    }
  })

  // ── Apply filters ─────────────────────────────────────────────────────────
  if (search) {
    const q = search.toLowerCase()
    rows = rows.filter((r) => r.staffName.toLowerCase().includes(q))
  }
  switch (filter) {
    case 'compliant':        rows = rows.filter((r) => r.complianceState === 'compliant'); break
    case 'warning':          rows = rows.filter((r) => r.complianceState === 'warning'); break
    case 'non_compliant':    rows = rows.filter((r) => r.complianceState === 'non_compliant'); break
    case 'blocked':          rows = rows.filter((r) => r.complianceState === 'blocked'); break
    case 'expiring7d':       rows = rows.filter((r) => r.expiringSoon.some((e) => e.band === 'critical')); break
    case 'expiring14d':      rows = rows.filter((r) => r.expiringSoon.some((e) => e.band === 'critical' || e.band === 'warning')); break
    case 'expiring30d':      rows = rows.filter((r) => r.expiringSoon.some((e) => e.band !== 'ok' && e.band !== 'expired')); break
    case 'missing_dbs':      rows = rows.filter((r) => r.missingDocs.includes('dbs')); break
    case 'missing_rtw':      rows = rows.filter((r) => r.missingDocs.includes('right_to_work')); break
    case 'missing_training': rows = rows.filter((r) => r.missingTraining.length > 0); break
  }

  // ── Paginate ──────────────────────────────────────────────────────────────
  const total    = rows.length
  const { from, to } = getRange(page, pageSize)
  const pageData = rows.slice(from, to + 1)
  const meta     = buildPaginationMeta(total, page, pageSize)

  return NextResponse.json({
    data: pageData,
    meta,
    summary: { total: staff.length, ...summaryAcc },
  } satisfies StaffComplianceResponse)
}
