import { NextResponse }   from 'next/server'
import { adminClient }    from '@/lib/supabase/admin'
import { requireAdmin }   from '@/lib/auth/requireAdmin'
import { can }            from '@/lib/auth/permissions'
import { forbidden }      from '@/lib/auth/responses'
import { buildComplianceSnapshot } from '@/lib/compliance/buildComplianceSnapshot'
import { getExpiryBand } from '@/lib/compliance/expiryBands'
import type { ComplianceDocument } from '@/lib/compliance/calculateCompliance'

// ── GET /api/admin/compliance/export ─────────────────────────────────────────
//
// Returns a CSV of all non-terminated staff with:
//   Staff Name, Email, Job Role, Status, Compliance State, % Score,
//   Missing Docs, Missing Training, Next Expiry Date
//
// Optional query param: ?staffIds=id1,id2,id3  (export subset)

function escCsv(val: unknown): string {
  const s = val == null ? '' : String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function row(...cols: unknown[]): string {
  return cols.map(escCsv).join(',')
}

export async function GET(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'compliance:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const url      = new URL(request.url)
  const staffIds = url.searchParams.get('staffIds')?.split(',').filter(Boolean) ?? []

  // ── Fetch staff ───────────────────────────────────────────────────────────
  let staffQuery = adminClient
    .from('staff_profiles')
    .select('id, first_name, last_name, email, job_role, status, applicant_id')
    .eq('company_id', companyId)
    .not('status', 'eq', 'terminated')
    .order('first_name', { ascending: true })

  if (staffIds.length > 0) {
    staffQuery = staffQuery.in('id', staffIds)
  }

  const { data: staff, error: staffErr } = await staffQuery
  if (staffErr || !staff) {
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 })
  }

  const ids           = staff.map((s) => s.id)
  const applicantIds  = staff.map((s) => s.applicant_id).filter((id): id is string => id !== null)

  // ── Batch-fetch documents ─────────────────────────────────────────────────
  const [sDocs, aDocs] = await Promise.all([
    adminClient
      .from('documents')
      .select('id, document_type, file_name, expiry_date, training_category, reviewed_status, issue_date, staff_profile_id')
      .in('staff_profile_id', ids),
    applicantIds.length > 0
      ? adminClient
          .from('documents')
          .select('id, document_type, file_name, expiry_date, training_category, reviewed_status, issue_date, applicant_id')
          .in('applicant_id', applicantIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  const docsByStaff: Record<string, ComplianceDocument[]> = {}
  for (const d of (sDocs.data ?? []) as Array<ComplianceDocument & { staff_profile_id: string }>) {
    if (!docsByStaff[d.staff_profile_id]) docsByStaff[d.staff_profile_id] = []
    docsByStaff[d.staff_profile_id].push(d)
  }
  const docsByApplicant: Record<string, ComplianceDocument[]> = {}
  for (const d of (aDocs.data ?? []) as Array<ComplianceDocument & { applicant_id: string }>) {
    if (!docsByApplicant[d.applicant_id]) docsByApplicant[d.applicant_id] = []
    docsByApplicant[d.applicant_id].push(d)
  }

  // ── Build CSV ─────────────────────────────────────────────────────────────
  const header = row(
    'Staff Name', 'Email', 'Job Role', 'Status',
    'Compliance State', 'Compliance %',
    'Missing Documents', 'Missing Training',
    'Expiring Soon (≤30d)', 'Next Expiry Date'
  )

  const lines: string[] = [header]

  for (const s of staff) {
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

    const snap = buildComplianceSnapshot(docs)

    // Next expiry = soonest non-null expiry across all docs
    const nextExpiry = docs
      .map((d) => d.expiry_date)
      .filter((e): e is string => e !== null)
      .sort()[0] ?? null

    const expiringSoon = docs
      .filter((d) => d.expiry_date && getExpiryBand(d.expiry_date) !== 'ok' && getExpiryBand(d.expiry_date) !== 'expired')
      .map((d) => d.training_category ?? d.document_type)
      .join('; ')

    const name = [s.first_name, s.last_name].filter(Boolean).join(' ') || s.email || 'Unknown'

    lines.push(row(
      name,
      s.email ?? '',
      s.job_role ?? '',
      s.status,
      snap.state,
      snap.percentage,
      snap.missingDocuments.join('; '),
      snap.missingTraining.join('; '),
      expiringSoon,
      nextExpiry ?? '',
    ))
  }

  const csv  = lines.join('\n')
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="compliance-export-${date}.csv"`,
    },
  })
}
