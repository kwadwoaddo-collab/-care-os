-- ============================================================
-- ENABLE RLS ON REMAINING TENANT TABLES
--
-- 22 tables created since the original 002_rls_policies.sql sweep
-- never had RLS enabled. The database was never the isolation
-- backstop for them — every route uses the service-role client
-- (lib/supabase/admin.ts), which bypasses RLS by design — but one
-- forgotten filter or a future anon/authenticated-client read would
-- leak data across tenants. For CQC/safeguarding data this gap must
-- be closed.
--
-- Safe to enable now: confirmed via grep that no route reads any of
-- these 22 tables through the anon/browser client (lib/supabase/
-- browser.ts, client.ts) or the cookie-authenticated server client
-- (lib/supabase/server.ts) — the only non-admin-client usage found
-- touches `profiles`, `staff_profiles`, or `documents`, which already
-- had RLS enabled since 002/047/etc.
--
-- Pattern matches 047_tenant_administration.sql exactly: enable RLS,
-- then a single service-role-only policy per table (defaults to ALL
-- commands; no FOR/WITH CHECK needed since only the service-role
-- client is ever granted through). Scoped, per-role policies for
-- genuine staff/worker self-service reads can be added later, once
-- actually needed.
-- ============================================================

ALTER TABLE staff_availability              ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts                          ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_packages                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_package_visits             ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_notes                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations_queue                ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_offers                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_document_folders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_routing_log            ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_audit_log              ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_document_versions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_resubmission_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_expiry_reminders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_readiness_snapshots      ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_lifecycle_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE handover_notes                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pre_employment_checks           ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; deny direct anon/authenticated access.
CREATE POLICY "service_role_only_staff_availability"               ON staff_availability               USING (auth.role() = 'service_role');
CREATE POLICY "service_role_only_clients"                          ON clients                          USING (auth.role() = 'service_role');
CREATE POLICY "service_role_only_timesheets"                       ON timesheets                       USING (auth.role() = 'service_role');
CREATE POLICY "service_role_only_shifts"                           ON shifts                           USING (auth.role() = 'service_role');
CREATE POLICY "service_role_only_care_packages"                    ON care_packages                    USING (auth.role() = 'service_role');
CREATE POLICY "service_role_only_care_package_visits"              ON care_package_visits              USING (auth.role() = 'service_role');
CREATE POLICY "service_role_only_visit_notes"                      ON visit_notes                      USING (auth.role() = 'service_role');
CREATE POLICY "service_role_only_incidents"                        ON incidents                        USING (auth.role() = 'service_role');
CREATE POLICY "service_role_only_company_notification_preferences" ON company_notification_preferences USING (auth.role() = 'service_role');
CREATE POLICY "service_role_only_notification_logs"                ON notification_logs                USING (auth.role() = 'service_role');
CREATE POLICY "service_role_only_operations_queue"                 ON operations_queue                 USING (auth.role() = 'service_role');
CREATE POLICY "service_role_only_shift_offers"                     ON shift_offers                     USING (auth.role() = 'service_role');
CREATE POLICY "service_role_only_staff_document_folders"           ON staff_document_folders           USING (auth.role() = 'service_role');
CREATE POLICY "service_role_only_document_routing_log"             ON document_routing_log             USING (auth.role() = 'service_role');
CREATE POLICY "service_role_only_document_audit_log"               ON document_audit_log               USING (auth.role() = 'service_role');
CREATE POLICY "service_role_only_staff_document_versions"          ON staff_document_versions          USING (auth.role() = 'service_role');
CREATE POLICY "service_role_only_document_resubmission_requests"   ON document_resubmission_requests   USING (auth.role() = 'service_role');
CREATE POLICY "service_role_only_document_expiry_reminders"        ON document_expiry_reminders        USING (auth.role() = 'service_role');
CREATE POLICY "service_role_only_worker_readiness_snapshots"       ON worker_readiness_snapshots       USING (auth.role() = 'service_role');
CREATE POLICY "service_role_only_onboarding_lifecycle_log"         ON onboarding_lifecycle_log         USING (auth.role() = 'service_role');
CREATE POLICY "service_role_only_handover_notes"                   ON handover_notes                   USING (auth.role() = 'service_role');
CREATE POLICY "service_role_only_pre_employment_checks"            ON pre_employment_checks            USING (auth.role() = 'service_role');
