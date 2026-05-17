-- 047_tenant_administration.sql
-- Per-tenant branding and configuration tables for multi-tenant admin infrastructure.

-- ── Tenant branding ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_branding (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  logo_url      TEXT,
  accent_colour TEXT NOT NULL DEFAULT '#4f46e5',
  company_name  TEXT,                        -- override for display purposes
  email_from    TEXT,                        -- branded email sender
  login_tagline TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_branding_company ON tenant_branding(company_id);

-- ── Tenant configuration ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_config (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,

  -- Compliance
  compliance_dbs_expiry_days   INT  NOT NULL DEFAULT 1095,  -- 3 years
  compliance_rtw_expiry_days   INT  NOT NULL DEFAULT 730,   -- 2 years
  compliance_training_days     INT  NOT NULL DEFAULT 365,
  compliance_warning_days      INT  NOT NULL DEFAULT 30,    -- warn this many days before expiry
  compliance_critical_days     INT  NOT NULL DEFAULT 7,

  -- Escalation
  escalation_unresolved_hours  INT  NOT NULL DEFAULT 24,
  escalation_critical_hours    INT  NOT NULL DEFAULT 4,

  -- Assignment / blocking
  block_non_compliant_staff    BOOLEAN NOT NULL DEFAULT TRUE,
  block_expired_dbs            BOOLEAN NOT NULL DEFAULT TRUE,
  block_expired_rtw            BOOLEAN NOT NULL DEFAULT TRUE,

  -- Onboarding requirements
  require_dbs                  BOOLEAN NOT NULL DEFAULT TRUE,
  require_rtw                  BOOLEAN NOT NULL DEFAULT TRUE,
  require_references           BOOLEAN NOT NULL DEFAULT TRUE,
  require_id_verification      BOOLEAN NOT NULL DEFAULT TRUE,
  require_contract_signature   BOOLEAN NOT NULL DEFAULT TRUE,

  -- Shift/overtime rules
  max_weekly_hours             INT  NOT NULL DEFAULT 48,
  overtime_threshold_hours     INT  NOT NULL DEFAULT 40,
  shift_gap_minimum_hours      INT  NOT NULL DEFAULT 11,

  -- Notification preferences
  notify_expiry_email          BOOLEAN NOT NULL DEFAULT TRUE,
  notify_expiry_in_app         BOOLEAN NOT NULL DEFAULT TRUE,
  notify_safeguarding_email    BOOLEAN NOT NULL DEFAULT TRUE,
  notify_onboarding_stale      BOOLEAN NOT NULL DEFAULT TRUE,

  -- Override permissions
  allow_compliance_override    BOOLEAN NOT NULL DEFAULT FALSE,
  allow_shift_override         BOOLEAN NOT NULL DEFAULT FALSE,

  -- Timezone
  timezone                     TEXT NOT NULL DEFAULT 'Europe/London',

  -- Onboarding status
  is_active                    BOOLEAN NOT NULL DEFAULT TRUE,
  is_pilot                     BOOLEAN NOT NULL DEFAULT FALSE,
  go_live_date                 DATE,
  setup_completed_at           TIMESTAMPTZ,
  setup_step                   INT  NOT NULL DEFAULT 0,    -- 0–7 wizard progress

  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_config_company ON tenant_config(company_id);

-- ── RLS (super_admin accesses via service role; no per-tenant RLS needed) ─────
ALTER TABLE tenant_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_config   ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; deny direct anon/authenticated access.
CREATE POLICY "service_role_only_branding" ON tenant_branding
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_only_config" ON tenant_config
  USING (auth.role() = 'service_role');
