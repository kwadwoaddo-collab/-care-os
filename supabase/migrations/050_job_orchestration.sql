-- ============================================================
-- 050 — Background Job Orchestration
--
-- Tracks every job execution for monitoring, retry, and audit.
-- Provides distributed lock semantics for deduplication.
-- Stores lightweight system metrics for observability.
-- ============================================================

-- ── Job executions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_executions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  job_name        TEXT        NOT NULL,
  company_id      UUID        REFERENCES companies(id) ON DELETE SET NULL,

  -- Status
  status          TEXT        NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'success', 'failed', 'retrying', 'cancelled', 'skipped')),

  -- Timing
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  duration_ms     INT,

  -- Retry tracking
  retry_count     INT         NOT NULL DEFAULT 0,
  max_retries     INT         NOT NULL DEFAULT 3,
  parent_id       UUID        REFERENCES job_executions(id) ON DELETE SET NULL,

  -- Result
  error_message   TEXT,
  error_detail    TEXT,
  result          JSONB       DEFAULT '{}'::jsonb,

  -- Provenance
  triggered_by    TEXT        NOT NULL DEFAULT 'cron'
    CHECK (triggered_by IN ('cron', 'manual', 'retry', 'system')),
  instance_id     TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_exec_name       ON job_executions(job_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_exec_status     ON job_executions(status);
CREATE INDEX IF NOT EXISTS idx_job_exec_company    ON job_executions(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_job_exec_started    ON job_executions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_exec_running    ON job_executions(status) WHERE status = 'running';

-- ── Job locks (distributed deduplication) ─────────────────────────────────────
-- lock_key = '<job_name>:<company_id or system>'
CREATE TABLE IF NOT EXISTS job_locks (
  lock_key        TEXT        PRIMARY KEY,
  execution_id    UUID        REFERENCES job_executions(id) ON DELETE CASCADE,
  locked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL,
  instance_id     TEXT
);

CREATE INDEX IF NOT EXISTS idx_job_locks_expires ON job_locks(expires_at);

-- ── System metrics (lightweight time-series) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS system_metrics (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID        REFERENCES companies(id) ON DELETE CASCADE,
  metric_name TEXT        NOT NULL,
  metric_value NUMERIC    NOT NULL,
  tags        JSONB       DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metrics_name    ON system_metrics(metric_name, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_company ON system_metrics(company_id, recorded_at DESC) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_metrics_time    ON system_metrics(recorded_at DESC);

-- Auto-cleanup: keep only last 30 days of metrics to prevent unbounded growth
-- (enforced at application layer in the recorder)

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE job_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_locks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_job_executions" ON job_executions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_job_locks"      ON job_locks      FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_system_metrics" ON system_metrics FOR ALL USING (auth.role() = 'service_role');
