-- ============================================================
-- 044 — Incident risk scoring columns
--
-- Adds computed risk score, classification, and factor detail
-- to each incident record. Scores are computed at write time
-- by the API layer so coordinators can filter/sort by risk.
-- ============================================================

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS risk_score           SMALLINT DEFAULT NULL
    CHECK (risk_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS risk_classification  TEXT     DEFAULT NULL
    CHECK (risk_classification IN ('low', 'medium', 'high', 'critical')),
  ADD COLUMN IF NOT EXISTS risk_factors         JSONB    DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_incidents_risk_score
  ON incidents(risk_score DESC)
  WHERE risk_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_incidents_risk_classification
  ON incidents(company_id, risk_classification)
  WHERE risk_classification IS NOT NULL;
