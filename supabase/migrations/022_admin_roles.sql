-- 022_admin_roles.sql
--
-- Extends the user_role enum with granular admin roles.
-- Existing 'admin' values are preserved and treated as 'company_admin' in
-- application code via normaliseRole() in lib/auth/roles.ts.
-- New profiles should use 'company_admin', 'coordinator', or 'super_admin'.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'company_admin';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'coordinator';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'care_worker';

-- Add optional full_name column for convenience (profiles already has first_name + last_name)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED;

COMMENT ON COLUMN profiles.role IS
  'admin = legacy (treated as company_admin), super_admin, company_admin, coordinator, care_worker';
