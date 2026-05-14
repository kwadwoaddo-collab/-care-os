ALTER TABLE applicants
  ADD COLUMN IF NOT EXISTS rejected_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS rejection_notes  TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at       TIMESTAMPTZ;

-- Backfill rejected_at from updated_at for already-rejected applicants
UPDATE applicants
SET rejected_at = updated_at
WHERE status = 'rejected' AND rejected_at IS NULL;
