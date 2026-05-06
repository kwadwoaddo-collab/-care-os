-- ============================================================
-- 009_staff_profiles.sql
--
-- Extends the existing staff_profiles table (created in 001)
-- to support standalone conversion from applicants without
-- requiring a linked auth profile.
--
-- Changes:
--   1. Make profile_id nullable — conversions don't require auth
--   2. Add first_name, last_name, email, phone, job_role columns
--   3. Add indexes on applicant_id and email
-- ============================================================

-- 1. Allow conversion without a linked auth user
ALTER TABLE staff_profiles
  ALTER COLUMN profile_id DROP NOT NULL;

-- 2. Add contact / role columns copied from applicant at conversion
ALTER TABLE staff_profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name  TEXT,
  ADD COLUMN IF NOT EXISTS email      TEXT,
  ADD COLUMN IF NOT EXISTS phone      TEXT,
  ADD COLUMN IF NOT EXISTS job_role   TEXT;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_staff_profiles_applicant_id
  ON staff_profiles (applicant_id)
  WHERE applicant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_staff_profiles_email
  ON staff_profiles (email)
  WHERE email IS NOT NULL;
