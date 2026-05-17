-- ============================================================
-- 048 — Operational Communications Infrastructure
--
-- Centralised messaging layer for operational broadcasts,
-- compliance reminders, and staff communications.
-- Sits above in_app_notifications and notification_logs
-- to add: governance, delivery tracking, templates,
-- conversation threads, and spam suppression.
-- ============================================================

-- ── Message type enum values (stored as TEXT for flexibility) ────────────────
-- Types: announcement | compliance_reminder | staffing_alert |
--        onboarding_reminder | safeguarding_escalation |
--        shift_communication | broadcast | thread_reply

-- ── Core message table ────────────────────────────────────────────────────────
CREATE TABLE operational_messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Authorship
  sender_id       UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  sender_name     TEXT        NOT NULL DEFAULT 'System',

  -- Content
  subject         TEXT        NOT NULL,
  body            TEXT        NOT NULL,

  -- Classification
  message_type    TEXT        NOT NULL DEFAULT 'announcement'
    CHECK (message_type IN (
      'announcement', 'compliance_reminder', 'staffing_alert',
      'onboarding_reminder', 'safeguarding_escalation',
      'shift_communication', 'broadcast', 'thread_reply'
    )),
  priority        TEXT        NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal', 'urgent', 'critical')),

  -- Channel
  channel         TEXT        NOT NULL DEFAULT 'in_app'
    CHECK (channel IN ('in_app', 'email', 'multi')),

  -- Audience
  audience_type   TEXT        NOT NULL DEFAULT 'individual'
    CHECK (audience_type IN (
      'all_staff', 'by_role', 'by_compliance_state',
      'by_shift_group', 'by_onboarding_stage', 'individual'
    )),
  audience_filter JSONB       DEFAULT '{}'::jsonb,

  -- Thread support (NULL = root message, set = reply)
  thread_id       UUID        REFERENCES operational_messages(id) ON DELETE CASCADE,
  parent_id       UUID        REFERENCES operational_messages(id) ON DELETE SET NULL,

  -- Template link
  template_id     UUID,

  -- Linked entity
  entity_type     TEXT,
  entity_id       UUID,
  entity_url      TEXT,

  -- Automation
  auto_generated  BOOLEAN     NOT NULL DEFAULT FALSE,
  trigger_type    TEXT,

  -- Status
  status          TEXT        NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sending', 'sent', 'scheduled', 'failed')),
  scheduled_at    TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  recipient_count INT         NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_op_msg_company      ON operational_messages(company_id, created_at DESC);
CREATE INDEX idx_op_msg_type         ON operational_messages(company_id, message_type);
CREATE INDEX idx_op_msg_thread       ON operational_messages(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX idx_op_msg_status       ON operational_messages(company_id, status);
CREATE INDEX idx_op_msg_auto         ON operational_messages(company_id, auto_generated);

-- ── Per-recipient delivery tracking ──────────────────────────────────────────
CREATE TABLE message_recipients (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id        UUID        NOT NULL REFERENCES operational_messages(id) ON DELETE CASCADE,
  company_id        UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Who (one of these must be set)
  staff_profile_id  UUID        REFERENCES staff_profiles(id) ON DELETE CASCADE,
  profile_id        UUID        REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_name    TEXT,
  recipient_email   TEXT,

  -- Delivery
  delivery_channel  TEXT        NOT NULL DEFAULT 'in_app'
    CHECK (delivery_channel IN ('in_app', 'email', 'sms')),
  status            TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'read', 'acknowledged')),

  -- Timestamps
  sent_at           TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  read_at           TIMESTAMPTZ,
  acknowledged_at   TIMESTAMPTZ,
  error_message     TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CHECK (staff_profile_id IS NOT NULL OR profile_id IS NOT NULL)
);

CREATE INDEX idx_msg_recip_message    ON message_recipients(message_id);
CREATE INDEX idx_msg_recip_staff      ON message_recipients(staff_profile_id) WHERE staff_profile_id IS NOT NULL;
CREATE INDEX idx_msg_recip_profile    ON message_recipients(profile_id) WHERE profile_id IS NOT NULL;
CREATE INDEX idx_msg_recip_status     ON message_recipients(message_id, status);
CREATE INDEX idx_msg_recip_company    ON message_recipients(company_id, created_at DESC);

