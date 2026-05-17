-- supabase/migrations/043_compliance_overrides.sql
--
-- Compliance override system.
--
-- Allows privileged users (registered_manager, company_admin, super_admin)
-- to temporarily bypass a compliance block for a specific staff member.
--
-- An override:
--   - requires a written reason (for audit trail)
--   - has an explicit expiry date (max 30 days)
--   - is logged to audit_logs on creation and revocation
--   - is checked by the shift assignment route before blocking
--
-- Design: overrides are additive — an override does not modify the staff
-- member's compliance score or state. It only instructs the shift assignment
-- gate to allow the booking despite the compliance block, and surfaces a
-- warning to the assigning coordinator.

CREATE TABLE IF NOT EXISTS compliance_overrides (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  staff_profile_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,

  -- Who granted the override and why
  overridden_by    UUID NOT NULL REFERENCES profiles(id),
  reason           TEXT NOT NULL CHECK (char_length(reason) >= 10),

  -- Time bounds
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ NOT NULL,

  -- Revocation (admin can cancel an override early)
  revoked_at       TIMESTAMPTZ NULL,
  revoked_by       UUID        NULL REFERENCES profiles(id),
  revoke_reason    TEXT        NULL,

  -- Optional: scope the override to specific items (NULL = all items)
  scoped_items     TEXT[]      NULL,

  CONSTRAINT expires_after_created CHECK (expires_at > created_at),
  CONSTRAINT expires_within_30_days CHECK (expires_at <= created_at + INTERVAL '30 days')
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Fast lookup for active overrides during shift assignment
CREATE INDEX IF NOT EXISTS idx_compliance_overrides_active
  ON compliance_overrides (staff_profile_id, company_id, expires_at)
  WHERE revoked_at IS NULL;

-- Admin audit view: all overrides per company
CREATE INDEX IF NOT EXISTS idx_compliance_overrides_company
  ON compliance_overrides (company_id, created_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Row-level security mirrors existing patterns: service role bypasses RLS.
-- All application access goes through the adminClient (service role key).

ALTER TABLE compliance_overrides ENABLE ROW LEVEL SECURITY;

-- No direct anon/user access — all reads and writes via service role only.
CREATE POLICY "compliance_overrides_deny_all"
  ON compliance_overrides
  FOR ALL
  TO anon, authenticated
  USING (false);
