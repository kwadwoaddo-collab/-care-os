-- ============================================================
-- 039_backfill_applicant_ids.sql
-- Backfill staff_profiles.applicant_id using email
-- ============================================================

UPDATE staff_profiles sp
SET applicant_id = a.id
FROM applicants a
WHERE sp.applicant_id IS NULL
  AND sp.email = a.email
  AND sp.company_id = a.company_id;
