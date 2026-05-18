import 'server-only'
import { adminClient }        from '@/lib/supabase/admin'
import { createNotification } from '@/lib/notifications/createNotification'
import { logDocumentEvent }   from './lifecycle'

// ── Types ─────────────────────────────────────────────────────────────────────

export type VerificationStatus =
  | 'pending_verification'
  | 'verified'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'superseded'

export type VerificationMethod =
  | 'original_seen'
  | 'certified_copy'
  | 'digital_check'
  | 'dbs_update_service'
  | 'sponsor_check'
  | 'internal_review'

// Document types that require original_seen before approval
export const REQUIRES_ORIGINAL_SEEN = new Set([
  'passport', 'brp', 'visa', 'right_to_work',
  'share_code', 'share_code_confirmation', 'id',
])

// ── Verify (identity check complete — not yet compliance-approved) ─────────────

export async function verifyDocument(opts: {
  documentId:          string
  companyId:           string
  verifiedBy:          string
  verificationMethod:  VerificationMethod
  originalSeen?:       boolean
  originalSeenMethod?: 'in_person' | 'video_call' | 'certified_copy' | 'digital'
  verificationNotes?:  string
}): Promise<{ ok: boolean; error?: string }> {
  const now = new Date().toISOString()

  const { error } = await adminClient
    .from('documents')
    .update({
      verification_status:   'verified',
      verified_by:           opts.verifiedBy,
      verified_at:           now,
      verification_method:   opts.verificationMethod,
      original_seen:         opts.originalSeen ?? false,
      original_seen_method:  opts.originalSeenMethod ?? null,
      original_seen_at:      opts.originalSeen ? now : null,
      original_seen_by:      opts.originalSeen ? opts.verifiedBy : null,
      verification_notes:    opts.verificationNotes ?? null,
    })
    .eq('id', opts.documentId)
    .eq('company_id', opts.companyId)

  if (error) return { ok: false, error: error.message }

  await logDocumentEvent({
    companyId:   opts.companyId,
    documentId:  opts.documentId,
    event:       'routed',
    actorType:   'admin',
    actorLabel:  opts.verifiedBy,
    newValue: {
      verification_status: 'verified',
      method:              opts.verificationMethod,
      original_seen:       opts.originalSeen,
    },
  })

  return { ok: true }
}

// ── Approve (compliance-satisfying — shows as compliant in the engine) ─────────

export async function approveDocument(opts: {
  documentId:         string
  companyId:          string
  approvedBy:         string
  staffProfileId?:    string
  verificationNotes?: string
}): Promise<{ ok: boolean; error?: string }> {
  const now = new Date().toISOString()

  // Fetch document to check original_seen requirement
  const { data: doc } = await adminClient
    .from('documents')
    .select('document_type, staff_profile_id, company_id, original_seen, verification_status')
    .eq('id', opts.documentId)
    .eq('company_id', opts.companyId)
    .single()

  if (!doc) return { ok: false, error: 'Document not found' }

  const { error } = await adminClient
    .from('documents')
    .update({
      verification_status:  'approved',
      approved_by:          opts.approvedBy,
      approved_at:          now,
      reviewed_status:      'approved',    // keep legacy field in sync
      reviewed_by:          opts.approvedBy,
      reviewed_at:          now,
      verification_notes:   opts.verificationNotes ?? null,
      resubmission_requested: false,
    })
    .eq('id', opts.documentId)
    .eq('company_id', opts.companyId)

  if (error) return { ok: false, error: error.message }

  await logDocumentEvent({
    companyId:   opts.companyId,
    documentId:  opts.documentId,
    event:       'approved',
    actorType:   'admin',
    actorLabel:  opts.approvedBy,
    newValue:    { verification_status: 'approved', approved_by: opts.approvedBy },
  })

  // Notify worker
  const spId = opts.staffProfileId ?? doc.staff_profile_id
  if (spId) {
    void createNotification({
      recipient:      'worker',
      staffProfileId: spId,
      companyId:      opts.companyId,
      eventType:      'document_rejected',  // reuse event slot — replace label below
      title:          'Document approved',
      message:        'Your document has been reviewed and approved.',
      actionUrl:      '/worker/documents',
      entityId:       opts.documentId,
    })
  }

  return { ok: true }
}

