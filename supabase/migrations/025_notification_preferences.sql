-- 025_notification_preferences.sql
--
-- Company-level notification preferences and per-worker email opt-in fields.

-- ── Company notification preferences ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS company_notification_preferences (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                  UUID        NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  incident_alerts_enabled     BOOLEAN     NOT NULL DEFAULT TRUE,
  decline_alerts_enabled      BOOLEAN     NOT NULL DEFAULT TRUE,
  compliance_alerts_enabled   BOOLEAN     NOT NULL DEFAULT TRUE,
  onboarding_alerts_enabled   BOOLEAN     NOT NULL DEFAULT TRUE,
  daily_digest_enabled        BOOLEAN     NOT NULL DEFAULT TRUE,
  reminder_emails_enabled     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_notif_prefs_company_id
  ON company_notification_preferences (company_id);

-- ── Worker-level email opt-in ─────────────────────────────────────────────────

ALTER TABLE staff_profiles
  ADD COLUMN IF NOT EXISTS receive_shift_emails    BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS receive_reminder_emails BOOLEAN NOT NULL DEFAULT TRUE;
