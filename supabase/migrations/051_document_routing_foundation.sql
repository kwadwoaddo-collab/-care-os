-- 051: Intelligent document routing foundation
--
-- Adds the metadata layer that supports automatic document classification,
-- folder assignment, source tracking, and applicant-to-staff continuity.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. source_stage enum
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE document_source_stage AS ENUM (
    'applicant',
    'onboarding',
    'staff',
    'admin_upload',
    'worker_upload',
    'compliance_review',
    'operations_upload'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. visibility enum
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE document_visibility AS ENUM (
    'worker_visible',
    'management_only',
    'compliance_only',
    'confidential'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Extended columns on documents
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS source_stage document_source_stage NULL,
  ADD COLUMN IF NOT EXISTS folder_id UUID NULL,
  ADD COLUMN IF NOT EXISTS version_group_id UUID NULL,
  ADD COLUMN IF NOT EXISTS visibility document_visibility NOT NULL DEFAULT 'management_only',
  ADD COLUMN IF NOT EXISTS worker_visible BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS compliance_linked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS requires_manual_review BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS original_filename TEXT NULL,
  ADD COLUMN IF NOT EXISTS review_status TEXT NULL
    CHECK (
      review_status IS NULL OR review_status IN (
        'auto_routed',
        'pending_review',
        'manually_classified',
        'unrecognised',
        'compliance_linked',
        'archived'
      )
    );

-- Backfill original filename
UPDATE documents
SET original_filename = file_name
WHERE original_filename IS NULL
  AND file_name IS NOT NULL;

-- Backfill source stage
UPDATE documents
SET source_stage = CASE
  WHEN applicant_id IS NOT NULL
       AND staff_profile_id IS NULL
    THEN 'applicant'::document_source_stage
  WHEN staff_profile_id IS NOT NULL
    THEN 'staff'::document_source_stage
  ELSE 'admin_upload'::document_source_stage
END
WHERE source_stage IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. staff_document_folders
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff_document_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  icon TEXT NULL,
  colour TEXT NULL,
  is_system BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_company_slug
  ON staff_document_folders(company_id, slug);

CREATE INDEX IF NOT EXISTS idx_folders_company_order
  ON staff_document_folders(company_id, sort_order);

-- Safe FK creation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'documents_folder_id_fkey'
  ) THEN
    ALTER TABLE documents
      ADD CONSTRAINT documents_folder_id_fkey
      FOREIGN KEY (folder_id)
      REFERENCES staff_document_folders(id)
      ON DELETE SET NULL;
  END IF;
END
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. document_routing_log
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_routing_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  folder_id UUID NULL REFERENCES staff_document_folders(id) ON DELETE SET NULL,

  routing_method TEXT NOT NULL
    CHECK (
      routing_method IN ('auto', 'manual', 'system')
    ),

  document_type_input TEXT NULL,
  matched_rule TEXT NULL,
  routed_by TEXT NULL,
  routed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_routing_log_document
  ON document_routing_log(document_id);

CREATE INDEX IF NOT EXISTS idx_routing_log_company_routed
  ON document_routing_log(company_id, routed_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. document_audit_log
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  event TEXT NOT NULL
    CHECK (
      event IN (
        'uploaded',
        'routed',
        'manually_classified',
        'visibility_changed',
        'classification_changed',
        'conversion_linked',
        'expiry_updated',
        'compliance_linked',
        'viewed',
        'downloaded',
        'approved',
        'rejected',
        'archived',
        'unarchived',
        'version_replaced',
        'deleted'
      )
    ),

  actor_id UUID NULL,

  actor_type TEXT NULL
    CHECK (
      actor_type IN (
        'admin',
        'staff',
        'worker',
        'system'
      )
    ),

  actor_label TEXT NULL,

  previous_value JSONB NULL,
  new_value JSONB NULL,
  metadata JSONB NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_audit_document
  ON document_audit_log(document_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_doc_audit_company
  ON document_audit_log(company_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Indexes on documents
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_documents_folder_id
  ON documents(folder_id)
  WHERE folder_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_source_stage
  ON documents(source_stage)
  WHERE source_stage IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_version_group
  ON documents(version_group_id)
  WHERE version_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_archived
  ON documents(archived_at)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_documents_review_status
  ON documents(review_status)
  WHERE review_status IS NOT NULL;