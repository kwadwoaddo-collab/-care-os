-- ============================================================
-- 058_documents_reviewed_notes.sql
--
-- Adds the reviewed_notes column to the documents table.
-- This is a legacy field used by rejectDocument() and
-- requestResubmission() in lib/documents/verification.ts
-- to store the human-readable reason for rejection.
-- ============================================================

alter table documents
  add column if not exists reviewed_notes text;
