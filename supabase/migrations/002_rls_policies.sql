-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE companies        ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE applicants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews       ENABLE ROW LEVEL SECURITY;
ALTER TABLE forms            ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_fields      ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_responses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_answers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs       ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- HELPER FUNCTIONS
--
-- SECURITY DEFINER lets these read `profiles` without
-- triggering RLS recursion on the profiles table itself.
-- STABLE tells the planner the result is constant within
-- a single query, so it is evaluated once and reused.
-- ============================================================

CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT company_id FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;


-- ============================================================
-- COMPANIES
-- ============================================================

CREATE POLICY "companies: members read own company"
  ON companies FOR SELECT
  USING (id = get_my_company_id());


-- ============================================================
-- PROFILES
-- ============================================================

-- Required so a newly authenticated user can create their profile
CREATE POLICY "profiles: authenticated users insert own"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles: admins read company"
  ON profiles FOR SELECT
  USING (
    get_my_role() = 'admin'
    AND company_id = get_my_company_id()
  );

CREATE POLICY "profiles: admins update company"
  ON profiles FOR UPDATE
  USING (
    get_my_role() = 'admin'
    AND company_id = get_my_company_id()
  );

CREATE POLICY "profiles: staff read own"
  ON profiles FOR SELECT
  USING (
    get_my_role() = 'staff'
    AND id = auth.uid()
  );

CREATE POLICY "profiles: staff update own"
  ON profiles FOR UPDATE
  USING (
    get_my_role() = 'staff'
    AND id = auth.uid()
  );


-- ============================================================
-- APPLICANTS
-- No applicant client-side access.
-- All applicant reads/writes go through server routes using
-- the service role key, which bypasses RLS entirely.
-- ============================================================

CREATE POLICY "applicants: admins read"
  ON applicants FOR SELECT
  USING (
    get_my_role() = 'admin'
    AND company_id = get_my_company_id()
  );

CREATE POLICY "applicants: admins insert"
  ON applicants FOR INSERT
  WITH CHECK (
    get_my_role() = 'admin'
    AND company_id = get_my_company_id()
  );

CREATE POLICY "applicants: admins update"
  ON applicants FOR UPDATE
  USING (
    get_my_role() = 'admin'
    AND company_id = get_my_company_id()
  );


-- ============================================================
-- STAFF PROFILES
-- ============================================================

CREATE POLICY "staff_profiles: admins read"
  ON staff_profiles FOR SELECT
  USING (
    get_my_role() = 'admin'
    AND company_id = get_my_company_id()
  );

CREATE POLICY "staff_profiles: admins insert"
  ON staff_profiles FOR INSERT
  WITH CHECK (
    get_my_role() = 'admin'
    AND company_id = get_my_company_id()
  );

CREATE POLICY "staff_profiles: admins update"
  ON staff_profiles FOR UPDATE
  USING (
    get_my_role() = 'admin'
    AND company_id = get_my_company_id()
  );

-- Staff can read their own record only
CREATE POLICY "staff_profiles: staff read own"
  ON staff_profiles FOR SELECT
  USING (
    get_my_role() = 'staff'
    AND profile_id = auth.uid()
  );


-- ============================================================
-- INTERVIEWS
-- Admin-managed only. Staff have no access.
-- ============================================================

CREATE POLICY "interviews: admins read"
  ON interviews FOR SELECT
  USING (
    get_my_role() = 'admin'
    AND company_id = get_my_company_id()
  );

CREATE POLICY "interviews: admins insert"
  ON interviews FOR INSERT
  WITH CHECK (
    get_my_role() = 'admin'
    AND company_id = get_my_company_id()
  );

CREATE POLICY "interviews: admins update"
  ON interviews FOR UPDATE
  USING (
    get_my_role() = 'admin'
    AND company_id = get_my_company_id()
  );


-- ============================================================
-- FORMS
-- ============================================================

CREATE POLICY "forms: admins read"
  ON forms FOR SELECT
  USING (
    get_my_role() = 'admin'
    AND company_id = get_my_company_id()
  );

