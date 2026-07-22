-- ============================================================
-- RLS ROLE MODERNISATION
--
-- Every policy created in 002_rls_policies.sql (and the one
-- redefined in 003_security_and_schema_fixes.sql) gates admin
-- access on `get_my_role() = 'admin'`. That literal string check
-- predates the 6-role RBAC matrix added in 022/034 and does not
-- recognise super_admin, registered_manager, compliance_manager,
-- or coordinator — if this RLS backstop is ever the active gate
-- (all current app routes use the service-role client, which
-- bypasses RLS entirely), those roles would be locked out.
--
-- is_admin_role() below mirrors lib/rbac/roles.ts ADMIN_ROLES
-- exactly, plus the legacy 'admin' enum value (normaliseRole()
-- maps 'admin' -> company_admin at the application layer; the DB
-- enum still allows the literal value, so the SQL check must too).
--
-- This migration only replaces the role predicate. Every other
-- clause (company_id scoping, EXISTS subqueries, WITH CHECK) is
-- copied verbatim from the policy it replaces. 002/003 are never
-- edited — policies are dropped and recreated here instead.
-- ============================================================

CREATE OR REPLACE FUNCTION is_admin_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT get_my_role() IN (
    'super_admin', 'company_admin', 'registered_manager',
    'compliance_manager', 'coordinator',
    'admin'  -- legacy alias, normaliseRole() maps this to company_admin
  )
$$;


-- ============================================================
-- PROFILES
-- ============================================================

DROP POLICY IF EXISTS "profiles: admins read" ON profiles;
CREATE POLICY "profiles: admins read"
  ON profiles FOR SELECT
  USING (
    is_admin_role()
    AND company_id = get_my_company_id()
  );

-- Redefined in 003 with an added WITH CHECK — that (not the original
-- 002 version) is the live definition being replaced here.
DROP POLICY IF EXISTS "profiles: admins update company" ON profiles;
CREATE POLICY "profiles: admins update company"
  ON profiles FOR UPDATE
  USING (
    is_admin_role()
    AND company_id = get_my_company_id()
  )
  WITH CHECK (
    company_id = get_my_company_id()
  );


-- ============================================================
-- APPLICANTS
-- ============================================================

DROP POLICY IF EXISTS "applicants: admins read" ON applicants;
CREATE POLICY "applicants: admins read"
  ON applicants FOR SELECT
  USING (
    is_admin_role()
    AND company_id = get_my_company_id()
  );

DROP POLICY IF EXISTS "applicants: admins insert" ON applicants;
CREATE POLICY "applicants: admins insert"
  ON applicants FOR INSERT
  WITH CHECK (
    is_admin_role()
    AND company_id = get_my_company_id()
  );

DROP POLICY IF EXISTS "applicants: admins update" ON applicants;
CREATE POLICY "applicants: admins update"
  ON applicants FOR UPDATE
  USING (
    is_admin_role()
    AND company_id = get_my_company_id()
  );


-- ============================================================
-- STAFF PROFILES
-- ============================================================

DROP POLICY IF EXISTS "staff_profiles: admins read" ON staff_profiles;
CREATE POLICY "staff_profiles: admins read"
  ON staff_profiles FOR SELECT
  USING (
    is_admin_role()
    AND company_id = get_my_company_id()
  );

DROP POLICY IF EXISTS "staff_profiles: admins insert" ON staff_profiles;
CREATE POLICY "staff_profiles: admins insert"
  ON staff_profiles FOR INSERT
  WITH CHECK (
    is_admin_role()
    AND company_id = get_my_company_id()
  );

DROP POLICY IF EXISTS "staff_profiles: admins update" ON staff_profiles;
CREATE POLICY "staff_profiles: admins update"
  ON staff_profiles FOR UPDATE
  USING (
    is_admin_role()
    AND company_id = get_my_company_id()
  );


-- ============================================================
-- INTERVIEWS
-- ============================================================

DROP POLICY IF EXISTS "interviews: admins read" ON interviews;
CREATE POLICY "interviews: admins read"
  ON interviews FOR SELECT
  USING (
    is_admin_role()
    AND company_id = get_my_company_id()
  );

DROP POLICY IF EXISTS "interviews: admins insert" ON interviews;
CREATE POLICY "interviews: admins insert"
  ON interviews FOR INSERT
  WITH CHECK (
    is_admin_role()
    AND company_id = get_my_company_id()
  );

DROP POLICY IF EXISTS "interviews: admins update" ON interviews;
CREATE POLICY "interviews: admins update"
  ON interviews FOR UPDATE
  USING (
    is_admin_role()
    AND company_id = get_my_company_id()
  );


-- ============================================================
-- FORMS
-- ============================================================

DROP POLICY IF EXISTS "forms: admins read" ON forms;
CREATE POLICY "forms: admins read"
  ON forms FOR SELECT
  USING (
    is_admin_role()
    AND company_id = get_my_company_id()
  );

DROP POLICY IF EXISTS "forms: admins insert" ON forms;
CREATE POLICY "forms: admins insert"
  ON forms FOR INSERT
  WITH CHECK (
    is_admin_role()
    AND company_id = get_my_company_id()
  );

DROP POLICY IF EXISTS "forms: admins update" ON forms;
CREATE POLICY "forms: admins update"
  ON forms FOR UPDATE
  USING (
    is_admin_role()
    AND company_id = get_my_company_id()
  );


