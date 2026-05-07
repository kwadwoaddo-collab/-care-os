-- 024_shift_worker_acknowledgement.sql
--
-- Adds worker acknowledgement fields to the shifts table.
-- Workers can accept, decline, or report running late via the portal.

ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS worker_ack_status TEXT
    CHECK (worker_ack_status IN ('accepted', 'declined', 'running_late')),
  ADD COLUMN IF NOT EXISTS worker_ack_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS worker_ack_reason TEXT;

-- Index for admin views filtering by ack status
CREATE INDEX IF NOT EXISTS idx_shifts_worker_ack_status
  ON shifts (worker_ack_status)
  WHERE worker_ack_status IS NOT NULL;
