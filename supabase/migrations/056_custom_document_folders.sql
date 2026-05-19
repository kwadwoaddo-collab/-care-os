-- 056_custom_document_folders.sql
--
-- Extends the document system with:
--   1. Custom folder management (create / rename / archive per company)
--   2. Permanent document deletion support (deleted_at)
--   3. Source label for system-generated documents (e.g. auto-generated PDFs)

-- ── Custom folder columns ─────────────────────────────────────────────────────

ALTER TABLE staff_document_folders
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- is_system already exists (bool); custom folders are rows where is_system = false.
-- We add is_custom as a convenience alias that's kept in sync.
-- Custom = created by an admin at runtime; system = seeded by migrations.
ALTER TABLE staff_document_folders
  ADD COLUMN IF NOT EXISTS is_custom BOOLEAN NOT NULL DEFAULT false;

-- Backfill: seeded rows are system, not custom
UPDATE staff_document_folders SET is_custom = false WHERE is_system = true;

-- ── Permanent document deletion ───────────────────────────────────────────────

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS deleted_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_label TEXT;           -- e.g. 'Generated from application submission'

-- Partial index so live-document queries stay fast
CREATE INDEX IF NOT EXISTS idx_documents_not_deleted
  ON documents (company_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- ── Update document_audit_log event list to include permanent delete ──────────
-- The existing CHECK already includes 'deleted'; no structural change needed.

-- ── RLS: custom folder visibility follows company isolation ───────────────────
-- staff_document_folders already has RLS from migration 052.
-- No policy changes required: new custom rows are in the same table,
-- same company_id, same tenant isolation.

-- ── Grant: admins can insert/update custom folders ────────────────────────────
-- No additional grants needed beyond existing table-level permissions.