-- ============================================================
-- FORM FIELDS
-- ============================================================

DROP POLICY IF EXISTS "form_fields: admins read" ON form_fields;
CREATE POLICY "form_fields: admins read"
  ON form_fields FOR SELECT
  USING (
    is_admin_role()
    AND EXISTS (
      SELECT 1 FROM forms f
      WHERE f.id = form_fields.form_id
      AND f.company_id = get_my_company_id()
    )
  );

DROP POLICY IF EXISTS "form_fields: admins insert" ON form_fields;
CREATE POLICY "form_fields: admins insert"
  ON form_fields FOR INSERT
  WITH CHECK (
    is_admin_role()
    AND EXISTS (
      SELECT 1 FROM forms f
      WHERE f.id = form_fields.form_id
      AND f.company_id = get_my_company_id()
    )
  );

DROP POLICY IF EXISTS "form_fields: admins update" ON form_fields;
CREATE POLICY "form_fields: admins update"
  ON form_fields FOR UPDATE
  USING (
    is_admin_role()
    AND EXISTS (
      SELECT 1 FROM forms f
      WHERE f.id = form_fields.form_id
      AND f.company_id = get_my_company_id()
    )
  );


-- ============================================================
-- FORM RESPONSES
-- ============================================================

DROP POLICY IF EXISTS "form_responses: admins read" ON form_responses;
CREATE POLICY "form_responses: admins read"
  ON form_responses FOR SELECT
  USING (
    is_admin_role()
    AND company_id = get_my_company_id()
  );

DROP POLICY IF EXISTS "form_responses: admins insert" ON form_responses;
CREATE POLICY "form_responses: admins insert"
  ON form_responses FOR INSERT
  WITH CHECK (
    is_admin_role()
    AND company_id = get_my_company_id()
  );

DROP POLICY IF EXISTS "form_responses: admins update" ON form_responses;
CREATE POLICY "form_responses: admins update"
  ON form_responses FOR UPDATE
  USING (
    is_admin_role()
    AND company_id = get_my_company_id()
  );


-- ============================================================
-- FORM ANSWERS
-- ============================================================

DROP POLICY IF EXISTS "form_answers: admins read" ON form_answers;
CREATE POLICY "form_answers: admins read"
  ON form_answers FOR SELECT
  USING (
    is_admin_role()
    AND EXISTS (
      SELECT 1 FROM form_responses fr
      WHERE fr.id = form_answers.response_id
      AND fr.company_id = get_my_company_id()
    )
  );

DROP POLICY IF EXISTS "form_answers: admins insert" ON form_answers;
CREATE POLICY "form_answers: admins insert"
  ON form_answers FOR INSERT
  WITH CHECK (
    is_admin_role()
    AND EXISTS (
      SELECT 1 FROM form_responses fr
      WHERE fr.id = form_answers.response_id
      AND fr.company_id = get_my_company_id()
    )
  );

DROP POLICY IF EXISTS "form_answers: admins update" ON form_answers;
CREATE POLICY "form_answers: admins update"
  ON form_answers FOR UPDATE
  USING (
    is_admin_role()
    AND EXISTS (
      SELECT 1 FROM form_responses fr
      WHERE fr.id = form_answers.response_id
      AND fr.company_id = get_my_company_id()
    )
  );


-- ============================================================
-- COMPLIANCE ITEMS
-- ============================================================

DROP POLICY IF EXISTS "compliance_items: admins read" ON compliance_items;
CREATE POLICY "compliance_items: admins read"
  ON compliance_items FOR SELECT
  USING (
    is_admin_role()
    AND company_id = get_my_company_id()
  );

DROP POLICY IF EXISTS "compliance_items: admins insert" ON compliance_items;
CREATE POLICY "compliance_items: admins insert"
  ON compliance_items FOR INSERT
  WITH CHECK (
    is_admin_role()
    AND company_id = get_my_company_id()
  );

DROP POLICY IF EXISTS "compliance_items: admins update" ON compliance_items;
CREATE POLICY "compliance_items: admins update"
  ON compliance_items FOR UPDATE
  USING (
    is_admin_role()
    AND company_id = get_my_company_id()
  );


-- ============================================================
-- DOCUMENTS
-- ============================================================

DROP POLICY IF EXISTS "documents: admins read" ON documents;
CREATE POLICY "documents: admins read"
  ON documents FOR SELECT
  USING (
    is_admin_role()
    AND company_id = get_my_company_id()
  );

DROP POLICY IF EXISTS "documents: admins insert" ON documents;
CREATE POLICY "documents: admins insert"
  ON documents FOR INSERT
  WITH CHECK (
    is_admin_role()
    AND company_id = get_my_company_id()
  );

DROP POLICY IF EXISTS "documents: admins update" ON documents;
CREATE POLICY "documents: admins update"
  ON documents FOR UPDATE
  USING (
    is_admin_role()
    AND company_id = get_my_company_id()
  );


-- ============================================================
-- AUDIT LOGS
-- ============================================================

DROP POLICY IF EXISTS "audit_logs: admins read" ON audit_logs;
CREATE POLICY "audit_logs: admins read"
  ON audit_logs FOR SELECT
  USING (
    is_admin_role()
    AND company_id = get_my_company_id()
  );