// ── Reject ────────────────────────────────────────────────────────────────────

export async function rejectDocument(opts: {
  documentId:       string
  companyId:        string
  rejectedBy:       string
  rejectedReason:   string
  staffProfileId?:  string
}): Promise<{ ok: boolean; error?: string }> {
  const { data: doc } = await adminClient
    .from('documents')
    .select('staff_profile_id, company_id')
    .eq('id', opts.documentId)
    .eq('company_id', opts.companyId)
    .single()

  if (!doc) return { ok: false, error: 'Document not found' }

  const { error } = await adminClient
    .from('documents')
    .update({
      verification_status: 'rejected',
      rejected_reason:     opts.rejectedReason,
      reviewed_status:     'rejected',     // keep legacy in sync
      reviewed_notes:      opts.rejectedReason,
      reviewed_by:         opts.rejectedBy,
      reviewed_at:         new Date().toISOString(),
    })
    .eq('id', opts.documentId)
    .eq('company_id', opts.companyId)

  if (error) return { ok: false, error: error.message }

  await logDocumentEvent({
    companyId:   opts.companyId,
    documentId:  opts.documentId,
    event:       'rejected',
    actorType:   'admin',
    actorLabel:  opts.rejectedBy,
    newValue:    { verification_status: 'rejected', reason: opts.rejectedReason },
  })

  const spId = opts.staffProfileId ?? doc.staff_profile_id
  if (spId) {
    void createNotification({
      recipient:      'worker',
      staffProfileId: spId,
      companyId:      opts.companyId,
      eventType:      'document_rejected',
      title:          'Document requires attention',
      message:        `Your document was rejected: ${opts.rejectedReason}`,
      actionUrl:      '/worker/documents',
      entityId:       opts.documentId,
    })
  }

  return { ok: true }
}

// ── Request resubmission ───────────────────────────────────────────────────────

export async function requestResubmission(opts: {
  documentId:      string
  companyId:       string
  requestedBy:     string
  reason:          string
  staffProfileId?: string
}): Promise<{ ok: boolean; error?: string }> {
  const { data: doc } = await adminClient
    .from('documents')
    .select('staff_profile_id, company_id, document_type, folder_id')
    .eq('id', opts.documentId)
    .eq('company_id', opts.companyId)
    .single()

  if (!doc) return { ok: false, error: 'Document not found' }

  const now = new Date().toISOString()

  // Mark document as rejected + resubmission requested
  const { error: docErr } = await adminClient
    .from('documents')
    .update({
      verification_status:      'rejected',
      resubmission_requested:   true,
      resubmission_requested_at: now,
      rejected_reason:          opts.reason,
      reviewed_status:          'rejected',
      reviewed_notes:           opts.reason,
      reviewed_by:              opts.requestedBy,
      reviewed_at:              now,
    })
    .eq('id', opts.documentId)

  if (docErr) return { ok: false, error: docErr.message }

  // Create resubmission request record
  await adminClient
    .from('document_resubmission_requests')
    .insert({
      company_id:      opts.companyId,
      document_id:     opts.documentId,
      staff_profile_id: opts.staffProfileId ?? doc.staff_profile_id,
      requested_by:    opts.requestedBy,
      reason:          opts.reason,
      document_type:   doc.document_type,
    })

  await logDocumentEvent({
    companyId:   opts.companyId,
    documentId:  opts.documentId,
    event:       'rejected',
    actorType:   'admin',
    actorLabel:  opts.requestedBy,
    newValue:    { action: 'resubmission_requested', reason: opts.reason },
  })

  const spId = opts.staffProfileId ?? doc.staff_profile_id
  if (spId) {
    void createNotification({
      recipient:      'worker',
      staffProfileId: spId,
      companyId:      opts.companyId,
      eventType:      'document_rejected',
      title:          'Document resubmission required',
      message:        `Please upload a new document. Reason: ${opts.reason}`,
      actionUrl:      '/worker/documents',
      entityId:       opts.documentId,
    })
  }

  return { ok: true }
}