CREATE POLICY "forms: admins insert"
  ON forms FOR INSERT
  WITH CHECK (
    get_my_role() = 'admin'
    AND company_id = get_my_company_id()
  );

CREATE POLICY "forms: admins update"
  ON forms FOR UPDATE
  USING (
    get_my_role() = 'admin'
    AND company_id = get_my_company_id()
  );

-- Staff can read forms in order to render them
CREATE POLICY "forms: staff read"
  ON forms FOR SELECT
  USING (
    get_my_role() = 'staff'
    AND company_id = get_my_company_id()
  );


-- ============================================================
-- FORM FIELDS
-- form_fields has no company_id — enforced via parent forms row
-- ============================================================

CREATE POLICY "form_fields: admins read"
  ON form_fields FOR SELECT
  USING (
    get_my_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM forms f
      WHERE f.id = form_fields.form_id
      AND f.company_id = get_my_company_id()
    )
  );

CREATE POLICY "form_fields: admins insert"
  ON form_fields FOR INSERT
  WITH CHECK (
    get_my_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM forms f
      WHERE f.id = form_fields.form_id
      AND f.company_id = get_my_company_id()
    )
  );

CREATE POLICY "form_fields: admins update"
  ON form_fields FOR UPDATE
  USING (
    get_my_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM forms f
      WHERE f.id = form_fields.form_id
      AND f.company_id = get_my_company_id()
    )
  );

-- Staff can read fields in order to render forms
CREATE POLICY "form_fields: staff read"
  ON form_fields FOR SELECT
  USING (
    get_my_role() = 'staff'
    AND EXISTS (
      SELECT 1 FROM forms f
      WHERE f.id = form_fields.form_id
      AND f.company_id = get_my_company_id()
    )
  );


-- ============================================================
-- FORM RESPONSES
-- ============================================================

CREATE POLICY "form_responses: admins read"
  ON form_responses FOR SELECT
  USING (
    get_my_role() = 'admin'
    AND company_id = get_my_company_id()
  );

CREATE POLICY "form_responses: admins insert"
  ON form_responses FOR INSERT
  WITH CHECK (
    get_my_role() = 'admin'
    AND company_id = get_my_company_id()
  );

CREATE POLICY "form_responses: admins update"
  ON form_responses FOR UPDATE
  USING (
    get_my_role() = 'admin'
    AND company_id = get_my_company_id()
  );

-- Staff can read their own responses
CREATE POLICY "form_responses: staff read own"
  ON form_responses FOR SELECT
  USING (
    get_my_role() = 'staff'
    AND profile_id = auth.uid()
  );

-- Staff can create their own responses
CREATE POLICY "form_responses: staff insert own"
  ON form_responses FOR INSERT
  WITH CHECK (
    get_my_role() = 'staff'
    AND profile_id = auth.uid()
    AND company_id = get_my_company_id()
  );

-- Staff can only update their own responses while unsubmitted
CREATE POLICY "form_responses: staff update own unsubmitted"
  ON form_responses FOR UPDATE
  USING (
    get_my_role() = 'staff'
    AND profile_id = auth.uid()
    AND submitted_at IS NULL
  );


-- ============================================================
-- FORM ANSWERS
-- form_answers has no company_id — enforced via parent form_responses row
-- ============================================================

CREATE POLICY "form_answers: admins read"
  ON form_answers FOR SELECT
  USING (
    get_my_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM form_responses fr
      WHERE fr.id = form_answers.response_id
      AND fr.company_id = get_my_company_id()
    )
  );

CREATE POLICY "form_answers: admins insert"
  ON form_answers FOR INSERT
  WITH CHECK (
    get_my_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM form_responses fr
      WHERE fr.id = form_answers.response_id
      AND fr.company_id = get_my_company_id()
    )
  );

