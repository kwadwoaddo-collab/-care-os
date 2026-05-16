-- 040: Fix documents table for worker portal upload
--
-- Two issues addressed:
--
-- 1. documents_check constraint (from 001_initial_schema.sql):
--      CHECK (profile_id IS NOT NULL OR applicant_id IS NOT NULL)
--    Migration 027 was supposed to drop this, but may not have been applied to
--    all environments. The worker upload route only sets staff_profile_id, so the
--    constraint fires and the insert fails with error code 23514.
--    This migration drops it again (idempotent, IF EXISTS).
--
-- 2. reviewed_status CHECK constraint (from 028_document_review_fields.sql):
--      CHECK (reviewed_status IN ('pending', 'approved', 'rejected'))
--    The approval route sets reviewed_status = 'superseded' when renewing a
--    training certificate, which violates this constraint.
--    This migration widens the allowed set to include 'superseded'.

-- ── 1. Drop legacy documents_check constraint (idempotent) ────────────────────

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_check;

-- ── 2. Widen reviewed_status to include 'superseded' ─────────────────────────

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_reviewed_status_check;

ALTER TABLE documents
  ADD CONSTRAINT documents_reviewed_status_check
  CHECK (reviewed_status IN ('pending', 'approved', 'rejected', 'superseded'));
