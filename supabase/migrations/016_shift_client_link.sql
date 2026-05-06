ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS shifts_client_id_idx ON shifts (client_id);
