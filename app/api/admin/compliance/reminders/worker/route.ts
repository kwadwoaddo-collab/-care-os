import { NextRequest, NextResponse } from 'next/server'
import { adminClient }    from '@/lib/supabase/admin'
import { requireAdmin }   from '@/lib/auth/requireAdmin'
import { can }            from '@/lib/auth/permissions'
import { forbidden }      from '@/lib/auth/responses'
import { buildComplianceSnapshot } from '@/lib/compliance/buildComplianceSnapshot'
import { getDaysUntilExpiry, getExpiryBand } from '@/lib/compliance/expiryBands'
import { trainingReminderTemplate } from '@/lib/notifications/templates/trainingReminderTemplate'
import { writeLog, sendEmail, APP_URL, getCompanyName } from '@/lib/notifications/sendNotification'
import { TRAINING_CATEGORY_LABELS } from '@/lib/documents/constants'
import { DOCUMENT_TYPE_LABELS }     from '@/lib/documents/constants'
import type { ComplianceDocument }  from '@/lib/compliance/calculateCompliance'

// ── POST /api/admin/compliance/reminders/worker ───────────────────────────────
//
// Sends individual compliance reminder emails directly to workers.
//
// Body:
//   staffIds?  string[]  — subset of staff to remind (default = all non-compliant)
//   dry_run?   boolean   — renders emails but does not send

interface RequestBody {
  staffIds?: string[]
  dry_run?:  boolean
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response
  if (!can(auth.ctx.role, 'compliance:read')) return forbidden('Insufficient permissions')
  const { companyId } = auth.ctx

  const body: RequestBody = await request.json().catch(() => ({}))
  const dryRun   = body.dry_run   ?? false
  const staffIds = body.staffIds  ?? []

  // ── Fetch staff ───────────────────────────────────────────────────────────
  let staffQuery = adminClient
    .from('staff_profiles')
    .select('id, first_name, last_name, email, job_role, status, applicant_id')
    .eq('company_id', companyId)
    .not('status', 'eq', 'terminated')

  if (staffIds.length > 0) {
    staffQuery = staffQuery.in('id', staffIds)
  }

  const { data: staff, error: staffErr } = await staffQuery
  if (staffErr || !staff) {
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 })
  }

  const ids          = staff.map((s) => s.id)
  const applicantIds = staff.map((s) => s.applicant_id).filter((id): id is string => id !== null)

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

  const companyName = await getCompanyName(companyId)
  const portalUrl   = `${APP_URL}/worker/documents`

  const results: Array<{
    staffId:   string
    staffName: string
    email:     string | null
    sent:      boolean
    skipped:   boolean
    reason?:   string
    subject?:  string
  }> = []

  for (const s of staff) {
    const name = [s.first_name, s.last_name].filter(Boolean).join(' ') || s.email || 'Unknown'

    if (!s.email) {
      results.push({ staffId: s.id, staffName: name, email: null, sent: false, skipped: true, reason: 'no email' })
      continue
    }

    // Merge docs
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

    // Skip compliant staff (unless explicitly targeted)
    if (snap.state === 'compliant' && staffIds.length === 0) {
      results.push({ staffId: s.id, staffName: name, email: s.email, sent: false, skipped: true, reason: 'compliant' })
      continue
    }

    // Build expiring items
    const expiring = docs
      .filter((d) => {
        if (!d.expiry_date) return false
        const band = getExpiryBand(d.expiry_date)
        return band !== 'ok' && band !== 'expired'
      })
      .map((d) => ({
        label:      d.training_category
          ? (TRAINING_CATEGORY_LABELS[d.training_category as keyof typeof TRAINING_CATEGORY_LABELS] ?? d.training_category)
          : (DOCUMENT_TYPE_LABELS[d.document_type as keyof typeof DOCUMENT_TYPE_LABELS] ?? d.document_type),
        daysUntil:  getDaysUntilExpiry(d.expiry_date!),
        expiryDate: d.expiry_date!,
      }))
      .sort((a, b) => a.daysUntil - b.daysUntil)

    const missingTraining = snap.missingTraining.map((cat) => ({
      label: TRAINING_CATEGORY_LABELS[cat as keyof typeof TRAINING_CATEGORY_LABELS] ?? cat,
    }))

    const missingDocs = snap.missingDocuments.map((dt) => ({
      label: DOCUMENT_TYPE_LABELS[dt as keyof typeof DOCUMENT_TYPE_LABELS] ?? dt,
    }))

    // Skip if nothing to say
    if (expiring.length === 0 && missingTraining.length === 0 && missingDocs.length === 0) {
      results.push({ staffId: s.id, staffName: name, email: s.email, sent: false, skipped: true, reason: 'no items' })
      continue
    }

    const { subject, html, text } = trainingReminderTemplate({
      staffName:       name,
      companyName,
      portalUrl,
      expiring,
      missingTraining,
      missingDocs,
    })

    if (dryRun) {
      results.push({ staffId: s.id, staffName: name, email: s.email, sent: false, skipped: false, subject })
      continue
    }

    const result = await sendEmail({ to: [s.email], subject, html, text })

    await writeLog({
      companyId,
      eventType:      'compliance.worker_reminder',
      recipientEmail: s.email,
      subject,
      status:         result.success ? 'sent' : 'failed',
      errorMessage:   result.error,
      entityType:     'staff_profile',
      entityId:       s.id,
    })

    results.push({ staffId: s.id, staffName: name, email: s.email, sent: result.success, skipped: false, subject })
  }

  const sentCount    = results.filter((r) => r.sent).length
  const skippedCount = results.filter((r) => r.skipped).length

  return NextResponse.json({ dry_run: dryRun, sent: sentCount, skipped: skippedCount, results })
}
