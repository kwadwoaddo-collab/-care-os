-- Fix: documents_check constraint violation
--
-- Root cause: 001_initial_schema.sql created the documents table with:
--   CHECK (profile_id IS NOT NULL OR applicant_id IS NOT NULL)
-- PostgreSQL auto-names this "documents_check".
--
-- The staff and worker upload routes insert via staff_profile_id without
-- setting profile_id. For staff not hired through the applicant flow,
-- applicant_id is also null → the constraint fires → insert fails.
--
-- Fix:
--   1. Add columns required by the API that may be absent if only the 001 schema ran
--   2. Make legacy NOT NULL columns nullable (name, storage_path from 001 schema)
--   3. Drop the stale documents_check constraint
--   4. Add index for staff_profile_id (used by getStaffDocuments queries)

-- 1. Add columns the API expects (idempotent via IF NOT EXISTS)
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS document_type    TEXT,
  ADD COLUMN IF NOT EXISTS file_name        TEXT,
  ADD COLUMN IF NOT EXISTS file_path        TEXT,
  ADD COLUMN IF NOT EXISTS mime_type        TEXT,
  ADD COLUMN IF NOT EXISTS expiry_date      DATE,
  ADD COLUMN IF NOT EXISTS staff_profile_id UUID REFERENCES staff_profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS training_name    TEXT;

-- 2. Drop NOT NULL from legacy columns if they exist and are currently NOT NULL
--    (001_initial_schema.sql defined name and storage_path as NOT NULL;
--     new inserts use file_name and file_path instead)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'documents'
      AND column_name  = 'name'
      AND is_nullable  = 'NO'
  ) THEN
    ALTER TABLE documents ALTER COLUMN name DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'documents'
      AND column_name  = 'storage_path'
      AND is_nullable  = 'NO'
  ) THEN
    ALTER TABLE documents ALTER COLUMN storage_path DROP NOT NULL;
  END IF;
END $$;

-- 3. Drop the stale constraint — staff_profile_id is now the primary anchor
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_check;

-- 4. Index for getStaffDocuments queries on staff_profile_id
CREATE INDEX IF NOT EXISTS idx_documents_staff_profile_id
  ON documents (staff_profile_id);
