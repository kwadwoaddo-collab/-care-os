CREATE TABLE IF NOT EXISTS care_packages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID        NOT NULL,
  client_id    UUID        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  description  TEXT,
  start_date   DATE        NOT NULL,
  end_date     DATE,
  status       TEXT        NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active','paused','ended','draft')),
  funding_type TEXT,
  weekly_hours NUMERIC,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS care_package_visits (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  care_package_id    UUID        NOT NULL REFERENCES care_packages(id) ON DELETE CASCADE,
  day_of_week        INTEGER     NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time         TIME        NOT NULL,
  end_time           TIME        NOT NULL,
  shift_type         TEXT,
  preferred_gender   TEXT,
  requires_driver    BOOLEAN     DEFAULT false,
  requires_double_up BOOLEAN     DEFAULT false,
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS care_packages_client_id_idx           ON care_packages (client_id);
CREATE INDEX IF NOT EXISTS care_packages_status_idx              ON care_packages (status);
CREATE INDEX IF NOT EXISTS care_package_visits_package_id_idx    ON care_package_visits (care_package_id);
CREATE INDEX IF NOT EXISTS care_package_visits_day_of_week_idx   ON care_package_visits (day_of_week);
