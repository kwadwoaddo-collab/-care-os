import 'server-only'
import { adminClient } from '@/lib/supabase/admin'

// ── Folder slug taxonomy ──────────────────────────────────────────────────────

export type FolderSlug =
  | 'id-right-to-work'
  | 'dbs-safeguarding'
  | 'application-form-cv'
  | 'references-interview'
  | 'contracts-agreements'
  | 'training-certs'
  | 'shadowing-spot-checks'
  | 'supervision-appraisal'
  | 'health-vaccination'
  | 'leave-absence'
  | 'archive'

export type DocumentSourceStage =
  | 'applicant'
  | 'onboarding'
  | 'staff'
  | 'admin_upload'
  | 'worker_upload'
  | 'compliance_review'
  | 'operations_upload'

export type DocumentVisibility =
  | 'worker_visible'
  | 'management_only'
  | 'compliance_only'
  | 'confidential'

// ── Routing rules ─────────────────────────────────────────────────────────────

const ROUTING_RULES: Record<string, FolderSlug> = {
  // ID & Right to Work
  passport:                    'id-right-to-work',
  brp:                         'id-right-to-work',
  visa:                        'id-right-to-work',
  right_to_work:               'id-right-to-work',
  share_code:                  'id-right-to-work',
  right_to_work_share_code:    'id-right-to-work',
  share_code_confirmation:     'id-right-to-work',
  cos_letter:                  'id-right-to-work',
  id:                          'id-right-to-work',
  proof_of_address:            'id-right-to-work',
  // DBS & Safeguarding
  dbs:                         'dbs-safeguarding',
  dbs_certificate:             'dbs-safeguarding',
  safeguarding:                'dbs-safeguarding',
  safeguarding_certificate:    'dbs-safeguarding',
  safeguarding_declaration:    'dbs-safeguarding',
  // Application Form & CV
  cv:                          'application-form-cv',
  application_form:            'application-form-cv',
  covering_letter:             'application-form-cv',
  // References & Interview Notes
  reference:                   'references-interview',
  reference_letter:            'references-interview',
  interview_notes:             'references-interview',
  // Contracts & Agreements
  contract:                    'contracts-agreements',
  agency_contract:             'contracts-agreements',
  policy_acknowledgement:      'contracts-agreements',
  // Training & Certifications
  training_certificate:        'training-certs',
  training:                    'training-certs',
  manual_handling:             'training-certs',
  manual_handling_certificate: 'training-certs',
  medication_training:         'training-certs',
  fire_safety:                 'training-certs',
  fire_safety_certificate:     'training-certs',
  basic_life_support:          'training-certs',
  first_aid_certificate:       'training-certs',
  infection_control_certificate: 'training-certs',
  nmc_pin:                     'training-certs',
  professional_indemnity:      'training-certs',
  // Shadowing & Spot Checks
  spot_check:                  'shadowing-spot-checks',
  competency_assessment:       'shadowing-spot-checks',
  // Supervision & Appraisal
  supervision:                 'supervision-appraisal',
  appraisal:                   'supervision-appraisal',
  // Health & Vaccination
  vaccination:                 'health-vaccination',
  occupational_health:         'health-vaccination',
  // Leave & Absence
  fit_note:                    'leave-absence',
  return_to_work:              'leave-absence',
}

// Document types that workers are permitted to see
const WORKER_VISIBLE_TYPES = new Set([
  'contract', 'agency_contract',
  'training_certificate', 'training',
  'manual_handling_certificate', 'fire_safety_certificate',
  'first_aid_certificate', 'safeguarding_certificate',
  'infection_control_certificate', 'basic_life_support',
  'medication_training', 'nmc_pin',
])

// Document types that should be linked to the compliance engine
const COMPLIANCE_LINKED_TYPES = new Set([
  'dbs', 'dbs_certificate',
  'passport', 'brp', 'visa', 'right_to_work',
  'share_code', 'share_code_confirmation',
  'manual_handling_certificate', 'fire_safety_certificate',
  'safeguarding_certificate', 'first_aid_certificate',
  'infection_control_certificate', 'basic_life_support',
  'nmc_pin', 'vaccination', 'occupational_health',
])

// ── Public API ────────────────────────────────────────────────────────────────

export function resolveDocumentFolder(documentType: string): FolderSlug | null {
  return ROUTING_RULES[documentType.toLowerCase()] ?? null
}

export function isWorkerVisible(documentType: string): boolean {
  return WORKER_VISIBLE_TYPES.has(documentType.toLowerCase())
}

export function isComplianceLinked(documentType: string): boolean {
  return COMPLIANCE_LINKED_TYPES.has(documentType.toLowerCase())
}

export function resolveVisibility(documentType: string): DocumentVisibility {
  const type = documentType.toLowerCase()
  if (WORKER_VISIBLE_TYPES.has(type)) return 'worker_visible'
  if (type === 'reference' || type === 'reference_letter' || type === 'interview_notes') {
    return 'confidential'
  }
  if (COMPLIANCE_LINKED_TYPES.has(type)) return 'compliance_only'
  return 'management_only'
}