CREATE POLICY "form_answers: admins update"
  ON form_answers FOR UPDATE
  USING (
    get_my_role() = 'admin'
    AND EXISTS (
      SELECT 1 FROM form_responses fr
      WHERE fr.id = form_answers.response_id
      AND fr.company_id = get_my_company_id()
    )
  );

-- Staff can read their own answers
CREATE POLICY "form_answers: staff read own"
  ON form_answers FOR SELECT
  USING (
    get_my_role() = 'staff'
    AND EXISTS (
      SELECT 1 FROM form_responses fr
      WHERE fr.id = form_answers.response_id
      AND fr.profile_id = auth.uid()
    )
  );

-- Staff can insert their own answers
CREATE POLICY "form_answers: staff insert own"
  ON form_answers FOR INSERT
  WITH CHECK (
    get_my_role() = 'staff'
    AND EXISTS (
      SELECT 1 FROM form_responses fr
      WHERE fr.id = form_answers.response_id
      AND fr.profile_id = auth.uid()
    )
  );

-- Staff can update their own answers only while the response is unsubmitted
CREATE POLICY "form_answers: staff update own unsubmitted"
  ON form_answers FOR UPDATE
  USING (
    get_my_role() = 'staff'
    AND EXISTS (
      SELECT 1 FROM form_responses fr
      WHERE fr.id = form_answers.response_id
      AND fr.profile_id = auth.uid()
      AND fr.submitted_at IS NULL
    )
  );


-- ============================================================
-- COMPLIANCE ITEMS
-- Staff can read their own items but have no UPDATE policy —
-- they cannot change status, notes, or expiry dates.
-- ============================================================

CREATE POLICY "compliance_items: admins read"
  ON compliance_items FOR SELECT
  USING (
    get_my_role() = 'admin'
    AND company_id = get_my_company_id()
  );

CREATE POLICY "compliance_items: admins insert"
  ON compliance_items FOR INSERT
  WITH CHECK (
    get_my_role() = 'admin'
    AND company_id = get_my_company_id()
  );

CREATE POLICY "compliance_items: admins update"
  ON compliance_items FOR UPDATE
  USING (
    get_my_role() = 'admin'
    AND company_id = get_my_company_id()
  );

-- Staff can read their own compliance items via staff_profiles
-- No UPDATE policy for staff — status is admin-controlled only
CREATE POLICY "compliance_items: staff read own"
  ON compliance_items FOR SELECT
  USING (
    get_my_role() = 'staff'
    AND EXISTS (
      SELECT 1 FROM staff_profiles sp
      WHERE sp.id = compliance_items.staff_profile_id
      AND sp.profile_id = auth.uid()
    )
  );


-- ============================================================
-- DOCUMENTS
-- ============================================================

CREATE POLICY "documents: admins read"
  ON documents FOR SELECT
  USING (
    get_my_role() = 'admin'
    AND company_id = get_my_company_id()
  );

CREATE POLICY "documents: admins insert"
  ON documents FOR INSERT
  WITH CHECK (
    get_my_role() = 'admin'
    AND company_id = get_my_company_id()
  );

CREATE POLICY "documents: admins update"
  ON documents FOR UPDATE
  USING (
    get_my_role() = 'admin'
    AND company_id = get_my_company_id()
  );

-- Staff can read their own documents
CREATE POLICY "documents: staff read own"
  ON documents FOR SELECT
  USING (
    get_my_role() = 'staff'
    AND profile_id = auth.uid()
  );

-- Staff can upload their own documents
CREATE POLICY "documents: staff insert own"
  ON documents FOR INSERT
  WITH CHECK (
    get_my_role() = 'staff'
    AND profile_id = auth.uid()
    AND company_id = get_my_company_id()
  );


-- ============================================================
-- AUDIT LOGS
-- Read-only for admins. No client-side inserts.
-- Written exclusively server-side via the service role key.
-- ============================================================

CREATE POLICY "audit_logs: admins read"
  ON audit_logs FOR SELECT
  USING (
    get_my_role() = 'admin'
    AND company_id = get_my_company_id()
  );
