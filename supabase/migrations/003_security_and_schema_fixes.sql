-- ============================================================
-- FIX 1: Drop unsafe profiles INSERT policy
-- Profile creation must go through server-side routes using the
-- service role key. The open INSERT policy allowed any
-- authenticated user to self-insert with an arbitrary company_id.
-- ============================================================

DROP POLICY IF EXISTS "profiles: authenticated users insert own" ON profiles;


-- ============================================================
-- FIX 2: Staff profile UPDATE — prevent role escalation
-- Without explicit WITH CHECK, PostgreSQL re-uses the USING
-- expression against the new row. get_my_role() reads the OLD
-- value before commit, so staff could promote themselves to admin.
-- Pinning role = 'staff' directly checks the new row's value.
-- ============================================================

DROP POLICY IF EXISTS "profiles: staff update own" ON profiles;

CREATE POLICY "profiles: staff update own"
  ON profiles FOR UPDATE
  USING (
    get_my_role() = 'staff'
    AND id = auth.uid()
  )
  WITH CHECK (
    id              = auth.uid()
    AND role        = 'staff'
    AND company_id  = get_my_company_id()
  );


-- ============================================================
-- FIX 3: Admin profile UPDATE — prevent cross-company moves
-- Without WITH CHECK, an admin could set company_id to any
-- foreign company on profiles they can read.
-- ============================================================

DROP POLICY IF EXISTS "profiles: admins update company" ON profiles;

CREATE POLICY "profiles: admins update company"
  ON profiles FOR UPDATE
  USING (
    get_my_role() = 'admin'
    AND company_id = get_my_company_id()
  )
  WITH CHECK (
    company_id = get_my_company_id()
  );


-- ============================================================
-- FIX 4: form_responses staff UPDATE — allow form submission
-- The implicit WITH CHECK (same as USING) required submitted_at
-- IS NULL on the new row, making it impossible for staff to set
-- submitted_at. The explicit WITH CHECK removes that restriction
-- while still preventing updates to another profile's responses.
-- ============================================================

DROP POLICY IF EXISTS "form_responses: staff update own unsubmitted" ON form_responses;

CREATE POLICY "form_responses: staff update own unsubmitted"
  ON form_responses FOR UPDATE
  USING (
    get_my_role() = 'staff'
    AND profile_id   = auth.uid()
    AND submitted_at IS NULL
  )
  WITH CHECK (
    get_my_role() = 'staff'
    AND profile_id  = auth.uid()
    AND company_id  = get_my_company_id()
  );


-- ============================================================
-- FIX 5: Make profiles.first_name and profiles.last_name nullable
-- Applicants authenticate via magic link before their name is
-- known. Names are collected through the application form.
-- ============================================================

ALTER TABLE profiles
  ALTER COLUMN first_name DROP NOT NULL,
  ALTER COLUMN last_name  DROP NOT NULL;


-- ============================================================
-- FIX 6: updated_at trigger function
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- ============================================================
-- FIX 7: Attach updated_at trigger to every table that has the column
-- Excludes: form_fields, form_answers, documents, audit_logs
-- (those tables have no updated_at column by design)
-- ============================================================

CREATE TRIGGER set_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON applicants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON staff_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON interviews
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON forms
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON form_responses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON compliance_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- FIX 8: Index on form_responses(profile_id)
-- Staff RLS policies on form_answers do EXISTS subqueries
-- against form_responses filtering by profile_id. Without this
-- index, every row evaluation causes a sequential scan.
-- ============================================================

CREATE INDEX idx_form_responses_profile ON form_responses(profile_id)
  WHERE profile_id IS NOT NULL;


-- ============================================================
-- FIX 9: Pin search_path on SECURITY DEFINER helper functions
-- Prevents search-path injection where a malicious schema
-- shadows public.profiles to intercept role/company lookups.
-- ============================================================

CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;
