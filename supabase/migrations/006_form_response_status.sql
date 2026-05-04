-- Add submission status to form_responses.
-- 'draft'     — applicant is still filling in the form (default)
-- 'submitted' — applicant has formally submitted; form is locked

ALTER TABLE form_responses
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted'));

-- Index so the admin dashboard can filter by status efficiently.
CREATE INDEX IF NOT EXISTS form_responses_status_idx
  ON form_responses (status);

-- Back-fill any existing rows that already have a submitted_at value
-- (they were submitted before this column existed).
UPDATE form_responses
  SET status = 'submitted'
  WHERE submitted_at IS NOT NULL
    AND status = 'draft';
