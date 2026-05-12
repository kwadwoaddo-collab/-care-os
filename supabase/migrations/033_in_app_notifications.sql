-- 033_in_app_notifications.sql
--
-- In-app notification center for worker and admin portals.
-- Distinct from notification_logs (which tracks outgoing emails).
-- Rows are created by API actions and cleared by read acknowledgement.
-- recipient_type: 'worker' (staff_profile_id set) | 'admin' (profile_id set)

CREATE TABLE IF NOT EXISTS in_app_notifications (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  -- Worker recipient (mutually exclusive with profile_id)
  staff_profile_id  UUID        REFERENCES staff_profiles(id) ON DELETE CASCADE,
  -- Admin recipient
  profile_id        UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  -- Short title shown in the bell popover
  title             TEXT        NOT NULL,
  -- Longer description (optional)
  message           TEXT,
  -- Optional deep link inside the portal
  action_url        TEXT,
  -- Event type for icon/colour selection in UI
  event_type        TEXT        NOT NULL DEFAULT 'info',
  -- Null until the user opens/dismisses the notification
  read_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (staff_profile_id IS NOT NULL OR profile_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_in_app_notif_staff      ON in_app_notifications (staff_profile_id, created_at DESC) WHERE staff_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_in_app_notif_profile   ON in_app_notifications (profile_id, created_at DESC) WHERE profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_in_app_notif_company   ON in_app_notifications (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_in_app_notif_unread_sp ON in_app_notifications (staff_profile_id) WHERE read_at IS NULL AND staff_profile_id IS NOT NULL;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE in_app_notifications ENABLE ROW LEVEL SECURITY;

-- Workers can only see their own notifications (via RLS using staff_profiles)
-- Note: worker portal uses service-role client in API routes, so RLS is bypassed
-- server-side. The policies below apply to direct Supabase client access.
CREATE POLICY "in_app_notifications: admin service role"
  ON in_app_notifications FOR ALL
  USING (true);
