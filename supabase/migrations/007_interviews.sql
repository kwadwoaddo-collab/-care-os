-- Create interviews table for the Care OS Interview Module.
-- Outcomes map to the hiring pipeline:
--   pending         — interview scheduled, not yet assessed
--   recommend_hire  — interviewer recommends hiring
--   hold            — borderline, needs review
--   reject          — not recommended

CREATE TABLE IF NOT EXISTS interviews (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id     UUID NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  scheduled_at     TIMESTAMPTZ,
  interview_type   TEXT,
  interviewer_name TEXT,
  location         TEXT,
  notes            TEXT,
  score            INTEGER CHECK (score BETWEEN 1 AND 10),
  outcome          TEXT NOT NULL DEFAULT 'pending'
                     CHECK (outcome IN ('pending', 'recommend_hire', 'hold', 'reject')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interviews_applicant
  ON interviews (applicant_id, scheduled_at DESC);
