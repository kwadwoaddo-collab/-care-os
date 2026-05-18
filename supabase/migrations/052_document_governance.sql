-- 052: Enterprise document governance — versioning, folder seeding, visibility
--
-- Changes:
--   1. staff_document_versions — complete version history per document group
--   2. Seed system folders for every company (idempotent)
--   3. Back-fill folder assignments for existing documents based on type

-- ── 1. staff_document_versions ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staff_document_versions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  version_group_id  UUID        NOT NULL,
  document_id       UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number    SMALLINT    NOT NULL DEFAULT 1,
  is_current        BOOLEAN     NOT NULL DEFAULT TRUE,
  superseded_at     TIMESTAMPTZ NULL,
  superseded_by     UUID        NULL REFERENCES documents(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_versions_group_current
  ON staff_document_versions (version_group_id)
  WHERE is_current = TRUE;

CREATE INDEX IF NOT EXISTS idx_versions_document
  ON staff_document_versions (document_id);

CREATE INDEX IF NOT EXISTS idx_versions_group
  ON staff_document_versions (version_group_id, version_number DESC);

-- ── 2. Seed system folders per company ───────────────────────────────────────

INSERT INTO staff_document_folders (company_id, name, slug, sort_order, icon, colour, description)
SELECT
  c.id,
  f.name,
  f.slug,
  f.sort_order,
  f.icon,
  f.colour,
  f.description
FROM companies c
CROSS JOIN (VALUES
  (1,  'ID & Right to Work',         'id-right-to-work',       'travel_explore',    '#4F46E5', 'Passports, BRP/Visa, right to work checks'),
  (2,  'DBS & Safeguarding',          'dbs-safeguarding',       'fingerprint',       '#7C3AED', 'DBS certificates and safeguarding declarations'),
  (3,  'Application Form & CV',       'application-form-cv',    'description',       '#0369A1', 'Application forms, CVs, covering letters'),
  (4,  'References & Interview Notes','references-interview',   'rate_review',       '#0891B2', 'Reference letters and interview documentation'),
  (5,  'Contracts & Agreements',      'contracts-agreements',   'contract',          '#059669', 'Employment contracts and policy acknowledgements'),
  (6,  'Training & Certifications',   'training-certs',         'school',            '#D97706', 'Training certificates and professional qualifications'),
  (7,  'Shadowing & Spot Checks',     'shadowing-spot-checks',  'visibility',        '#65A30D', 'Competency assessments and shadowing records'),
  (8,  'Supervision & Appraisal',     'supervision-appraisal',  'supervisor_account','#DC2626', 'Supervision records and annual appraisals'),
  (9,  'Health & Vaccination',        'health-vaccination',     'vaccines',          '#DB2777', 'Occupational health and vaccination records'),
  (10, 'Leave & Absence',             'leave-absence',          'event_busy',        '#9333EA', 'Fit notes and return-to-work forms'),
  (11, 'Archive',                     'archive',                'archive',           '#6B7280', 'Expired, superseded, or terminated-staff documents')
) AS f(sort_order, name, slug, icon, colour, description)
ON CONFLICT (company_id, slug) DO NOTHING;

-- ── 3. Back-fill folder assignments for existing documents ────────────────────
--
-- Joins documents to the newly seeded folders using document_type matching.
-- Only updates rows that don't yet have a folder_id.

UPDATE documents d
SET folder_id = fmap.folder_id
FROM (
  SELECT
    doc.id AS doc_id,
    f.id   AS folder_id
  FROM documents doc
  JOIN staff_document_folders f
    ON f.company_id = doc.company_id
  WHERE doc.folder_id IS NULL
    AND f.slug = CASE doc.document_type
      WHEN 'passport'                    THEN 'id-right-to-work'
      WHEN 'brp'                         THEN 'id-right-to-work'
      WHEN 'visa'                        THEN 'id-right-to-work'
      WHEN 'right_to_work'               THEN 'id-right-to-work'
      WHEN 'share_code'                  THEN 'id-right-to-work'
      WHEN 'right_to_work_share_code'    THEN 'id-right-to-work'
      WHEN 'share_code_confirmation'     THEN 'id-right-to-work'
      WHEN 'cos_letter'                  THEN 'id-right-to-work'
      WHEN 'id'                          THEN 'id-right-to-work'
      WHEN 'dbs'                         THEN 'dbs-safeguarding'
      WHEN 'dbs_certificate'             THEN 'dbs-safeguarding'
      WHEN 'safeguarding'                THEN 'dbs-safeguarding'
      WHEN 'safeguarding_certificate'    THEN 'dbs-safeguarding'
      WHEN 'cv'                          THEN 'application-form-cv'
      WHEN 'application_form'            THEN 'application-form-cv'
      WHEN 'covering_letter'             THEN 'application-form-cv'
      WHEN 'reference'                   THEN 'references-interview'
      WHEN 'reference_letter'            THEN 'references-interview'
      WHEN 'interview_notes'             THEN 'references-interview'
      WHEN 'contract'                    THEN 'contracts-agreements'
      WHEN 'agency_contract'             THEN 'contracts-agreements'
      WHEN 'policy_acknowledgement'      THEN 'contracts-agreements'
      WHEN 'training_certificate'        THEN 'training-certs'
      WHEN 'manual_handling'             THEN 'training-certs'
      WHEN 'manual_handling_certificate' THEN 'training-certs'
      WHEN 'medication_training'         THEN 'training-certs'
      WHEN 'fire_safety'                 THEN 'training-certs'
      WHEN 'fire_safety_certificate'     THEN 'training-certs'
      WHEN 'basic_life_support'          THEN 'training-certs'
      WHEN 'first_aid_certificate'       THEN 'training-certs'
      WHEN 'safeguarding_certificate'    THEN 'training-certs'
      WHEN 'infection_control_certificate' THEN 'training-certs'
      WHEN 'nmc_pin'                     THEN 'training-certs'
      WHEN 'professional_indemnity'      THEN 'training-certs'
      WHEN 'spot_check'                  THEN 'shadowing-spot-checks'
      WHEN 'competency_assessment'       THEN 'shadowing-spot-checks'
      WHEN 'supervision'                 THEN 'supervision-appraisal'
      WHEN 'appraisal'                   THEN 'supervision-appraisal'
      WHEN 'vaccination'                 THEN 'health-vaccination'
      WHEN 'occupational_health'         THEN 'health-vaccination'
      WHEN 'fit_note'                    THEN 'leave-absence'
      WHEN 'return_to_work'              THEN 'leave-absence'
      ELSE NULL
    END
) AS fmap
WHERE d.id = fmap.doc_id;

-- ── 4. Back-fill review_status for routed docs ────────────────────────────────

UPDATE documents
  SET review_status = 'auto_routed'
  WHERE folder_id IS NOT NULL AND review_status IS NULL;

UPDATE documents
  SET review_status = 'unrecognised'
  WHERE folder_id IS NULL AND review_status IS NULL;

-- ── 5. Worker-visible folders: set worker_visible=true for permitted types ────

UPDATE documents
  SET worker_visible = TRUE, visibility = 'worker_visible'::document_visibility
  WHERE document_type IN (
    'contract', 'agency_contract',
    'manual_handling_certificate', 'fire_safety_certificate',
    'first_aid_certificate', 'safeguarding_certificate',
    'infection_control_certificate', 'basic_life_support',
    'medication_training', 'training_certificate',
    'nmc_pin'
  )
  AND worker_visible = FALSE;
