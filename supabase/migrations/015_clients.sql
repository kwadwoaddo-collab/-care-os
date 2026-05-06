CREATE TABLE IF NOT EXISTS clients (
  id                            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                    UUID        NOT NULL,
  first_name                    TEXT        NOT NULL,
  last_name                     TEXT        NOT NULL,
  preferred_name                TEXT,
  date_of_birth                 DATE,
  phone                         TEXT,
  email                         TEXT,
  address_line_1                TEXT,
  address_line_2                TEXT,
  town_city                     TEXT,
  postcode                      TEXT,
  status                        TEXT        NOT NULL DEFAULT 'active'
                                            CHECK (status IN ('active','paused','ended','prospective')),
  care_start_date               DATE,
  care_end_date                 DATE,
  funding_type                  TEXT        CHECK (funding_type IN ('private','local_authority','nhs','direct_payment','other')),
  risk_level                    TEXT        NOT NULL DEFAULT 'standard'
                                            CHECK (risk_level IN ('low','standard','high','critical')),
  emergency_contact_name        TEXT,
  emergency_contact_phone       TEXT,
  emergency_contact_relationship TEXT,
  notes                         TEXT,
  created_at                    TIMESTAMPTZ DEFAULT now(),
  updated_at                    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clients_company_id_idx ON clients (company_id);
CREATE INDEX IF NOT EXISTS clients_status_idx     ON clients (status);
CREATE INDEX IF NOT EXISTS clients_postcode_idx   ON clients (postcode);
