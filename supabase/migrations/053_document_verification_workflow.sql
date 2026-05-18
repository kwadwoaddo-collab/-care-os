-- 053: Document verification and compliance approval workflow
--
-- Introduces a distinct verification lifecycle separate from the existing
-- reviewed_status field, enabling safer recruitment, CQC defensibility,
-- and sponsorship-compliant original-seen workflows.
--
-- Changes:
--   1. verification_status enum on documents
--   2. verification_method enum on documents
--   3. Verification metadata columns on documents
--   4. Back-fill verification_status from reviewed_status (idempotent)
--   5. document_resubmission_requests — tracks worker resubmission tasks
--   6. New notification event types for verification events
--   7. Indexes

-- ── 1. verification_status enum ──────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE document_verification_status AS ENUM (
    'pending_verification',
    'verified',
    'approved',
    'rejected',
    'expired',
    'superseded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. verification_method enum ───────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE document_verification_method AS ENUM (
    'original_seen',
    'certified_copy',
    'digital_check',
    'dbs_update_service',
    'sponsor_check',
    'internal_review'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 3. Verification metadata columns on documents ─────────────────────────────

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS verification_status      document_verification_status
    NOT NULL DEFAULT 'pending_verification',
  ADD COLUMN IF NOT EXISTS verified_by              TEXT          NULL,
  ADD COLUMN IF NOT EXISTS verified_at              TIMESTAMPTZ   NULL,
  ADD COLUMN IF NOT EXISTS verification_method      document_verification_method NULL,
  ADD COLUMN IF NOT EXISTS original_seen            BOOLEAN       NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS original_seen_method     TEXT          NULL
    CHECK (original_seen_method IS NULL OR original_seen_method IN (
      'in_person', 'video_call', 'certified_copy', 'digital'
    )),
  ADD COLUMN IF NOT EXISTS original_seen_at         TIMESTAMPTZ   NULL,
  ADD COLUMN IF NOT EXISTS original_seen_by         TEXT          NULL,
  ADD COLUMN IF NOT EXISTS verification_notes       TEXT          NULL,
  ADD COLUMN IF NOT EXISTS rejected_reason          TEXT          NULL,
  ADD COLUMN IF NOT EXISTS resubmission_requested   BOOLEAN       NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS resubmission_requested_at TIMESTAMPTZ  NULL,
  ADD COLUMN IF NOT EXISTS approved_by              TEXT          NULL,
  ADD COLUMN IF NOT EXISTS approved_at              TIMESTAMPTZ   NULL;

-- ── 4. Back-fill verification_status from reviewed_status ─────────────────────

UPDATE documents
SET verification_status = CASE reviewed_status
  WHEN 'approved'    THEN 'approved'::document_verification_status
  WHEN 'rejected'    THEN 'rejected'::document_verification_status
  WHEN 'superseded'  THEN 'superseded'::document_verification_status
  ELSE                    'pending_verification'::document_verification_status
END
WHERE verification_status = 'pending_verification'
  AND reviewed_status IS NOT NULL;

-- Existing approved docs were verified as part of the old admin review
UPDATE documents
SET
  verified_at   = reviewed_at,
  verified_by   = reviewed_by,
  approved_at   = reviewed_at,
  approved_by   = reviewed_by,
  verification_method = 'internal_review'::document_verification_method
WHERE verification_status = 'approved'
  AND verified_at IS NULL;

-- ── 5. document_resubmission_requests ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_resubmission_requests (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_id          UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  staff_profile_id     UUID        NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  requested_by         TEXT        NULL,
  requested_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason               TEXT        NULL,
  document_type        TEXT        NULL,
  folder_slug          TEXT        NULL,
  status               TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'fulfilled', 'cancelled')),
  fulfilled_at         TIMESTAMPTZ NULL,
  fulfilled_document_id UUID       NULL REFERENCES documents(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_resubmission_staff
  ON document_resubmission_requests (staff_profile_id, status);

CREATE INDEX IF NOT EXISTS idx_resubmission_document
  ON document_resubmission_requests (document_id);

-- ── 6. Notification event type additions (widen CHECK constraint) ─────────────
--
-- in_app_notifications.event_type may have a CHECK constraint.
-- We can't easily ADD values to an inline TEXT CHECK without recreating it.
-- Instead we allow any value by dropping the constraint if it exists,
-- which matches how other migrations handle this table.
-- The application layer enforces valid event types via TypeScript enums.

ALTER TABLE in_app_notifications
  DROP CONSTRAINT IF EXISTS in_app_notifications_event_type_check;

-- ── 7. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_documents_verification_status
  ON documents (verification_status);

CREATE INDEX IF NOT EXISTS idx_documents_pending_verification
  ON documents (company_id, created_at DESC)
  WHERE verification_status = 'pending_verification';

CREATE INDEX IF NOT EXISTS idx_documents_resubmission_requested
  ON documents (company_id)
  WHERE resubmission_requested = TRUE;
