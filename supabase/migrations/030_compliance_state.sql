-- supabase/migrations/030_compliance_state.sql
--
-- Performance index for expiry-based compliance queries.
-- The new compliance dashboard and reminder engine both filter documents
-- by expiry_date; a partial index speeds these up significantly when the
-- table grows.
--
-- Note: no structural schema changes are needed for ComplianceState —
-- the state is computed entirely from existing columns in the documents table.

-- Index on expiry_date for documents that have one (sparse partial index)
CREATE INDEX IF NOT EXISTS idx_documents_expiry_date
  ON documents (expiry_date)
  WHERE expiry_date IS NOT NULL;

-- Index on training_category + reviewed_status for fast training resolution
CREATE INDEX IF NOT EXISTS idx_documents_training_compliance
  ON documents (training_category, reviewed_status)
  WHERE training_category IS NOT NULL;

-- Index to speed up "pending cert review" count queries
CREATE INDEX IF NOT EXISTS idx_documents_pending_certs
  ON documents (document_type, reviewed_status)
  WHERE document_type = 'training_certificate'
    AND reviewed_status = 'pending';
