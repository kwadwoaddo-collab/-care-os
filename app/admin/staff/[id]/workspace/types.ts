// Shared types for the document workspace

export interface WorkspaceFolder {
  id:          string
  name:        string
  slug:        string
  sort_order:  number
  icon:        string | null
  colour:      string | null
  description: string | null
  documents:   WorkspaceDocument[]
}

export interface WorkspaceDocument {
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
  source_stage:           string | null
  verification_status:    string | null
  verified_by:            string | null
  verified_at:            string | null
  verification_method:    string | null
  original_seen:          boolean
  rejected_reason:        string | null
  resubmission_requested: boolean
  approved_by:            string | null
  approved_at:            string | null
  worker_visible:         boolean
  visibility:             string
  compliance_linked:      boolean
  archived_at:            string | null
  folder_id:              string | null
  requires_manual_review: boolean
  applicant_id:           string | null
  staff_profile_id:       string | null
}

export type ViewMode = 'table' | 'grid'

export type FilterKey =
  | 'all'
  | 'pending_verification'
  | 'verified'
  | 'approved'
  | 'rejected'
  | 'expiring'
  | 'expired'
  | 'worker_visible'
  | 'compliance_linked'
  | 'resubmission'

export interface WorkspaceFilters {
  status:        FilterKey
  sourceStage:   string
  expiryRisk:    'all' | 'expiring' | 'expired'
  workerVisible: boolean | null
  search:        string
}
