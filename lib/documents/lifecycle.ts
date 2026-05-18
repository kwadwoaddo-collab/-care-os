import 'server-only'
import { adminClient } from '@/lib/supabase/admin'
import { routeDocument } from './routing'

// ── Applicant → Staff conversion continuity ───────────────────────────────────
//
// When an applicant is converted to a staff member, this function:
//  1. Links all applicant documents to the new staff_profile_id
//  2. Preserves original upload timestamps and applicant_id for audit trail
//  3. Routes each document into the correct folder
//  4. Logs the conversion linkage in the audit log

export interface ConvertDocumentsResult {
  linked:  number
  routed:  number
  errors:  string[]
}

export async function linkApplicantDocumentsToStaff(opts: {
  applicantId:     string
  staffProfileId:  string
  companyId:       string
  convertedBy?:    string
}): Promise<ConvertDocumentsResult> {
  const { applicantId, staffProfileId, companyId, convertedBy } = opts
  const errors: string[] = []

  // Fetch all documents belonging to this applicant
  const { data: docs, error } = await adminClient
    .from('documents')
    .select('id, document_type, source_stage, folder_id, company_id')
    .eq('applicant_id', applicantId)
    .eq('company_id', companyId)

  if (error) {
    return { linked: 0, routed: 0, errors: [error.message] }
  }

  if (!docs || docs.length === 0) return { linked: 0, routed: 0, errors: [] }

  let linked = 0
  let routed = 0

  for (const doc of docs) {
    // Link to staff profile, preserving applicant_id for audit trail
    const { error: updateErr } = await adminClient
      .from('documents')
      .update({
        staff_profile_id: staffProfileId,
        source_stage:     doc.source_stage ?? 'applicant',
      })
      .eq('id', doc.id)

    if (updateErr) {
      errors.push(`Failed to link doc ${doc.id}: ${updateErr.message}`)
      continue
    }

    linked++

    // Route into folder if not already routed
    if (!doc.folder_id) {
      const result = await routeDocument({
        documentId:   doc.id,
        documentType: doc.document_type ?? 'other',
        companyId:    doc.company_id,
        routedBy:     convertedBy,
      })
      if (result.matched) routed++
    }

    // Log the conversion linkage event
    await adminClient
      .from('document_audit_log')
      .insert({
        company_id:   companyId,
        document_id:  doc.id,
        event:        'conversion_linked',
        actor_type:   convertedBy ? 'admin' : 'system',
        actor_label:  convertedBy ?? 'system',
        new_value: {
          staff_profile_id: staffProfileId,
          applicant_id:     applicantId,
          note:             'Linked during applicant-to-staff conversion',
        },
      })
  }

  return { linked, routed, errors }
}

// ── Archive a document ────────────────────────────────────────────────────────

export async function archiveDocument(opts: {
  documentId:  string
  companyId:   string
  archivedBy?: string
  reason?:     string
}): Promise<void> {
  const archiveFolder = await adminClient
    .from('staff_document_folders')
    .select('id')
    .eq('company_id', opts.companyId)
    .eq('slug', 'archive')
    .single()

  await adminClient
    .from('documents')
    .update({
      archived_at:   new Date().toISOString(),
      folder_id:     archiveFolder.data?.id ?? null,
      review_status: 'archived',
    })
    .eq('id', opts.documentId)

  await adminClient
    .from('document_audit_log')
    .insert({
      company_id:   opts.companyId,
      document_id:  opts.documentId,
      event:        'archived',
      actor_type:   opts.archivedBy ? 'admin' : 'system',
      actor_label:  opts.archivedBy ?? 'system',
      new_value:    { reason: opts.reason ?? null },
    })
}

// ── Create a new document version ─────────────────────────────────────────────

export async function createDocumentVersion(opts: {
  existingDocumentId:  string
  newDocumentId:       string
  companyId:           string
  versionGroupId?:     string
  replacedBy?:         string
}): Promise<void> {
  const groupId = opts.versionGroupId ?? opts.existingDocumentId

  // Supersede the old version
  await adminClient
    .from('documents')
    .update({
      reviewed_status: 'superseded',
      review_status:   'archived',
      version_group_id: groupId,
    })
    .eq('id', opts.existingDocumentId)

  await adminClient
    .from('staff_document_versions')
    .update({
      is_current:    false,
      superseded_at: new Date().toISOString(),
      superseded_by: opts.newDocumentId,
    })
    .eq('document_id', opts.existingDocumentId)
    .eq('is_current', true)

  // Mark old version superseded in staff_document_versions
  // Get next version number
  const { data: versionRows } = await adminClient
    .from('staff_document_versions')
    .select('version_number')
    .eq('version_group_id', groupId)
    .order('version_number', { ascending: false })
    .limit(1)

  const nextVersion = (versionRows?.[0]?.version_number ?? 0) + 1

  // Set version_group_id on the new document
  await adminClient
    .from('documents')
    .update({ version_group_id: groupId })
    .eq('id', opts.newDocumentId)

  // Insert new version entry
  await adminClient
    .from('staff_document_versions')
    .insert({
      company_id:       opts.companyId,
      version_group_id: groupId,
      document_id:      opts.newDocumentId,
      version_number:   nextVersion,
      is_current:       true,
    })

  // Audit log
  await adminClient
    .from('document_audit_log')
    .insert({
      company_id:   opts.companyId,
      document_id:  opts.newDocumentId,
      event:        'version_replaced',
      actor_type:   opts.replacedBy ? 'admin' : 'system',
      actor_label:  opts.replacedBy ?? 'system',
      new_value: {
        version_group_id:     groupId,
        version_number:       nextVersion,
        previous_document_id: opts.existingDocumentId,
      },
    })
}

// ── Log document audit events ─────────────────────────────────────────────────

export async function logDocumentEvent(opts: {
  companyId:   string
  documentId:  string
  event:       string
  actorId?:    string
  actorType?:  'admin' | 'staff' | 'worker' | 'system'
  actorLabel?: string
  prevValue?:  Record<string, unknown>
  newValue?:   Record<string, unknown>
  metadata?:   Record<string, unknown>
}): Promise<void> {
  await adminClient
    .from('document_audit_log')
    .insert({
      company_id:     opts.companyId,
      document_id:    opts.documentId,
      event:          opts.event,
      actor_id:       opts.actorId ?? null,
      actor_type:     opts.actorType ?? 'system',
      actor_label:    opts.actorLabel ?? null,
      previous_value: opts.prevValue ?? null,
      new_value:      opts.newValue ?? null,
      metadata:       opts.metadata ?? null,
    })
}

// ── Fetch document audit history ──────────────────────────────────────────────

export async function getDocumentAuditHistory(documentId: string) {
  const { data } = await adminClient
    .from('document_audit_log')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })

  return data ?? []
}
