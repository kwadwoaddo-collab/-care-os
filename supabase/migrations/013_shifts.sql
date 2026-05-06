CREATE TABLE IF NOT EXISTS shifts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID        NOT NULL,
  assigned_staff_id UUID        REFERENCES staff_profiles(id) ON DELETE SET NULL,
  created_by        TEXT,
  title             TEXT        NOT NULL,
  shift_date        DATE        NOT NULL,
  start_time        TIME        NOT NULL,
  end_time          TIME        NOT NULL,
  location          TEXT,
  client_name       TEXT,
  shift_type        TEXT        CHECK (shift_type IN ('day','night','sleep_in','live_in','emergency')),
  status            TEXT        NOT NULL DEFAULT 'scheduled'
                                CHECK (status IN ('scheduled','confirmed','completed','cancelled','no_show')),
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shifts_assigned_staff_id_idx ON shifts (assigned_staff_id);
CREATE INDEX IF NOT EXISTS shifts_shift_date_idx        ON shifts (shift_date);
CREATE INDEX IF NOT EXISTS shifts_status_idx            ON shifts (status);
