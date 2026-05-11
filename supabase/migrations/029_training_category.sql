-- 029: Training category + issue date for training certificates
--
-- Adds structured training classification to uploaded documents:
--   training_category — enum-like CHECK constraint (simplest MVP design)
--   issue_date        — optional certificate issue date (complements expiry_date)
--
-- This enables compliance mapping:
--   approved training_certificate with training_category = 'safeguarding'
--   → clears the safeguarding missing-training badge
--
-- Design: CHECK constraint enum preferred over a lookup table for MVP.
-- Extending categories later requires only a migration to widen the check.

-- ── Documents: training classification fields ──────────────────────────────────

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS training_category TEXT
    CHECK (training_category IN (
      'manual_handling',
      'safeguarding',
      'basic_life_support',
      'infection_control',
      'health_safety',
      'medication',
      'fire_safety'
    ));

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS issue_date DATE;

-- Index for compliance queries filtered by training category + reviewed status
CREATE INDEX IF NOT EXISTS idx_documents_training_category
  ON documents (training_category)
  WHERE training_category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_training_approved
  ON documents (staff_profile_id, training_category, reviewed_status)
  WHERE training_category IS NOT NULL AND reviewed_status = 'approved';

-- ── Comments ──────────────────────────────────────────────────────────────────

COMMENT ON COLUMN documents.training_category IS
  'Structured training type for training_certificate documents. '
  'Populated at upload time. '
  'Valid values: manual_handling | safeguarding | basic_life_support | '
  'infection_control | health_safety | medication | fire_safety. '
  'NULL for non-training documents.';

COMMENT ON COLUMN documents.issue_date IS
  'Optional certificate issue/award date. '
  'Complements expiry_date — both are recorded when available on the certificate.';
