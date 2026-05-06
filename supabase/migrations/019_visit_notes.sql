-- ── Visit notes ───────────────────────────────────────────────────────────────
-- Records care work completed during a shift for audit and operational review.

create table if not exists visit_notes (
  id                   uuid        primary key default gen_random_uuid(),
  company_id           uuid        not null,
  shift_id             uuid        not null references shifts(id) on delete cascade,
  client_id            uuid        references clients(id) on delete set null,
  staff_profile_id     uuid        references staff_profiles(id) on delete set null,

  wellbeing_notes      text,
  care_tasks_completed jsonb       not null default '[]',
  medication_prompted  boolean     not null default false,
  medication_notes     text,
  food_fluid_notes     text,
  incident_reported    boolean     not null default false,
  incident_notes       text,
  missed_tasks         text,
  general_notes        text,
  client_signature     text,
  staff_signature      text,

  status               text        not null default 'draft',
  submitted_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- One note per shift — enforced at application layer (duplicate returns 409).
create index if not exists visit_notes_shift_id_idx         on visit_notes (shift_id);
create index if not exists visit_notes_client_id_idx        on visit_notes (client_id);
create index if not exists visit_notes_staff_profile_id_idx on visit_notes (staff_profile_id);
create index if not exists visit_notes_status_idx           on visit_notes (status);
