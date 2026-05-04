CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('admin', 'staff', 'applicant');

CREATE TYPE applicant_status AS ENUM (
  'applied',
  'shortlisted',
  'rejected',
  'interview_scheduled',
  'hired',
  'withdrawn'
);

CREATE TYPE staff_status AS ENUM (
  'pre_employment',
  'active',
  'suspended',
  'terminated'
);

CREATE TYPE compliance_status AS ENUM (
  'not_started',
  'in_progress',
  'complete',
  'rejected',
  'expired'
);

CREATE TYPE field_type AS ENUM (
  'text',
  'textarea',
  'date',
  'checkbox',
  'file',
  'select',
  'number',
  'email',
  'phone'
);

CREATE TYPE interview_outcome AS ENUM ('pending', 'hired', 'rejected');


-- ============================================================
-- COMPANIES
-- ============================================================

CREATE TABLE companies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- PROFILES  (linked to auth.users — admin, staff, applicant)
-- ============================================================

CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role       user_role NOT NULL DEFAULT 'applicant',
  first_name TEXT NOT NULL,
  last_name  TEXT NOT NULL,
  email      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- APPLICANTS  (application data and workflow state)
-- ============================================================

CREATE TABLE applicants (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  profile_id   UUID REFERENCES profiles(id),  -- set when applicant authenticates via magic link
  email        TEXT NOT NULL,
  first_name   TEXT,
  last_name    TEXT,
  phone        TEXT,
  status       applicant_status NOT NULL DEFAULT 'applied',
  invited_by   UUID REFERENCES profiles(id),
  hired_at     TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, email)
);


-- ============================================================
-- STAFF PROFILES  (created when an applicant is hired)
--
-- Conversion chain:
--   applicants.profile_id  → profiles.id  (role = 'applicant')
--   staff_profiles.profile_id → profiles.id  (role promoted to 'staff')
--   staff_profiles.applicant_id → applicants.id  (preserves application history)
-- ============================================================

CREATE TABLE staff_profiles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  profile_id   UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  applicant_id UUID REFERENCES applicants(id),
  job_title    TEXT,
  start_date   DATE,
  status       staff_status NOT NULL DEFAULT 'pre_employment',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- INTERVIEWS
-- ============================================================

CREATE TABLE interviews (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  applicant_id   UUID NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  interviewer_id UUID REFERENCES profiles(id),
  scheduled_at   TIMESTAMPTZ,
  conducted_at   TIMESTAMPTZ,
  notes          TEXT,
  score          INTEGER CHECK (score BETWEEN 1 AND 10),
  outcome        interview_outcome NOT NULL DEFAULT 'pending',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- FORMS
-- ============================================================

CREATE TABLE forms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  is_template BOOLEAN NOT NULL DEFAULT FALSE,
  created_by  UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- FORM FIELDS
-- ============================================================

CREATE TABLE form_fields (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id        UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  label          TEXT NOT NULL,
  field_type     field_type NOT NULL,
  is_required    BOOLEAN NOT NULL DEFAULT FALSE,
  include_in_pdf BOOLEAN NOT NULL DEFAULT TRUE,
  options        JSONB,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- FORM RESPONSES
-- ============================================================

CREATE TABLE form_responses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  form_id      UUID NOT NULL REFERENCES forms(id),
  profile_id   UUID REFERENCES profiles(id),    -- staff or admin respondent
  applicant_id UUID REFERENCES applicants(id),  -- applicant respondent
  submitted_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (profile_id IS NOT NULL OR applicant_id IS NOT NULL)
);


-- ============================================================
-- FORM ANSWERS
--
-- value is JSONB — examples by field type:
--   text / textarea / email / phone / date  →  { "text": "John Smith" }
--   checkbox                                →  { "checked": true }
--   select                                  →  { "selected": "Option A" }
--   file                                    →  { "storage_path": "acme/applicants/uuid/cv.pdf" }
-- ============================================================

CREATE TABLE form_answers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID NOT NULL REFERENCES form_responses(id) ON DELETE CASCADE,
  field_id    UUID NOT NULL REFERENCES form_fields(id),
  value       JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(response_id, field_id)
);


-- ============================================================
-- COMPLIANCE ITEMS  (linked to staff_profiles, not profiles)
-- ============================================================

CREATE TABLE compliance_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  staff_profile_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  item_type        TEXT NOT NULL,  -- 'dbs', 'right_to_work', 'reference_1', 'id_check', etc.
  status           compliance_status NOT NULL DEFAULT 'not_started',
  notes            TEXT,
  expires_at       DATE,
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- DOCUMENTS  (storage_path only — signed URLs generated at request time)
-- ============================================================

CREATE TABLE documents (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  profile_id         UUID REFERENCES profiles(id),
  applicant_id       UUID REFERENCES applicants(id),
  compliance_item_id UUID REFERENCES compliance_items(id),
  name               TEXT NOT NULL,
  storage_path       TEXT NOT NULL,  -- e.g. 'acme-care/staff/uuid/dbs-certificate.pdf'
  file_type          TEXT,
  file_size          INTEGER,        -- bytes
  uploaded_by        UUID REFERENCES profiles(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (profile_id IS NOT NULL OR applicant_id IS NOT NULL)
);


-- ============================================================
-- AUDIT LOGS
-- ============================================================

CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  actor_id    UUID,           -- null = system action
  action      TEXT NOT NULL,  -- e.g. 'applicant.hired', 'compliance_item.completed'
  entity_type TEXT NOT NULL,
  entity_id   UUID NOT NULL,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_profiles_company         ON profiles(company_id);
CREATE INDEX idx_applicants_company       ON applicants(company_id);
CREATE INDEX idx_applicants_status        ON applicants(company_id, status);
CREATE INDEX idx_applicants_profile       ON applicants(profile_id) WHERE profile_id IS NOT NULL;
CREATE INDEX idx_staff_profiles_company   ON staff_profiles(company_id);
CREATE INDEX idx_staff_profiles_profile   ON staff_profiles(profile_id);
CREATE INDEX idx_interviews_applicant     ON interviews(applicant_id);
CREATE INDEX idx_forms_company            ON forms(company_id);
CREATE INDEX idx_form_fields_form         ON form_fields(form_id, sort_order);
CREATE INDEX idx_form_responses_company   ON form_responses(company_id);
CREATE INDEX idx_form_responses_form      ON form_responses(form_id);
CREATE INDEX idx_form_answers_response    ON form_answers(response_id);
CREATE INDEX idx_compliance_staff_profile ON compliance_items(staff_profile_id);
CREATE INDEX idx_compliance_expiry        ON compliance_items(company_id, expires_at)
  WHERE expires_at IS NOT NULL;
CREATE INDEX idx_documents_profile        ON documents(profile_id);
CREATE INDEX idx_documents_applicant      ON documents(applicant_id);
CREATE INDEX idx_audit_logs_company       ON audit_logs(company_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity        ON audit_logs(entity_type, entity_id);
