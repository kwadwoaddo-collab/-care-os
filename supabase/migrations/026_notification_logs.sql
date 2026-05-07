-- 026_notification_logs.sql
--
-- Persists every notification send attempt for audit and debugging.

CREATE TABLE IF NOT EXISTS notification_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event_type      TEXT        NOT NULL,
  recipient_email TEXT,
  subject         TEXT,
  status          TEXT        NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  error_message   TEXT,
  entity_type     TEXT,
  entity_id       UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_company_id  ON notification_logs (company_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_event_type  ON notification_logs (event_type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status      ON notification_logs (status);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at  ON notification_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_entity_id   ON notification_logs (entity_id)
  WHERE entity_id IS NOT NULL;
