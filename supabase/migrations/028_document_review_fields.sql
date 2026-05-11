-- 028: Document review fields + policy acknowledgement tracking
--
-- Adds per-document admin review workflow:
--   reviewed_status | review_notes | reviewed_by | reviewed_at
--
-- Adds lightweight policy acknowledgement to staff_profiles:
--   policy_acknowledged | policy_acknowledged_at
--
-- These support the onboarding + compliance MVP (Phase 1):
--   - Admins can approve or reject individual uploaded documents
--   - Workers can acknowledge policies as part of onboarding checklist

-- ── Documents: review fields ───────────────────────────────────────────────────

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS reviewed_status  TEXT
    CHECK (reviewed_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS review_notes     TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by      TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at      TIMESTAMPTZ;

-- Default all existing documents to 'pending' (unreviewed)
UPDATE documents
  SET reviewed_status = 'pending'
  WHERE reviewed_status IS NULL;

-- Index for admin review queue queries
CREATE INDEX IF NOT EXISTS idx_documents_reviewed_status
  ON documents (reviewed_status);

CREATE INDEX IF NOT EXISTS idx_documents_staff_reviewed
  ON documents (staff_profile_id, reviewed_status)
  WHERE staff_profile_id IS NOT NULL;

-- ── Staff profiles: policy acknowledgement ────────────────────────────────────

ALTER TABLE staff_profiles
  ADD COLUMN IF NOT EXISTS policy_acknowledged     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS policy_acknowledged_at  TIMESTAMPTZ;

-- ── Comments for documentation ─────────────────────────────────────────────────

COMMENT ON COLUMN documents.reviewed_status IS
  'Admin review state for an uploaded document. NULL means not yet reviewed (legacy). pending = awaiting review. approved = accepted as valid. rejected = not accepted.';

COMMENT ON COLUMN documents.review_notes IS
  'Optional admin notes recorded when approving or rejecting a document.';

COMMENT ON COLUMN documents.reviewed_by IS
  'Name or identifier of the admin who performed the review.';

COMMENT ON COLUMN documents.reviewed_at IS
  'Timestamp when the document was last reviewed by an admin.';

COMMENT ON COLUMN staff_profiles.policy_acknowledged IS
  'Whether the staff member has acknowledged company policies during onboarding. Lightweight — no versioning yet.';

COMMENT ON COLUMN staff_profiles.policy_acknowledged_at IS
  'Timestamp when the policy was acknowledged.';
