ALTER TABLE staff_profiles
  ADD COLUMN IF NOT EXISTS left_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS exit_reason      TEXT,
  ADD COLUMN IF NOT EXISTS exit_type        TEXT,
  ADD COLUMN IF NOT EXISTS rehire_eligible  BOOLEAN,
  ADD COLUMN IF NOT EXISTS exit_notes       TEXT;
