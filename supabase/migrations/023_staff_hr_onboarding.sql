-- 023_staff_hr_onboarding.sql
--
-- Extends staff_profiles with HR, payroll, and HMRC-readiness fields
-- to support the full employee onboarding lifecycle.

-- ── Personal ──────────────────────────────────────────────────────────────────

ALTER TABLE staff_profiles
  ADD COLUMN IF NOT EXISTS middle_name  TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS gender       TEXT,
  ADD COLUMN IF NOT EXISTS nationality  TEXT;

-- ── Address ───────────────────────────────────────────────────────────────────

ALTER TABLE staff_profiles
  ADD COLUMN IF NOT EXISTS address_line_1 TEXT,
  ADD COLUMN IF NOT EXISTS address_line_2 TEXT,
  ADD COLUMN IF NOT EXISTS city           TEXT,
  ADD COLUMN IF NOT EXISTS postcode       TEXT;

-- ── Emergency contact ─────────────────────────────────────────────────────────

ALTER TABLE staff_profiles
  ADD COLUMN IF NOT EXISTS emergency_contact_name         TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone        TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_relationship TEXT;

-- ── Payroll / HMRC ────────────────────────────────────────────────────────────

ALTER TABLE staff_profiles
  ADD COLUMN IF NOT EXISTS ni_number           TEXT,
  ADD COLUMN IF NOT EXISTS tax_code            TEXT,
  ADD COLUMN IF NOT EXISTS payroll_number      TEXT,
  ADD COLUMN IF NOT EXISTS bank_name           TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_name   TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS bank_sort_code      TEXT,
  ADD COLUMN IF NOT EXISTS starter_declaration TEXT
    CHECK (starter_declaration IN ('A', 'B', 'C')),
  ADD COLUMN IF NOT EXISTS utr_number          TEXT;

-- ── Employment ────────────────────────────────────────────────────────────────

ALTER TABLE staff_profiles
  ADD COLUMN IF NOT EXISTS employment_type       TEXT
    CHECK (employment_type IN ('full_time', 'part_time', 'zero_hours', 'agency')),
  ADD COLUMN IF NOT EXISTS contracted_hours      NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS start_date_confirmed  BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Compliance metadata ───────────────────────────────────────────────────────

ALTER TABLE staff_profiles
  ADD COLUMN IF NOT EXISTS right_to_work_checked BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dbs_checked           BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dbs_number            TEXT,
  ADD COLUMN IF NOT EXISTS dbs_expiry_date        DATE;

-- ── Onboarding status ─────────────────────────────────────────────────────────

ALTER TABLE staff_profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_staff_profiles_ni_number
  ON staff_profiles (ni_number)
  WHERE ni_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_staff_profiles_payroll_number
  ON staff_profiles (payroll_number)
  WHERE payroll_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_staff_profiles_onboarding_completed
  ON staff_profiles (onboarding_completed);
