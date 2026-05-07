-- ============================================================
-- 021 — Incidents table
--
-- Turns visit-note incident flags into a proper care incident
-- workflow with severity, status, escalation, and resolution
-- tracking.
-- ============================================================

CREATE TABLE incidents (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID        NOT NULL,
  visit_note_id         UUID        REFERENCES visit_notes(id)     ON DELETE SET NULL,
  shift_id              UUID        REFERENCES shifts(id)          ON DELETE SET NULL,
  client_id             UUID        REFERENCES clients(id)         ON DELETE SET NULL,
  staff_profile_id      UUID        REFERENCES staff_profiles(id)  ON DELETE SET NULL,
  incident_type         TEXT        NOT NULL
    CHECK (incident_type IN (
      'fall', 'medication_error', 'safeguarding', 'injury',
      'behaviour', 'missed_visit', 'property_damage', 'complaint', 'other'
    )),
  severity              TEXT        NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status                TEXT        NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
  occurred_at           TIMESTAMPTZ,
  description           TEXT        NOT NULL,
  immediate_action_taken TEXT,
  escalation_required   BOOLEAN     DEFAULT FALSE,
  escalated_to          TEXT,
  follow_up_required    BOOLEAN     DEFAULT FALSE,
  follow_up_notes       TEXT,
  resolved_at           TIMESTAMPTZ,
  resolution_notes      TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_incidents_company       ON incidents(company_id);
CREATE INDEX idx_incidents_client        ON incidents(client_id);
CREATE INDEX idx_incidents_staff         ON incidents(staff_profile_id);
CREATE INDEX idx_incidents_status        ON incidents(status);
CREATE INDEX idx_incidents_severity      ON incidents(severity);
CREATE INDEX idx_incidents_occurred_at   ON incidents(occurred_at);
CREATE INDEX idx_incidents_visit_note    ON incidents(visit_note_id) WHERE visit_note_id IS NOT NULL;
