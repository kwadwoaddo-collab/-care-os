-- 054: Document lifecycle automation
--
-- Adds infrastructure for smart expiry scheduling, lifecycle automation,
-- and onboarding/readiness analytics.
--
-- Changes:
--   1. document_expiry_reminders — tracks sent reminder cadence per document
--   2. worker_readiness_snapshots — cached readiness state for analytics
--   3. onboarding_lifecycle_log — event log for onboarding state transitions
--   4. Indexes for lifecycle queries

-- ── 1. document_expiry_reminders ─────────────────────────────────────────────
--
-- One row per document × reminder_band combination.
-- Used by the scheduler to prevent duplicate reminders.

CREATE TABLE IF NOT EXISTS document_expiry_reminders (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_id      UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  staff_profile_id UUID        NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  reminder_band    SMALLINT    NOT NULL,   -- 90, 60, 30, 14, 7, or 1 (days before expiry)
  expiry_date      DATE        NOT NULL,
  channel          TEXT        NOT NULL
    CHECK (channel IN ('in_app', 'email', 'operations_queue')),
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at  TIMESTAMPTZ NULL
);

-- Idempotency: only one reminder per document per band
CREATE UNIQUE INDEX IF NOT EXISTS idx_expiry_reminders_doc_band
  ON document_expiry_reminders (document_id, reminder_band);

CREATE INDEX IF NOT EXISTS idx_expiry_reminders_company
  ON document_expiry_reminders (company_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_expiry_reminders_staff
  ON document_expiry_reminders (staff_profile_id, sent_at DESC)
  WHERE staff_profile_id IS NOT NULL;

-- ── 2. worker_readiness_snapshots ────────────────────────────────────────────
--
-- Cached readiness state computed by the lifecycle cron.
-- Avoids recomputing readiness on every dashboard load.
-- Written by /api/cron/lifecycle-automation, read by the workforce dashboard.

CREATE TABLE IF NOT EXISTS worker_readiness_snapshots (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id               UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  staff_profile_id         UUID        NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  readiness_stage          TEXT        NOT NULL,
  deployability_score      SMALLINT    NOT NULL DEFAULT 0,
  onboarding_progress      SMALLINT    NOT NULL DEFAULT 0,
  verification_progress    SMALLINT    NOT NULL DEFAULT 0,
  compliance_percentage    SMALLINT    NOT NULL DEFAULT 0,
  pending_verification_count SMALLINT  NOT NULL DEFAULT 0,
  rejected_count           SMALLINT    NOT NULL DEFAULT 0,
  critical_expiry_count    SMALLINT    NOT NULL DEFAULT 0,
  is_deployable            BOOLEAN     NOT NULL DEFAULT FALSE,
  is_compliance_eligible   BOOLEAN     NOT NULL DEFAULT FALSE,
  blockers                 JSONB       NULL,
  warnings                 JSONB       NULL,
  expiry_alerts            JSONB       NULL,
  assessed_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_readiness_snapshots_staff
  ON worker_readiness_snapshots (staff_profile_id);

CREATE INDEX IF NOT EXISTS idx_readiness_snapshots_company_stage
  ON worker_readiness_snapshots (company_id, readiness_stage);

CREATE INDEX IF NOT EXISTS idx_readiness_snapshots_score
  ON worker_readiness_snapshots (company_id, deployability_score DESC);

CREATE INDEX IF NOT EXISTS idx_readiness_snapshots_assessed
  ON worker_readiness_snapshots (company_id, assessed_at DESC);

-- ── 3. onboarding_lifecycle_log ───────────────────────────────────────────────
--
-- Audit trail of readiness stage transitions.
-- Enables analytics: avg onboarding duration, verification turnaround, etc.

CREATE TABLE IF NOT EXISTS onboarding_lifecycle_log (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  staff_profile_id UUID        NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  from_stage       TEXT        NULL,
  to_stage         TEXT        NOT NULL,
  triggered_by     TEXT        NULL,   -- 'cron' | 'admin_action' | 'worker_upload' | 'approval'
  metadata         JSONB       NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lifecycle_log_staff
  ON onboarding_lifecycle_log (staff_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lifecycle_log_company
  ON onboarding_lifecycle_log (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lifecycle_log_stage_transition
  ON onboarding_lifecycle_log (company_id, to_stage, created_at DESC);
