-- ============================================================
-- 062_onboarding_checklist_templates.sql
--
-- Phase 3: template-driven onboarding checklists per role.
--
-- An admin defines a checklist_template (optionally scoped to a
-- job_role — NULL applies to every role) made up of ordered
-- checklist_template_items. When assigned to a staff member, a
-- staff_checklist instance is created and each template item is
-- snapshotted into staff_checklist_items (title/description/category
-- copied at assignment time) so later edits to the template don't
-- retroactively change a checklist someone is already partway through.
--
-- NOTE ON MIGRATION NUMBERING: 060 and 061 are claimed by two other
-- unmerged branches (RLS hardening workstreams A and B). This migration
-- assumes those merge first and uses 062. If this branch merges before
-- them, renumber to avoid a collision — never leave two migrations
-- with the same number.
-- ============================================================

create table if not exists checklist_templates (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  name        text not null,
  description text,
  job_role    text,  -- NULL = applies to every role
  is_active   boolean not null default true,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_checklist_templates_company on checklist_templates(company_id);
create index if not exists idx_checklist_templates_role     on checklist_templates(company_id, job_role);

create table if not exists checklist_template_items (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references checklist_templates(id) on delete cascade,
  title       text not null,
  description text,
  category    text not null default 'task' check (category in ('documentation', 'training', 'meeting', 'task')),
  is_required boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_checklist_template_items_template on checklist_template_items(template_id, sort_order);

create table if not exists staff_checklists (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references companies(id) on delete cascade,
  staff_profile_id uuid not null references staff_profiles(id) on delete cascade,
  template_id      uuid references checklist_templates(id) on delete set null,
  template_name    text not null,  -- snapshotted in case the template is later renamed/deleted
  assigned_by      uuid references auth.users(id),
  assigned_at      timestamptz not null default now(),
  completed_at     timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists idx_staff_checklists_staff on staff_checklists(staff_profile_id);
create index if not exists idx_staff_checklists_company on staff_checklists(company_id);

create table if not exists staff_checklist_items (
  id                  uuid primary key default gen_random_uuid(),
  staff_checklist_id  uuid not null references staff_checklists(id) on delete cascade,
  template_item_id    uuid references checklist_template_items(id) on delete set null,
  title               text not null,
  description         text,
  category            text not null default 'task' check (category in ('documentation', 'training', 'meeting', 'task')),
  is_required         boolean not null default true,
  sort_order          integer not null default 0,
  is_complete         boolean not null default false,
  completed_at        timestamptz,
  completed_by        uuid references auth.users(id),
  notes               text,
  created_at          timestamptz not null default now()
);

create index if not exists idx_staff_checklist_items_checklist on staff_checklist_items(staff_checklist_id, sort_order);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Every route uses the service-role client, which bypasses RLS. These
-- policies are the backstop, matching the pattern in
-- 047_tenant_administration.sql.

alter table checklist_templates      enable row level security;
alter table checklist_template_items enable row level security;
alter table staff_checklists         enable row level security;
alter table staff_checklist_items    enable row level security;

create policy "service_role_only_checklist_templates"      on checklist_templates      using (auth.role() = 'service_role');
create policy "service_role_only_checklist_template_items" on checklist_template_items using (auth.role() = 'service_role');
create policy "service_role_only_staff_checklists"         on staff_checklists         using (auth.role() = 'service_role');
create policy "service_role_only_staff_checklist_items"    on staff_checklist_items    using (auth.role() = 'service_role');
