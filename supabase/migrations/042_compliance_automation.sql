-- supabase/migrations/042_compliance_automation.sql
--
-- Adds infrastructure for the smart compliance and expiry automation system.
--
-- Changes:
--   1. non_compliant_since on staff_profiles — tracks when a staff member
--      first became non-compliant (set by daily sweep, cleared on resolution).
--      Used to calculate escalation levels.
--
--   2. last_sweep_at on staff_profiles — timestamp of the last compliance sweep
--      for this staff member. Informational, useful for debugging.
--
--   3. compliance_risk_score on staff_profiles — cached integer risk score (0-100)
--      written by the sweep cron. Avoids recomputing on every dashboard load.
--
--   4. compliance_state on staff_profiles — cached state (compliant/warning/
--      non_compliant/blocked) written by the sweep cron.
--
--   5. Index on non_compliant_since for escalation queries.
--
-- The sweep cron at /api/cron/compliance-sweep will maintain these columns.

-- 1. non_compliant_since
ALTER TABLE staff_profiles
  ADD COLUMN IF NOT EXISTS non_compliant_since  TIMESTAMPTZ  NULL;

-- 2. last_sweep_at
ALTER TABLE staff_profiles
  ADD COLUMN IF NOT EXISTS last_sweep_at  TIMESTAMPTZ  NULL;

-- 3. compliance_risk_score (0 = low risk, 100 = highest risk)
ALTER TABLE staff_profiles
  ADD COLUMN IF NOT EXISTS compliance_risk_score  SMALLINT  NULL
    CHECK (compliance_risk_score IS NULL OR (compliance_risk_score >= 0 AND compliance_risk_score <= 100));

-- 4. compliance_state (cached from last sweep)
ALTER TABLE staff_profiles
  ADD COLUMN IF NOT EXISTS compliance_state  TEXT  NULL
    CHECK (compliance_state IS NULL OR compliance_state IN ('compliant','warning','non_compliant','blocked'));

-- 5. Index for escalation queries (find long-running non-compliant staff)
CREATE INDEX IF NOT EXISTS idx_staff_non_compliant_since
  ON staff_profiles (non_compliant_since)
  WHERE non_compliant_since IS NOT NULL;

-- 6. Index for risk-score ordering on dashboard
CREATE INDEX IF NOT EXISTS idx_staff_compliance_risk_score
  ON staff_profiles (compliance_risk_score DESC)
  WHERE compliance_risk_score IS NOT NULL;
