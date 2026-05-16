-- 041_inactive_staff_status.sql
--
-- Adds 'inactive' to the staff_status enum.
--
-- Context: The application has always included 'inactive' as a valid status
-- in the UI and API (StaffStatusControl, requireAdmin status route), but the
-- original enum in 001_initial_schema.sql only defined:
--   pre_employment, active, suspended, terminated
--
-- Without this migration any attempt to set a staff member to 'inactive'
-- raises a PostgreSQL enum constraint violation (error code 22P02), causing
-- a 500 response in production.
--
-- ADD VALUE IF NOT EXISTS is idempotent — safe to re-run.

ALTER TYPE staff_status ADD VALUE IF NOT EXISTS 'inactive';
