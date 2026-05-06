ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS care_package_id UUID REFERENCES care_packages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS shifts_care_package_id_idx ON shifts (care_package_id);
