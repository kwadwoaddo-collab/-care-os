import 'server-only'
import { adminClient } from '@/lib/supabase/admin'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DocumentFolder {
  id:          string
  name:        string
  slug:        string
  sort_order:  number
  icon:        string | null
  colour:      string | null
  description: string | null
  documents:   RepositoryDocument[]
}

export interface RepositoryDocument {
  id:                     string
  document_type:          string
  file_name:              string
  file_path:              string | null
  file_size:              number | null
  mime_type:              string | null
  expiry_date:            string | null
  issue_date:             string | null
  created_at:             string
  reviewed_status:        string | null
  review_notes:           string | null
  review_status:          string | null
  source_stage:           string | null
  worker_visible:         boolean
  visibility:             string
  compliance_linked:      boolean
  archived_at:            string | null
  version_group_id:       string | null
  requires_manual_review: boolean
  original_filename:      string | null
  applicant_id:           string | null
  staff_profile_id:       string | null
  folder_id:              string | null
  // Verification fields (migration 053)
  verification_status:    string | null
  verified_by:            string | null
  verified_at:            string | null
  verification_method:    string | null
  original_seen:          boolean
  rejected_reason:        string | null
  resubmission_requested: boolean
  approved_by:            string | null
  approved_at:            string | null
}

// ── Fetch full document repository for a staff member ────────────────────────

export async function getStaffDocumentRepository(opts: {
  staffProfileId: string
  applicantId:    string | null
  companyId:      string
  includeArchived?: boolean
}): Promise<{ folders: DocumentFolder[]; unclassified: RepositoryDocument[] }> {
  const { staffProfileId, applicantId, companyId, includeArchived = false } = opts

  // Fetch all folders
  const { data: folderRows } = await adminClient
    .from('staff_document_folders')
    .select('id, name, slug, sort_order, icon, colour, description')
    .eq('company_id', companyId)
    .order('sort_order', { ascending: true })

  const folders: DocumentFolder[] = (folderRows ?? []).map((f) => ({ ...f, documents: [] }))

  // Build document query
  let docQuery = adminClient
    .from('documents')
    .select(`
      id, document_type, file_name, file_path, file_size, mime_type,
      expiry_date, issue_date, created_at, reviewed_status, review_notes, review_status,
      source_stage, worker_visible, visibility, compliance_linked,
      archived_at, version_group_id, requires_manual_review,
      original_filename, applicant_id, staff_profile_id, folder_id,
      verification_status, verified_by, verified_at, verification_method,
      original_seen, rejected_reason, resubmission_requested,
      approved_by, approved_at
    `)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (!includeArchived) {
    docQuery = docQuery.is('archived_at', null)
  }

  // Documents directly on this staff profile
  const conditions: string[] = [`staff_profile_id.eq.${staffProfileId}`]
  if (applicantId) conditions.push(`applicant_id.eq.${applicantId}`)

  const { data: allDocs } = await docQuery.or(conditions.join(','))

  const docs = allDocs as RepositoryDocument[] ?? []

  // Deduplicate by id (applicant docs may appear for both queries)
  const seen = new Set<string>()
  const uniqueDocs = docs.filter((d) => {
    if (seen.has(d.id)) return false
    seen.add(d.id)
    return true
  })

  const folderMap = new Map(folders.map((f) => [f.id, f]))
  const unclassified: RepositoryDocument[] = []

  for (const doc of uniqueDocs) {
    if (doc.folder_id && folderMap.has(doc.folder_id)) {
      folderMap.get(doc.folder_id)!.documents.push(doc)
    } else {
      unclassified.push(doc)
    }
  }

  return {
    folders:      folders.filter((f) => f.slug !== 'archive' || includeArchived),
    unclassified,
  }
}

// ── Get worker-visible documents only ────────────────────────────────────────

export async function getWorkerVisibleDocuments(opts: {
  staffProfileId: string
  applicantId:    string | null
  companyId:      string
}) {
  const conditions: string[] = [`staff_profile_id.eq.${opts.staffProfileId}`]
  if (opts.applicantId) conditions.push(`applicant_id.eq.${opts.applicantId}`)

  const { data } = await adminClient
    .from('documents')
    .select(`
      id, document_type, file_name, file_path, file_size, mime_type,
      expiry_date, issue_date, created_at, reviewed_status,
      source_stage, visibility, compliance_linked
    `)
    .eq('company_id', opts.companyId)
    .eq('worker_visible', true)
    .is('archived_at', null)
    .or(conditions.join(','))
    .order('created_at', { ascending: false })

  return data ?? []
}

// ── Get documents expiring within N days ─────────────────────────────────────

export async function getExpiringDocuments(opts: {
  companyId:   string
  withinDays?: number
}) {
  const days = opts.withinDays ?? 30
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() + days)

  const { data } = await adminClient
    .from('documents')
    .select(`
      id, document_type, file_name, expiry_date, created_at,
      staff_profile_id, applicant_id, compliance_linked,
      staff_profiles ( first_name, last_name, email )
    `)
    .eq('company_id', opts.companyId)
    .is('archived_at', null)
    .not('expiry_date', 'is', null)
    .lte('expiry_date', cutoff.toISOString().split('T')[0])
    .gte('expiry_date', new Date().toISOString().split('T')[0])
    .order('expiry_date', { ascending: true })

  return data ?? []
}

// ── Get document version history ──────────────────────────────────────────────

export async function getDocumentVersionHistory(versionGroupId: string) {
  const { data } = await adminClient
    .from('staff_document_versions')
    .select(`
      id, version_number, is_current, superseded_at, created_at,
      documents ( id, file_name, document_type, created_at, reviewed_status )
    `)
    .eq('version_group_id', versionGroupId)
    .order('version_number', { ascending: false })

  return data ?? []
}

// ── Get folders with document counts ─────────────────────────────────────────

export async function getFolderSummaries(opts: {
  staffProfileId: string
  applicantId:    string | null
  companyId:      string
}) {
  const { folders, unclassified } = await getStaffDocumentRepository({
    staffProfileId: opts.staffProfileId,
    applicantId:    opts.applicantId,
    companyId:      opts.companyId,
  })

  return {
    folders: folders.map((f) => ({
      id:           f.id,
      name:         f.name,
      slug:         f.slug,
      icon:         f.icon,
      colour:       f.colour,
      count:        f.documents.length,
      expiring:     f.documents.filter((d) => isExpiringSoon(d.expiry_date)).length,
      expired:      f.documents.filter((d) => isExpired(d.expiry_date)).length,
    })),
    unclassifiedCount: unclassified.length,
  }
}

function isExpired(iso: string | null | undefined): boolean {
  if (!iso) return false
  return new Date(iso) < new Date()
}

function isExpiringSoon(iso: string | null | undefined): boolean {
  if (!iso) return false
  const expiry = new Date(iso)
  const warn = new Date()
  warn.setDate(warn.getDate() + 30)
  return expiry > new Date() && expiry <= warn
}
