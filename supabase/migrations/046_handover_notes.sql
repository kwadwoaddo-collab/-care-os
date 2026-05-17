-- ============================================================
-- 046 — Handover notes
--
-- Shift-to-shift operational handover system. Outgoing
-- coordinators record open issues, follow-up actions, and
-- context for incoming staff. Linked to a date and shift
-- period so incoming coordinators see what was left open.
-- ============================================================

CREATE TABLE handover_notes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Temporal context
  handover_date   DATE        NOT NULL DEFAULT CURRENT_DATE,
  shift_period    TEXT        NOT NULL DEFAULT 'day'
    CHECK (shift_period IN ('morning', 'afternoon', 'evening', 'night', 'day')),

  -- Author
  author_name     TEXT        NOT NULL,
  author_id       UUID        REFERENCES profiles(id) ON DELETE SET NULL,

  -- Content
  summary         TEXT        NOT NULL,
  flagged_items   JSONB       DEFAULT '[]'::jsonb,
  follow_up_actions JSONB     DEFAULT '[]'::jsonb,

  -- Status
  status          TEXT        NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'reviewed', 'archived')),
  reviewed_by     TEXT,
  reviewed_at     TIMESTAMPTZ,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_handover_company_date ON handover_notes(company_id, handover_date DESC);
CREATE INDEX idx_handover_status       ON handover_notes(company_id, status) WHERE status = 'active';
