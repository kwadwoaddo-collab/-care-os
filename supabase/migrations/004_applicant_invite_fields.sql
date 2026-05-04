-- Add fields required for the applicant invite + magic link flow.
-- token_hash stores SHA-256 of the raw token — the raw token is never persisted.

ALTER TABLE applicants
  ADD COLUMN IF NOT EXISTS job_role         TEXT,
  ADD COLUMN IF NOT EXISTS token_hash       TEXT,
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;
