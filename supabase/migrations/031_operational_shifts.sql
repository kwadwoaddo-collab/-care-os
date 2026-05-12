-- 031_operational_shifts.sql

-- 1. Modify shifts.status
-- We need to drop the existing check constraint on the status column.
ALTER TABLE shifts DROP CONSTRAINT IF EXISTS shifts_status_check;

-- If any old rows have 'scheduled', map them to 'open' or 'accepted'
UPDATE shifts SET status = 'accepted' WHERE status IN ('scheduled', 'confirmed') AND assigned_staff_id IS NOT NULL;
UPDATE shifts SET status = 'open' WHERE status = 'scheduled' AND assigned_staff_id IS NULL;
UPDATE shifts SET status = 'missed' WHERE status = 'no_show';

ALTER TABLE shifts
  ADD CONSTRAINT shifts_status_check
  CHECK (status IN ('open', 'offered', 'accepted', 'declined', 'in_progress', 'completed', 'missed', 'cancelled'));

-- 2. Create shift_offers table
CREATE TABLE IF NOT EXISTS shift_offers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id         UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  staff_profile_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(shift_id, staff_profile_id)
);

CREATE INDEX IF NOT EXISTS shift_offers_shift_id_idx ON shift_offers(shift_id);
CREATE INDEX IF NOT EXISTS shift_offers_staff_id_idx ON shift_offers(staff_profile_id);
