import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import {
  calculateCompliance,
  complianceTier,
  type ComplianceDocument,
} from '@/lib/compliance/calculateCompliance'
import { parseAvailabilityRecord } from '@/lib/staff/types'
import { calculateReadiness }      from '@/lib/staff/calculateReadiness'

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

  const staffIds     = staff.map((s) => s.id)
  const applicantIds = staff.map((s) => s.applicant_id).filter((id): id is string => id !== null)

  // ── Batch-fetch documents + availability in parallel ──────────────────────
  const [docsResult, availResult] = await Promise.all([
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

  // Index documents by applicant_id
  const docsByApplicant: Record<string, ComplianceDocument[]> = {}
  if (docsResult.error) {
    console.error('[admin/staff] documents fetch error:', docsResult.error.message)
  } else {
    for (const doc of docsResult.data ?? []) {
      const aid = (doc as { applicant_id: string }).applicant_id
      if (!docsByApplicant[aid]) docsByApplicant[aid] = []
      docsByApplicant[aid].push(doc as ComplianceDocument)
    }
  }

  // Index availability by staff_profile_id
  const availByStaff: Record<string, Record<string, unknown>> = {}
  if (availResult.error) {
    console.error('[admin/staff] availability fetch error:', availResult.error.message)
  } else {
    for (const row of availResult.data ?? []) {
      const spid = (row as { staff_profile_id: string }).staff_profile_id
      availByStaff[spid] = row as Record<string, unknown>
    }
  }

  // ── Build result ──────────────────────────────────────────────────────────
  const result = staff.map((s) => {
    const docs    = s.applicant_id ? (docsByApplicant[s.applicant_id] ?? []) : []
    const summary = calculateCompliance(docs)

    const availRaw   = availByStaff[s.id] ?? null
    const availability = parseAvailabilityRecord(s.id, availRaw)
    const readiness  = calculateReadiness(s.status, summary.compliant, availRaw ? availability : null)

    return {
      ...s,
      compliance: {
        percentage:   summary.percentage,
        tier:         complianceTier(summary.percentage),
        compliant:    summary.compliant,
        expiringSoon: summary.expiringSoon.length > 0,
        hasExpired:   summary.expiredDocuments.length > 0,
      },
      readiness: {
        ready: readiness.ready,
        score: readiness.score,
      },
    }
  })

  return NextResponse.json(result)
}
