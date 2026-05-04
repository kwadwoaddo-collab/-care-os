-- Allow idempotent form creation per company so the API can
-- ensure the "Application: Personal Details" form exists without
-- risking duplicates under concurrent requests.
ALTER TABLE forms
  ADD CONSTRAINT forms_company_id_name_key UNIQUE (company_id, name);

-- slug column lets the API address fields by a stable key rather
-- than relying on label text, which may change.
ALTER TABLE form_fields
  ADD COLUMN IF NOT EXISTS slug TEXT;

ALTER TABLE form_fields
  ADD CONSTRAINT form_fields_form_id_slug_key UNIQUE (form_id, slug);

-- Allows upsert of a form_response per applicant + form so that
-- saving the form multiple times updates the same response row.
ALTER TABLE form_responses
  ADD CONSTRAINT form_responses_form_id_applicant_id_key UNIQUE (form_id, applicant_id);
