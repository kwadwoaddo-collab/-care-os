-- 034_rbac_roles.sql
--
-- Extends the user_role enum with two new operational roles:
--   registered_manager — operational oversight, safeguarding, CQC
--   compliance_manager — document review, training, onboarding approvals
--
-- Existing roles (admin, company_admin, coordinator, care_worker, super_admin)
-- are untouched. Safe to re-run (ADD VALUE IF NOT EXISTS).

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'registered_manager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'compliance_manager';

COMMENT ON COLUMN profiles.role IS
  'super_admin (platform only, never assignable in tenant UI) | '
  'company_admin | registered_manager | compliance_manager | '
  'coordinator | care_worker | '
  'admin (legacy alias → company_admin)';
