-- ============================================================
-- 057_pre_employment_checks.sql
--
-- Pre-employment checks for staff members.
-- Tracks DBS, Right to Work, References, and ID verification.
-- One record per check_type per staff_profile.
-- ============================================================

-- Pre-employment checks for staff members
create table if not exists pre_employment_checks (
  id uuid primary key default gen_random_uuid(),
  staff_profile_id uuid not null references staff_profiles(id) on delete cascade,
  check_type text not null check (check_type in ('dbs', 'right_to_work', 'reference', 'id_verification')),
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'complete', 'rejected')),
  -- DBS fields
  dbs_type text check (dbs_type in ('basic', 'standard', 'enhanced', 'enhanced_barred')),
  dbs_certificate_number text,
  dbs_issue_date date,
  dbs_expiry_date date,
  -- Right to Work fields
  rtw_document_type text,
  rtw_checked_date date,
  rtw_expiry_date date,
  rtw_checked_by text,
  -- Reference fields
  ref_referee_name text,
  ref_referee_role text,
  ref_referee_email text,
  ref_requested_date date,
  ref_received_date date,
  ref_employer_name text,
  -- General
  notes text,
  completed_at timestamptz,
  completed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pre_employment_checks_staff_profile_idx
  on pre_employment_checks(staff_profile_id);

create index if not exists pre_employment_checks_type_idx
  on pre_employment_checks(check_type, status);

-- Unique constraint to enforce one record per check type per staff member
-- (enables upsert on conflict)
alter table pre_employment_checks
  add constraint pre_employment_checks_staff_check_unique
  unique (staff_profile_id, check_type);