// ── Route a single document ───────────────────────────────────────────────────

export interface RouteDocumentOptions {
  documentId:   string
  documentType: string
  companyId:    string
  routedBy?:    string
  manual?:      boolean
  manualSlug?:  FolderSlug
  notes?:       string
}

export interface RouteDocumentResult {
  ok:         boolean
  folderId:   string | null
  folderSlug: FolderSlug | null
  method:     'auto' | 'manual' | 'system'
  matched:    boolean
}

export async function routeDocument(opts: RouteDocumentOptions): Promise<RouteDocumentResult> {
  const targetSlug = opts.manual && opts.manualSlug
    ? opts.manualSlug
    : resolveDocumentFolder(opts.documentType)

  const method: 'auto' | 'manual' | 'system' = opts.manual ? 'manual' : 'auto'

  let folderId: string | null = null

  if (targetSlug) {
    const { data: folder } = await adminClient
      .from('staff_document_folders')
      .select('id')
      .eq('company_id', opts.companyId)
      .eq('slug', targetSlug)
      .single()

    folderId = folder?.id ?? null
  }

  const workerVisible    = isWorkerVisible(opts.documentType)
  const complianceLinked = isComplianceLinked(opts.documentType)
  const visibility       = resolveVisibility(opts.documentType)
  const reviewStatus     = folderId ? 'auto_routed' : 'unrecognised'

  // Update the document with routing metadata
  await adminClient
    .from('documents')
    .update({
      folder_id:          folderId,
      worker_visible:     workerVisible,
      compliance_linked:  complianceLinked,
      visibility:         visibility,
      review_status:      reviewStatus,
      requires_manual_review: !folderId,
    })
    .eq('id', opts.documentId)

  // Write routing log entry
  await adminClient
    .from('document_routing_log')
    .insert({
      company_id:          opts.companyId,
      document_id:         opts.documentId,
      folder_id:           folderId,
      routing_method:      method,
      document_type_input: opts.documentType,
      matched_rule:        targetSlug ?? null,
      routed_by:           opts.routedBy ?? null,
      notes:               opts.notes ?? null,
    })

  // Write audit log entry
  await adminClient
    .from('document_audit_log')
    .insert({
      company_id:   opts.companyId,
      document_id:  opts.documentId,
      event:        'routed',
      actor_type:   opts.routedBy ? 'admin' : 'system',
      actor_label:  opts.routedBy ?? 'system',
      new_value:    { folder_id: folderId, folder_slug: targetSlug, method },
    })

  return {
    ok:         true,
    folderId,
    folderSlug: targetSlug,
    method,
    matched:    !!folderId,
  }
}

// ── Batch route all unrouted documents for a company ─────────────────────────

export async function routeUnroutedDocuments(companyId: string): Promise<{
  routed:      number
  unrecognised: number
}> {
  const { data: docs } = await adminClient
    .from('documents')
    .select('id, document_type, company_id')
    .eq('company_id', companyId)
    .is('folder_id', null)

  if (!docs || docs.length === 0) return { routed: 0, unrecognised: 0 }

  let routed = 0
  let unrecognised = 0

  for (const doc of docs) {
    const result = await routeDocument({
      documentId:   doc.id,
      documentType: doc.document_type ?? 'other',
      companyId:    doc.company_id,
    })
    if (result.matched) routed++
    else unrecognised++
  }

  return { routed, unrecognised }
}

// ── Fetch routing review queue ────────────────────────────────────────────────

export async function getRoutingReviewQueue(companyId: string) {
  const { data } = await adminClient
    .from('documents')
    .select(`
      id, document_type, file_name, original_filename, mime_type,
      source_stage, review_status, requires_manual_review,
      created_at, applicant_id, staff_profile_id, folder_id,
      staff_document_folders ( id, name, slug )
    `)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  return data ?? []
}

// ── Routing diagnostics ───────────────────────────────────────────────────────

export async function getRoutingDiagnostics(companyId: string) {
  const { data: allDocs } = await adminClient
    .from('documents')
    .select('id, folder_id, review_status, requires_manual_review, document_type')
    .eq('company_id', companyId)

  const docs = allDocs ?? []
  const autoRouted        = docs.filter((d) => d.review_status === 'auto_routed').length
  const pendingReview     = docs.filter((d) => d.requires_manual_review).length
  const unrecognised      = docs.filter((d) => d.review_status === 'unrecognised').length
  const manuallyClassified = docs.filter((d) => d.review_status === 'manually_classified').length
  const complianceLinked  = docs.filter((d) => d.review_status === 'compliance_linked').length

  return {
    total:              docs.length,
    autoRouted,
    pendingReview,
    unrecognised,
    manuallyClassified,
    complianceLinked,
  }
}
