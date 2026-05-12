-- 035_admin_access_tracking.sql
--
-- Tracks admin portal access provisioning state on staff_profiles.
-- Separate from worker portal invite tracking (032_portal_invite_tracking.sql).
--
-- admin_invite_sent_at — when the admin portal access invite was last sent
-- admin_invite_email   — email address used for the admin account invite
--                        (may differ from staff_profiles.email if corrected)

ALTER TABLE staff_profiles
  ADD COLUMN IF NOT EXISTS admin_invite_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_invite_email    TEXT;

COMMENT ON COLUMN staff_profiles.admin_invite_sent_at IS
  'Timestamp when an admin portal access invite was last sent via supabase auth.admin.inviteUserByEmail(). '
  'Distinct from portal_invite_sent_at which tracks worker portal token invites.';

COMMENT ON COLUMN staff_profiles.admin_invite_email IS
  'Email used for the admin portal account invite. '
  'Stored separately so it is auditable even after the invite is accepted.';
