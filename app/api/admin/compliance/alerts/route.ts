import { NextResponse } from 'next/server'
import { adminClient } from '@/lib/supabase/admin'
import { buildComplianceSnapshot } from '@/lib/compliance/buildComplianceSnapshot'
import type { ComplianceDocument } from '@/lib/compliance/calculateCompliance'
import { WARNING_DAYS, NOTICE_DAYS } from '@/lib/compliance/reminderThresholds'

// TODO: RESTORE AUTH — remove DEV_BYPASS_AUTH before deploying or merging to main.
const DEV_BYPASS_AUTH = process.env.NODE_ENV === 'development'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AlertItem {
  staffId:      string
  staffName:    string
  issue:        string
  documentType: string
  expiryDate:   string | null
  severity:     'expired' | 'warning' | 'notice'
}

export interface AlertsSummary {
  totalStaff:        number
  activeStaff:       number
  nonCompliantCount: number
  expiringWithin30:  number
  expiredCount:      number
  averageCompliance: number
}

export interface AlertsResponse {
  expired:      AlertItem[]
  expiringSoon: AlertItem[]
  nonCompliant: { staffId: string; staffName: string }[]
  summary:      AlertsSummary
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function staffName(
  first: string | null,
  last: string | null,
  email: string | null
): string {
  return [first, last].filter(Boolean).join(' ') || email || 'Unknown'
}

function expiryDateForType(
  docs: ComplianceDocument[],
  docType: string,
  expired: boolean
): string | null {
  const now    = new Date()
  const warnAt = new Date()
  warnAt.setDate(now.getDate() + NOTICE_DAYS)

  const matches = docs
    .filter((d) => d.document_type === docType)
    .sort((a, b) => (b.expiry_date ?? '').localeCompare(a.expiry_date ?? ''))

  if (expired) {
    return matches.find((d) => d.expiry_date && new Date(d.expiry_date) < now)
      ?.expiry_date ?? null
  }
  return matches.find(
    (d) =>
      d.expiry_date &&
      new Date(d.expiry_date) >= now &&
      new Date(d.expiry_date) <= warnAt
  )?.expiry_date ?? null
}

function expirySeverity(expiryDate: string | null): 'warning' | 'notice' {
  if (!expiryDate) return 'notice'
  const daysUntil =
    (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return daysUntil <= WARNING_DAYS ? 'warning' : 'notice'
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET() {
  if (!DEV_BYPASS_AUTH) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Fetch all staff profiles ───────────────────────────────────────────────
  const { data: staff, error: staffError } = await adminClient
    .from('staff_profiles')
    .select('id, first_name, last_name, email, status, applicant_id')
    .order('created_at', { ascending: false })

  if (staffError) {
    console.error('[compliance/alerts] staff error:', staffError.message)
    return NextResponse.json(
      { error: 'Failed to fetch staff', supabase_message: staffError.message },
      { status: 500 }
    )
  }

  if (!staff || staff.length === 0) {
    const empty: AlertsResponse = {
      expired: [],
      expiringSoon: [],
      nonCompliant: [],
      summary: {
        totalStaff: 0,
        activeStaff: 0,
        nonCompliantCount: 0,
        expiringWithin30: 0,
        expiredCount: 0,
        averageCompliance: 0,
      },
    }
    return NextResponse.json(empty)
  }

  // ── Batch-fetch documents ─────────────────────────────────────────────────

  const staffIds     = staff.map((s) => s.id)
  const applicantIds = staff.map((s) => s.applicant_id).filter((id): id is string => id !== null)

  // keyed by staff_profile_id
  const docsByStaff: Record<string, ComplianceDocument[]> = {}
  // keyed by applicant_id
  const docsByApplicant: Record<string, ComplianceDocument[]> = {}

  if (staffIds.length > 0) {
    const { data: sDocs } = await adminClient
      .from('documents')
      .select('id, document_type, file_name, expiry_date, staff_profile_id')
      .in('staff_profile_id', staffIds)

    for (const doc of sDocs ?? []) {
      const spid = (doc as { staff_profile_id: string }).staff_profile_id
      if (!docsByStaff[spid]) docsByStaff[spid] = []
      docsByStaff[spid].push(doc as ComplianceDocument)
    }
  }

  if (applicantIds.length > 0) {
    const { data: aDocs } = await adminClient
      .from('documents')
      .select('id, document_type, file_name, expiry_date, applicant_id')
      .in('applicant_id', applicantIds)

    for (const doc of aDocs ?? []) {
      const aid = (doc as { applicant_id: string }).applicant_id
      if (!docsByApplicant[aid]) docsByApplicant[aid] = []
      docsByApplicant[aid].push(doc as ComplianceDocument)
    }
  }

  // ── Build alerts per staff member ─────────────────────────────────────────

  const expired:      AlertItem[] = []
  const expiringSoon: AlertItem[] = []
  const nonCompliant: { staffId: string; staffName: string }[] = []

  let totalPercentage = 0
  let activeCount     = 0
  let nonCompliantCount = 0
  let expiringWithin30  = 0
  let expiredCount      = 0

  for (const s of staff) {
    // Merge docs from both sources, dedup by id
    const seenIds = new Set<string>()
    const docs: ComplianceDocument[] = []

    for (const d of docsByStaff[s.id] ?? []) {
      if (!seenIds.has(d.id)) { seenIds.add(d.id); docs.push(d) }
    }
    if (s.applicant_id) {
      for (const d of docsByApplicant[s.applicant_id] ?? []) {
        if (!seenIds.has(d.id)) { seenIds.add(d.id); docs.push(d) }
      }
    }

    const snap = buildComplianceSnapshot(docs)
    const name = staffName(s.first_name, s.last_name, s.email)

    totalPercentage += snap.percentage
    if (s.status === 'active') activeCount++
    if (!snap.compliant) {
      nonCompliantCount++
      nonCompliant.push({ staffId: s.id, staffName: name })
    }
    if (snap.expiringSoon.length > 0) expiringWithin30++
    if (snap.hasExpired) expiredCount++

    // Expired document alerts
    for (const docType of snap.expiredDocuments) {
      expired.push({
        staffId:      s.id,
        staffName:    name,
        issue:        'Document expired',
        documentType: docType,
        expiryDate:   expiryDateForType(docs, docType, true),
        severity:     'expired',
      })
    }

    // Expiring soon alerts
    for (const docType of snap.expiringSoon) {
      const expiryDate = expiryDateForType(docs, docType, false)
      expiringSoon.push({
        staffId:      s.id,
        staffName:    name,
        issue:        expirySeverity(expiryDate) === 'warning'
          ? `Expiring within ${WARNING_DAYS} days`
          : `Expiring within ${NOTICE_DAYS} days`,
        documentType: docType,
        expiryDate,
        severity:     expirySeverity(expiryDate),
      })
    }
  }

  // Sort expiringSoon by closest expiry date first
  expiringSoon.sort((a, b) => {
    if (!a.expiryDate) return 1
    if (!b.expiryDate) return -1
    return a.expiryDate.localeCompare(b.expiryDate)
  })

  const summary: AlertsSummary = {
    totalStaff:        staff.length,
    activeStaff:       activeCount,
    nonCompliantCount,
    expiringWithin30,
    expiredCount,
    averageCompliance:
      staff.length > 0 ? Math.round(totalPercentage / staff.length) : 0,
  }

  return NextResponse.json({ expired, expiringSoon, nonCompliant, summary } satisfies AlertsResponse)
}