// ── Verification queue queries ─────────────────────────────────────────────────

export interface VerificationQueueItem {
  id:                     string
  document_type:          string
  file_name:              string
  file_path:              string | null
  file_size:              number | null
  mime_type:              string | null
  expiry_date:            string | null
  created_at:             string
  source_stage:           string | null
  verification_status:    string
  original_seen:          boolean
  original_seen_at:       string | null
  rejected_reason:        string | null
  resubmission_requested: boolean
  folder_id:              string | null
  compliance_linked:      boolean
  worker_visible:         boolean
  staff_profile_id:       string | null
  applicant_id:           string | null
  staff_document_folders: { name: string; slug: string } | null
  // joined from staff_profiles
  staff_first_name?:      string | null
  staff_last_name?:       string | null
  staff_job_role?:        string | null
  staff_status?:          string | null
}

export interface VerificationDiagnostics {
  total:                   number
  pendingVerification:     number
  verified:                number
  approved:                number
  rejected:                number
  resubmissionRequested:   number
  requiresOriginalSeen:    number
  expiringWithin30Days:    number
}

export async function getVerificationQueue(companyId: string): Promise<{
  queue:       VerificationQueueItem[]
  diagnostics: VerificationDiagnostics
}> {
  // Fetch all non-archived, non-superseded docs with staff profile join
  const { data } = await adminClient
    .from('documents')
    .select(`
      id, document_type, file_name, file_path, file_size, mime_type,
      expiry_date, created_at, source_stage, verification_status,
      original_seen, original_seen_at, rejected_reason,
      resubmission_requested, folder_id, compliance_linked, worker_visible,
      staff_profile_id, applicant_id,
      staff_document_folders ( name, slug ),
      staff_profiles ( first_name, last_name, job_role, status )
    `)
    .eq('company_id', companyId)
    .is('archived_at', null)
    .not('verification_status', 'eq', 'superseded')
    .order('created_at', { ascending: false })
    .limit(500)

  type RawRow = typeof data extends (infer T)[] | null ? T : never

  const rows = (data ?? []) as RawRow[]

  // Flatten joined staff_profiles into top-level fields
  const queue: VerificationQueueItem[] = rows.map((r) => {
    const sp = (r as Record<string, unknown>).staff_profiles as
      | { first_name: string | null; last_name: string | null; job_role: string | null; status: string | null }
      | null
    return {
      ...(r as Record<string, unknown>),
      staff_first_name: sp?.first_name ?? null,
      staff_last_name:  sp?.last_name  ?? null,
      staff_job_role:   sp?.job_role   ?? null,
      staff_status:     sp?.status     ?? null,
    } as unknown as VerificationQueueItem
  })

  // Diagnostics
  const now30 = new Date(); now30.setDate(now30.getDate() + 30)
  const diagnostics: VerificationDiagnostics = {
    total:                 queue.length,
    pendingVerification:   queue.filter((d) => d.verification_status === 'pending_verification').length,
    verified:              queue.filter((d) => d.verification_status === 'verified').length,
    approved:              queue.filter((d) => d.verification_status === 'approved').length,
    rejected:              queue.filter((d) => d.verification_status === 'rejected').length,
    resubmissionRequested: queue.filter((d) => d.resubmission_requested).length,
    requiresOriginalSeen:  queue.filter((d) =>
      REQUIRES_ORIGINAL_SEEN.has(d.document_type) && !d.original_seen
    ).length,
    expiringWithin30Days:  queue.filter((d) =>
      d.expiry_date && new Date(d.expiry_date) > new Date() && new Date(d.expiry_date) <= now30
    ).length,
  }

  return { queue, diagnostics }
}

// ── Compliance-eligible check ──────────────────────────────────────────────────
//
// A document is compliance-eligible if:
//   verification_status = 'approved'
//   OR (verification_status IS NULL AND reviewed_status = 'approved')  — legacy

export function isComplianceEligible(doc: {
  verification_status?: string | null
  reviewed_status?:     string | null
}): boolean {
  if (doc.verification_status) {
    return doc.verification_status === 'approved'
  }
  // Legacy fallback
  return doc.reviewed_status === 'approved'
}
