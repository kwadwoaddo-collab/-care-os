-- Add compliance review fields to staff_profiles
ALTER TABLE staff_profiles
  ADD COLUMN IF NOT EXISTS last_reviewed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_reviewed_by   TEXT,
  ADD COLUMN IF NOT EXISTS last_review_notes  TEXT;
