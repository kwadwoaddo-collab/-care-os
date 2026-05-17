-- ============================================================
-- 049 — Care Delivery Execution Infrastructure
--
-- Structured care task checklists, medication administration
-- records, visit anomaly detection, and field escalation
-- tracking. Extends the existing visit_notes + timesheets
-- system without replacing it.
-- ============================================================

-- ── Extend visit_notes with execution fields ──────────────────────────────────
ALTER TABLE visit_notes
  ADD COLUMN IF NOT EXISTS arrived_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS departed_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS visit_duration_minutes INT,
  ADD COLUMN IF NOT EXISTS is_missed            BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS missed_reason        TEXT,
  ADD COLUMN IF NOT EXISTS missed_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalation_raised    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS escalation_type      TEXT
    CHECK (escalation_type IN ('safeguarding', 'medical', 'medication', 'operational', 'client_refusal', 'other') OR escalation_type IS NULL),
  ADD COLUMN IF NOT EXISTS escalation_notes     TEXT,
  ADD COLUMN IF NOT EXISTS escalation_raised_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_visit_notes_is_missed   ON visit_notes (is_missed) WHERE is_missed = TRUE;
CREATE INDEX IF NOT EXISTS idx_visit_notes_escalation  ON visit_notes (escalation_raised) WHERE escalation_raised = TRUE;
CREATE INDEX IF NOT EXISTS idx_visit_notes_arrived     ON visit_notes (arrived_at);

-- ── Structured care task checklist ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS visit_task_items (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_note_id    UUID        NOT NULL REFERENCES visit_notes(id) ON DELETE CASCADE,
  company_id       UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  shift_id         UUID        REFERENCES shifts(id) ON DELETE CASCADE,

  -- Task classification
  task_type        TEXT        NOT NULL DEFAULT 'care'
    CHECK (task_type IN ('care', 'medication', 'observation', 'wellbeing', 'risk')),
  task_name        TEXT        NOT NULL,
  task_description TEXT,

  -- Outcome
  status           TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'skipped', 'partial', 'refused')),
  refused_reason   TEXT,
  notes            TEXT,

  -- Completion tracking
  completed_at     TIMESTAMPTZ,
  completed_by     UUID        REFERENCES staff_profiles(id) ON DELETE SET NULL,
  sequence_order   INT         NOT NULL DEFAULT 0,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visit_tasks_note     ON visit_task_items(visit_note_id);
CREATE INDEX IF NOT EXISTS idx_visit_tasks_shift    ON visit_task_items(shift_id);
CREATE INDEX IF NOT EXISTS idx_visit_tasks_company  ON visit_task_items(company_id);
CREATE INDEX IF NOT EXISTS idx_visit_tasks_status   ON visit_task_items(status);
CREATE INDEX IF NOT EXISTS idx_visit_tasks_type     ON visit_task_items(task_type);

-- ── Medication administration records ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS visit_medication_records (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_note_id       UUID        NOT NULL REFERENCES visit_notes(id) ON DELETE CASCADE,
  company_id          UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  shift_id            UUID        REFERENCES shifts(id) ON DELETE CASCADE,
  staff_profile_id    UUID        REFERENCES staff_profiles(id) ON DELETE SET NULL,

  -- Medication details
  medication_name     TEXT        NOT NULL,
  dose                TEXT,
  route               TEXT,        -- oral, topical, inhaled, injection, etc.
  scheduled_time      TEXT,        -- HH:MM format

  -- Administration outcome
  action              TEXT        NOT NULL DEFAULT 'administered'
    CHECK (action IN ('administered', 'refused', 'unavailable', 'missed', 'prn')),
  administered_at     TIMESTAMPTZ,
  refused_reason      TEXT,
  prn_reason          TEXT,        -- reason PRN was given
  notes               TEXT,

  -- Escalation
  requires_escalation BOOLEAN     NOT NULL DEFAULT FALSE,
  escalated           BOOLEAN     NOT NULL DEFAULT FALSE,
  escalated_at        TIMESTAMPTZ,
  incident_id         UUID        REFERENCES incidents(id) ON DELETE SET NULL,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_med_records_note      ON visit_medication_records(visit_note_id);
CREATE INDEX IF NOT EXISTS idx_med_records_shift     ON visit_medication_records(shift_id);
CREATE INDEX IF NOT EXISTS idx_med_records_company   ON visit_medication_records(company_id);
CREATE INDEX IF NOT EXISTS idx_med_records_action    ON visit_medication_records(action);
CREATE INDEX IF NOT EXISTS idx_med_records_escalate  ON visit_medication_records(requires_escalation) WHERE requires_escalation = TRUE;

-- ── Visit anomaly detection ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS visit_anomalies (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  shift_id        UUID        REFERENCES shifts(id) ON DELETE CASCADE,
  visit_note_id   UUID        REFERENCES visit_notes(id) ON DELETE CASCADE,

  anomaly_type    TEXT        NOT NULL
    CHECK (anomaly_type IN (
      'late_arrival', 'early_departure', 'short_visit', 'no_show',
      'repeated_missed', 'medication_anomaly', 'task_skip_pattern',
      'repeated_refusal', 'escalation_raised'
    )),
  severity        TEXT        NOT NULL DEFAULT 'warning'
    CHECK (severity IN ('info', 'warning', 'critical')),
  description     TEXT        NOT NULL,

  -- Auto-detection metadata
  auto_detected   BOOLEAN     NOT NULL DEFAULT TRUE,
  detection_data  JSONB       DEFAULT '{}'::jsonb,

  -- Resolution
  resolved        BOOLEAN     NOT NULL DEFAULT FALSE,
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  resolution_notes TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anomalies_company   ON visit_anomalies(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomalies_shift     ON visit_anomalies(shift_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_type      ON visit_anomalies(anomaly_type);
CREATE INDEX IF NOT EXISTS idx_anomalies_severity  ON visit_anomalies(severity);
CREATE INDEX IF NOT EXISTS idx_anomalies_unresolved ON visit_anomalies(company_id) WHERE resolved = FALSE;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE visit_task_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_medication_records  ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_anomalies           ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_visit_tasks"   ON visit_task_items          FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_med_records"   ON visit_medication_records  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_anomalies"     ON visit_anomalies           FOR ALL USING (auth.role() = 'service_role');
