-- 032_portal_invite_tracking.sql

ALTER TABLE staff_profiles
  ADD COLUMN IF NOT EXISTS portal_invite_sent_at TIMESTAMPTZ;
