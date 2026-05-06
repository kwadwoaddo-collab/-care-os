CREATE TABLE IF NOT EXISTS timesheets (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         UUID        NOT NULL,
  shift_id           UUID        REFERENCES shifts(id)         ON DELETE CASCADE,
  staff_profile_id   UUID        REFERENCES staff_profiles(id) ON DELETE CASCADE,
  scheduled_start    TIMESTAMPTZ,
  scheduled_end      TIMESTAMPTZ,
  clock_in           TIMESTAMPTZ,
  clock_out          TIMESTAMPTZ,
  break_minutes      INTEGER     NOT NULL DEFAULT 0,
  worked_minutes     INTEGER,
  status             TEXT        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending','clocked_in','completed','missed','adjusted')),
  lateness_minutes   INTEGER     NOT NULL DEFAULT 0,
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS timesheets_staff_profile_id_idx ON timesheets (staff_profile_id);
CREATE INDEX IF NOT EXISTS timesheets_shift_id_idx         ON timesheets (shift_id);
CREATE INDEX IF NOT EXISTS timesheets_status_idx           ON timesheets (status);