-- ── Reusable message templates ────────────────────────────────────────────────
CREATE TABLE message_templates (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID        REFERENCES companies(id) ON DELETE CASCADE,  -- NULL = system template

  name            TEXT        NOT NULL,
  description     TEXT,
  message_type    TEXT        NOT NULL DEFAULT 'announcement'
    CHECK (message_type IN (
      'announcement', 'compliance_reminder', 'staffing_alert',
      'onboarding_reminder', 'safeguarding_escalation',
      'shift_communication', 'broadcast'
    )),
  subject         TEXT        NOT NULL,
  body            TEXT        NOT NULL,
  priority        TEXT        NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal', 'urgent', 'critical')),
  channel         TEXT        NOT NULL DEFAULT 'in_app'
    CHECK (channel IN ('in_app', 'email', 'multi')),

  is_system       BOOLEAN     NOT NULL DEFAULT FALSE,
  use_count       INT         NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_msg_template_company ON message_templates(company_id);
CREATE INDEX idx_msg_template_type    ON message_templates(message_type);
CREATE INDEX idx_msg_template_system  ON message_templates(is_system) WHERE is_system = TRUE;

-- ── Spam / duplicate suppression ─────────────────────────────────────────────
CREATE TABLE message_suppression (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Composite key: e.g. 'compliance_expiry:staff_uuid:dbs'
  suppression_key   TEXT        NOT NULL,
  suppressed_until  TIMESTAMPTZ NOT NULL,
  message_id        UUID        REFERENCES operational_messages(id) ON DELETE SET NULL,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(company_id, suppression_key)
);

CREATE INDEX idx_msg_suppress_company ON message_suppression(company_id);
CREATE INDEX idx_msg_suppress_key     ON message_suppression(company_id, suppression_key);

-- ── Seed system templates ─────────────────────────────────────────────────────
INSERT INTO message_templates (id, name, description, message_type, subject, body, priority, channel, is_system) VALUES
  (gen_random_uuid(), 'DBS Expiry Reminder',          'Sent to staff when DBS is expiring within 30 days',
   'compliance_reminder', 'Action required: Your DBS certificate is expiring soon',
   'Hi {{first_name}},\n\nYour DBS certificate is due to expire on {{expiry_date}}. Please arrange renewal as soon as possible to ensure you remain compliant and can continue working.\n\nIf you have already renewed, please upload your new certificate through your worker portal.\n\nThank you,\n{{company_name}} Team',
   'urgent', 'multi', TRUE),

  (gen_random_uuid(), 'Right to Work Expiry',         'Sent to staff when Right to Work document is expiring',
   'compliance_reminder', 'Action required: Your Right to Work document is expiring',
   'Hi {{first_name}},\n\nYour Right to Work document expires on {{expiry_date}}. This is a legal requirement and we will be unable to schedule you for shifts after this date unless it is renewed.\n\nPlease upload an updated document through your worker portal or contact HR immediately.\n\nThank you,\n{{company_name}} Team',
   'critical', 'multi', TRUE),

  (gen_random_uuid(), 'Missing Documents Reminder',   'Sent to staff with incomplete document submissions',
   'onboarding_reminder', 'Your staff file is incomplete — action required',
   'Hi {{first_name}},\n\nWe noticed that your staff file is missing some required documents. Please log into your worker portal to see what is outstanding and upload the required items.\n\nOutstanding items may prevent you from being scheduled for shifts.\n\nIf you need help, please contact your coordinator.\n\nThank you,\n{{company_name}} Team',
   'urgent', 'multi', TRUE),

  (gen_random_uuid(), 'Onboarding Incomplete',        'Sent to staff who have not completed onboarding steps',
   'onboarding_reminder', 'Complete your onboarding — important steps outstanding',
   'Hi {{first_name}},\n\nYou have outstanding onboarding tasks to complete before you can begin work. Please log into your worker portal to review and complete them.\n\nIf you have any questions, your coordinator is happy to help.\n\nThank you,\n{{company_name}} Team',
   'urgent', 'in_app', TRUE),

  (gen_random_uuid(), 'Uncovered Shift Alert',        'Sent to coordinators when a shift has no assigned staff',
   'staffing_alert', 'Uncovered shift requires attention',
   'A shift scheduled for {{shift_date}} at {{shift_time}} for {{client_name}} currently has no assigned staff member.\n\nPlease review and assign a suitable worker as soon as possible.\n\nView shift: {{shift_url}}',
   'urgent', 'in_app', TRUE),

  (gen_random_uuid(), 'Shift Reminder',               'Sent to workers the day before or morning of their shift',
   'shift_communication', 'Reminder: You have a shift tomorrow',
   'Hi {{first_name}},\n\nThis is a reminder that you have a shift scheduled for {{shift_date}} from {{start_time}} to {{end_time}}.\n\nClient: {{client_name}}\nLocation: {{location}}\n\nPlease confirm your attendance through your worker portal if you have not already done so.\n\nThank you,\n{{company_name}} Team',
   'normal', 'multi', TRUE),

  (gen_random_uuid(), 'Safeguarding Escalation',      'Sent to registered managers for safeguarding concerns',
   'safeguarding_escalation', 'URGENT: Safeguarding concern requires immediate attention',
   'A safeguarding concern has been raised that requires your immediate attention.\n\nIncident: {{incident_title}}\nSeverity: {{severity}}\nDate: {{incident_date}}\n\nPlease review and take appropriate action immediately.\n\nView incident: {{incident_url}}',
   'critical', 'multi', TRUE),

  (gen_random_uuid(), 'Compliance Override Notice',   'Sent when a compliance override has been applied',
   'announcement', 'Compliance override applied — review required',
   'Hi {{recipient_name}},\n\nA compliance override has been applied for {{staff_name}} by {{approver_name}}.\n\nOverride reason: {{reason}}\nValid until: {{override_expiry}}\n\nThis action has been recorded in the audit log.\n\nIf you have concerns, please contact your registered manager.',
   'urgent', 'in_app', TRUE),

  (gen_random_uuid(), 'Welcome to Onboarding',        'Sent to new staff when their onboarding begins',
   'onboarding_reminder', 'Welcome! Your onboarding has started',
   'Hi {{first_name}},\n\nWelcome to {{company_name}}! We are delighted to have you join our team.\n\nYour onboarding has been set up and you can now log into your worker portal to get started. You will find all the forms, documents, and steps you need to complete before your start date.\n\nIf you have any questions, please do not hesitate to reach out to your coordinator.\n\nWe look forward to working with you!\n\n{{company_name}} Team',
   'normal', 'multi', TRUE)
ON CONFLICT DO NOTHING;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE operational_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_recipients   ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_suppression  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_operational_messages" ON operational_messages FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_message_recipients"   ON message_recipients   FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_message_templates"    ON message_templates    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_message_suppression"  ON message_suppression  FOR ALL USING (auth.role() = 'service_role');
