import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import {
  calculateCompliance,
  complianceTier,
  type ComplianceDocument,
} from '@/lib/compliance/calculateCompliance'

// TODO: RESTORE AUTH — remove DEV_BYPASS_AUTH before deploying or merging to main.
const DEV_BYPASS_AUTH = process.env.NODE_ENV === 'development'

export async function GET() {
  if (!DEV_BYPASS_AUTH) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Fetch all staff profiles ───────────────────────────────────────────────
  const { data: staff, error: staffError } = await adminClient
    .from('staff_profiles')
    .select('id, first_name, last_name, email, job_role, status, start_date, created_at, applicant_id, company_id')
    .order('created_at', { ascending: false })

  if (staffError) {
    console.error('[admin/staff] list error:', staffError.message)
    return NextResponse.json(
      { error: 'Failed to fetch staff', supabase_message: staffError.message },
      { status: 500 }
    )
  }

  if (!staff || staff.length === 0) {
    return NextResponse.json([])
  }

  // ── Batch-fetch documents for all applicant_ids ────────────────────────────
  const applicantIds = staff
    .map((s) => s.applicant_id)
    .filter((id): id is string => id !== null)

  let docsByApplicant: Record<string, ComplianceDocument[]> = {}

  if (applicantIds.length > 0) {
    const { data: allDocs, error: docsError } = await adminClient
      .from('documents')
      .select('id, document_type, file_name, expiry_date, applicant_id')
      .in('applicant_id', applicantIds)

    if (docsError) {
      console.error('[admin/staff] documents fetch error:', docsError.message)
    } else {
      for (const doc of allDocs ?? []) {
        const aid = (doc as { applicant_id: string }).applicant_id
        if (!docsByApplicant[aid]) docsByApplicant[aid] = []
        docsByApplicant[aid].push(doc as ComplianceDocument)
      }
    }
  }

  // ── Attach compliance summary to each staff member ─────────────────────────
  const result = staff.map((s) => {
    const docs    = s.applicant_id ? (docsByApplicant[s.applicant_id] ?? []) : []
    const summary = calculateCompliance(docs)
    return {
      ...s,
      compliance: {
        percentage:  summary.percentage,
        tier:        complianceTier(summary.percentage),
        compliant:   summary.compliant,
        expiringSoon: summary.expiringSoon.length > 0,
      },
    }
  })

  return NextResponse.json(result)
}
