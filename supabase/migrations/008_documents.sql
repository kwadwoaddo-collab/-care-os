-- Documents table for Care OS compliance tracking.
-- Stores metadata only; file bytes live in Supabase Storage.

CREATE TABLE IF NOT EXISTS documents (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID        NOT NULL,
  applicant_id  UUID        REFERENCES applicants(id) ON DELETE CASCADE,
  document_type TEXT        NOT NULL,
  file_name     TEXT        NOT NULL,
  file_path     TEXT        NOT NULL,
  file_size     BIGINT,
  mime_type     TEXT,
  expiry_date   DATE,
  uploaded_by   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_applicant_id
  ON documents (applicant_id);

CREATE INDEX IF NOT EXISTS idx_documents_document_type
  ON documents (document_type);
