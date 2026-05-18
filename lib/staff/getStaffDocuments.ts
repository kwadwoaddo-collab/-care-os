import 'server-only'
import { adminClient } from '@/lib/supabase/admin'

export interface StaffDocument {
  id:                  string
  document_type:       string
  file_name:           string
  file_path:           string | null
  file_size:           number | null
  mime_type:           string | null
  expiry_date:         string | null
  issue_date:          string | null
  training_category:   string | null
  applicant_id:        string | null
  created_at:          string
  reviewed_status:     string | null
  review_notes:        string | null
  reviewed_by:         string | null
  reviewed_at:         string | null
  verification_status: string | null
  verified_by:         string | null
  verified_at:         string | null
  verification_method: string | null
  original_seen:       boolean
  rejected_reason:     string | null
  approved_by:         string | null
  approved_at:         string | null
  source_stage:        string | null
  folder_id:           string | null
  worker_visible:      boolean
  compliance_linked:   boolean
}

/**
 * Fetches all documents for a staff member from both sources
 * (staff_profile_id and linked applicant_id) and deduplicates by id.
 */
export async function getStaffDocuments(
  staffProfileId: string,
  applicantId:    string | null,
): Promise<StaffDocument[]> {
  const SELECT = [
    'id', 'document_type', 'file_name', 'file_path', 'file_size',
    'mime_type', 'expiry_date', 'issue_date', 'training_category', 'applicant_id',
    'created_at', 'reviewed_status', 'review_notes', 'reviewed_by', 'reviewed_at',
    'verification_status', 'verified_by', 'verified_at', 'verification_method',
    'original_seen', 'rejected_reason', 'approved_by', 'approved_at',
    'source_stage', 'folder_id', 'worker_visible', 'compliance_linked',
  ].join(', ')
  const docs: StaffDocument[] = []

  const { data: staffDocs } = await adminClient
    .from('documents')
    .select(SELECT)
    .eq('staff_profile_id', staffProfileId)
    .order('created_at', { ascending: false })

  if (staffDocs) docs.push(...(staffDocs as unknown as StaffDocument[]))

  if (applicantId) {
    const { data: applicantDocs } = await adminClient
      .from('documents')
      .select(SELECT)
      .eq('applicant_id', applicantId)
      .order('created_at', { ascending: false })

    if (applicantDocs) docs.push(...(applicantDocs as unknown as StaffDocument[]))
  }

  const seen = new Set<string>()
  return docs.filter((d) => {
    if (seen.has(d.id)) return false
    seen.add(d.id)
    return true
  })
}

