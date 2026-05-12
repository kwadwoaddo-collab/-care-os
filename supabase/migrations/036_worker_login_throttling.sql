-- 036_worker_login_throttling.sql

ALTER TABLE staff_profiles
  ADD COLUMN IF NOT EXISTS portal_token_requested_at TIMESTAMPTZ;

-- Index for lookup if needed, but mostly for self-service lookups
CREATE INDEX IF NOT EXISTS idx_staff_profiles_email ON staff_profiles(email);
