-- Sanitas Medical Recruitment CRM schema

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  role          TEXT NOT NULL DEFAULT 'Recruiter',
  initials      TEXT NOT NULL,
  color         TEXT NOT NULL DEFAULT '#1863dc',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS candidates (
  id              SERIAL PRIMARY KEY,
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  role            TEXT NOT NULL,               -- Registered Nurse, Senior Nurse, Healthcare Assistant, Senior HCA
  nmc_pin         TEXT,                        -- nurses only
  address         TEXT,
  town            TEXT,
  postcode        TEXT,
  status          TEXT NOT NULL DEFAULT 'in_progress', -- compliant, on_assignment, in_progress, dormant, do_not_use
  compliance_score INT NOT NULL DEFAULT 0,     -- 0-100 derived from documents
  pay_min         NUMERIC(6,2),
  pay_max         NUMERIC(6,2),
  preferred_shift TEXT,                        -- days, nights, flexible
  employment_pref TEXT,                        -- temporary, permanent, both
  travel_miles    INT,
  has_transport   BOOLEAN DEFAULT FALSE,
  source          TEXT,                        -- Website, Referral, Indeed, Reed, Facebook
  rating          NUMERIC(2,1),                -- 1.0-5.0
  tags            TEXT[] DEFAULT '{}',
  owner_id        INT REFERENCES users(id),
  notes           TEXT,
  registered_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_worked_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compliance_documents (
  id            SERIAL PRIMARY KEY,
  candidate_id  INT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,                 -- DBS, NMC PIN, Right to Work, Passport/ID, Mandatory Training, PMVA, References, CV, Immunisations, Proof of Address
  reference_no  TEXT,
  status        TEXT NOT NULL DEFAULT 'valid', -- valid, expiring, expired, pending, missing
  issue_date    DATE,
  expiry_date   DATE,
  verified_by   INT REFERENCES users(id),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clients (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  group_name      TEXT,
  type            TEXT NOT NULL,               -- Nursing Home, Residential Home, Dementia Care, Supported Living
  address         TEXT,
  town            TEXT,
  postcode        TEXT,
  phone           TEXT,
  email           TEXT,
  website         TEXT,
  beds            INT,
  cqc_rating      TEXT,                        -- Outstanding, Good, Requires Improvement, Inadequate
  status          TEXT NOT NULL DEFAULT 'active', -- active, prospect, inactive
  payment_terms   INT DEFAULT 30,
  account_manager_id INT REFERENCES users(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_contacts (
  id          SERIAL PRIMARY KEY,
  client_id   INT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  role        TEXT,
  email       TEXT,
  phone       TEXT,
  is_primary  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vacancies (
  id              SERIAL PRIMARY KEY,
  client_id       INT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  role            TEXT NOT NULL,
  employment_type TEXT NOT NULL DEFAULT 'temporary',  -- temporary, permanent, temp_to_perm
  shift_pattern   TEXT,                         -- days, nights, mixed, weekends
  hours_per_week  INT,
  pay_rate        NUMERIC(6,2),
  charge_rate     NUMERIC(6,2),
  stage           TEXT NOT NULL DEFAULT 'open', -- open, sourcing, shortlisted, interview, offer, filled, on_hold, lost
  priority        TEXT NOT NULL DEFAULT 'medium', -- low, medium, high, urgent
  openings        INT NOT NULL DEFAULT 1,
  start_date      DATE,
  posted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  closes_at       DATE,
  filled_at       TIMESTAMPTZ,
  description     TEXT,
  requirements    TEXT[] DEFAULT '{}',
  owner_id        INT REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS placements (
  id            SERIAL PRIMARY KEY,
  vacancy_id    INT REFERENCES vacancies(id) ON DELETE SET NULL,
  candidate_id  INT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  client_id     INT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  stage         TEXT NOT NULL DEFAULT 'submitted', -- submitted, screening, compliance_check, interview, offer, placed, active, ended, rejected
  pay_rate      NUMERIC(6,2),
  charge_rate   NUMERIC(6,2),
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  placed_at     TIMESTAMPTZ,
  start_date    DATE,
  end_date      DATE,
  end_reason    TEXT,
  owner_id      INT REFERENCES users(id),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shifts (
  id               SERIAL PRIMARY KEY,
  placement_id     INT REFERENCES placements(id) ON DELETE SET NULL,
  candidate_id     INT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  client_id        INT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  shift_date       DATE NOT NULL,
  start_time       TIME NOT NULL,
  end_time         TIME NOT NULL,
  hours            NUMERIC(4,1) NOT NULL,
  shift_type       TEXT NOT NULL DEFAULT 'day', -- day, night, early, late, long_day
  pay_rate         NUMERIC(6,2),
  charge_rate      NUMERIC(6,2),
  status           TEXT NOT NULL DEFAULT 'booked', -- booked, completed, cancelled, no_show
  timesheet_status TEXT NOT NULL DEFAULT 'not_submitted', -- not_submitted, submitted, approved, paid
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activities (
  id          SERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,                   -- candidate, client, vacancy, placement
  entity_id   INT NOT NULL,
  type        TEXT NOT NULL,                   -- call, email, meeting, note, sms, status_change
  subject     TEXT,
  body        TEXT,
  direction   TEXT,                            -- inbound, outbound, null
  user_id     INT REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id           SERIAL PRIMARY KEY,
  user_id      INT REFERENCES users(id),
  title        TEXT NOT NULL,
  description  TEXT,
  due_date     TIMESTAMPTZ,
  priority     TEXT NOT NULL DEFAULT 'medium', -- low, medium, high
  status       TEXT NOT NULL DEFAULT 'open',   -- open, in_progress, done
  entity_type  TEXT,
  entity_id    INT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS cv_matches (
  id             SERIAL PRIMARY KEY,
  vacancy_id     INT NOT NULL REFERENCES vacancies(id) ON DELETE CASCADE,
  candidate_id   INT REFERENCES candidates(id) ON DELETE SET NULL,
  filename       TEXT,
  candidate_name TEXT,
  cv_text        TEXT,
  score          INT,
  verdict        TEXT,                          -- strong, good, partial, weak
  matched        JSONB DEFAULT '[]',            -- [{item, evidence}]
  missing        JSONB DEFAULT '[]',            -- [{item, importance, note}]
  summary        TEXT,
  engine         TEXT DEFAULT 'heuristic',      -- claude | heuristic
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Operational-system expansion (compliance spec) ─────────────────────────

-- 8.4 role-based access. Staff access roles: admin, office, compliance, finance.
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_role TEXT NOT NULL DEFAULT 'office';

-- Unified login accounts: staff, workers, client contacts/signatories, site supervisors.
CREATE TABLE IF NOT EXISTS accounts (
  id            SERIAL PRIMARY KEY,
  kind          TEXT NOT NULL,               -- staff | worker | client | supervisor
  user_id       INT REFERENCES users(id) ON DELETE CASCADE,
  candidate_id  INT REFERENCES candidates(id) ON DELETE CASCADE,
  client_id     INT REFERENCES clients(id) ON DELETE CASCADE,
  contact_id    INT REFERENCES client_contacts(id) ON DELETE CASCADE,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  must_reset    BOOLEAN NOT NULL DEFAULT FALSE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- DB-backed sessions so access can be revoked instantly (5.3).
CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  account_id  INT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);

-- System configuration: notification wording, uplift rules, retention periods,
-- registration custom fields, auto-ranking switch (3.8).
CREATE TABLE IF NOT EXISTS settings (
  key    TEXT PRIMARY KEY,
  value  JSONB NOT NULL
);

-- Uploaded files, stored in Vercel Blob, downloaded via authenticated proxy.
CREATE TABLE IF NOT EXISTS files (
  id           SERIAL PRIMARY KEY,
  owner_type   TEXT NOT NULL,                -- candidate | document | timesheet | registration | invoice
  owner_id     INT,
  filename     TEXT NOT NULL,
  mime         TEXT,
  size         INT,
  blob_url     TEXT,
  label        TEXT,
  uploaded_by  INT REFERENCES accounts(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.x candidate self-registration (draft → submitted → linked to candidate)
CREATE TABLE IF NOT EXISTS registrations (
  id           SERIAL PRIMARY KEY,
  token        TEXT UNIQUE NOT NULL,
  status       TEXT NOT NULL DEFAULT 'draft', -- draft | submitted | imported
  payload      JSONB NOT NULL DEFAULT '{}',
  candidate_id INT REFERENCES candidates(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Candidate record additions (1.1, 1.6, 6.8, 3.5, 8.6)
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS engagement_type TEXT NOT NULL DEFAULT 'paye'; -- paye | ltd
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS next_of_kin_name TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS next_of_kin_phone TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS rtw_status TEXT;          -- British citizen, settled, visa (type/expiry)
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS rtw_expiry DATE;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS driving TEXT;             -- drives | car_share | neither
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS uniform_size TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS willing_client_ids INT[] DEFAULT '{}';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS suspended BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS first_choice_since TIMESTAMPTZ;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS erased_at TIMESTAMPTZ;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS payroll_ref TEXT;                -- payroll bureau reference
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS bank_details JSONB;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS billing_email TEXT;                 -- invoices go here
-- Profile images / logos (files.owner_type = 'photo'; served inline via /api/files/:id/view)
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS photo_file_id INT REFERENCES files(id) ON DELETE SET NULL;
ALTER TABLE users      ADD COLUMN IF NOT EXISTS photo_file_id INT REFERENCES files(id) ON DELETE SET NULL;
ALTER TABLE clients    ADD COLUMN IF NOT EXISTS logo_file_id  INT REFERENCES files(id) ON DELETE SET NULL;

-- Client record additions
ALTER TABLE clients ADD COLUMN IF NOT EXISTS standing_instructions TEXT;         -- 4.4
ALTER TABLE clients ADD COLUMN IF NOT EXISTS share_profile_fields JSONB;         -- 4.5 visibility config
ALTER TABLE client_contacts ADD COLUMN IF NOT EXISTS is_signatory BOOLEAN NOT NULL DEFAULT FALSE;

-- 3.7 named individuals placed one-to-one (continuity of care)
CREATE TABLE IF NOT EXISTS individuals (
  id         SERIAL PRIMARY KEY,
  client_id  INT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  notes      TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.3 required-document lists per client site
CREATE TABLE IF NOT EXISTS client_requirements (
  id        SERIAL PRIMARY KEY,
  client_id INT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  doc_type  TEXT NOT NULL,
  required  BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (client_id, doc_type)
);

-- 2.8/2.9 occupational health & immunisation records (restricted visibility)
CREATE TABLE IF NOT EXISTS oh_records (
  id           SERIAL PRIMARY KEY,
  candidate_id INT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,                -- immunisation | screening | clearance | fitness
  name         TEXT NOT NULL,                -- e.g. Hepatitis B, TB, OH clearance
  record_date  DATE,
  expiry_date  DATE,
  result       TEXT,                         -- e.g. cleared, complete, see notes
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Document extras (file link, DBS Update Service & register check metadata)
ALTER TABLE compliance_documents ADD COLUMN IF NOT EXISTS file_id INT REFERENCES files(id);
ALTER TABLE compliance_documents ADD COLUMN IF NOT EXISTS dbs_update_service BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE compliance_documents ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;
ALTER TABLE compliance_documents ADD COLUMN IF NOT EXISTS check_result TEXT;

-- 2.6/2.7 audit of external register checks (DBS Update Service, NMC)
CREATE TABLE IF NOT EXISTS register_checks (
  id           SERIAL PRIMARY KEY,
  candidate_id INT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  register     TEXT NOT NULL,                -- dbs_update_service | nmc
  identifier   TEXT,
  checked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  result       TEXT NOT NULL,                -- clear | not_found | lapsed | error
  checked_by   INT REFERENCES users(id),
  notes        TEXT
);

-- 3.1-3.4 worker availability
CREATE TABLE IF NOT EXISTS availability (
  id           SERIAL PRIMARY KEY,
  candidate_id INT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  shift_type   TEXT NOT NULL DEFAULT 'any',  -- any | day | night | early | late | long_day
  status       TEXT NOT NULL DEFAULT 'available', -- available | unavailable
  source       TEXT NOT NULL DEFAULT 'office',    -- worker | office
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, date, shift_type)
);

-- 3.0 / 4.7-4.9 client shift requests
CREATE TABLE IF NOT EXISTS shift_requests (
  id          SERIAL PRIMARY KEY,
  client_id   INT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  start_time  TIME,
  end_time    TIME,
  hours       NUMERIC(4,1),
  shift_type  TEXT NOT NULL DEFAULT 'day',
  role        TEXT,                          -- role required, e.g. Registered Nurse
  qty         INT NOT NULL DEFAULT 1,
  individual_id INT REFERENCES individuals(id) ON DELETE SET NULL,
  status      TEXT NOT NULL DEFAULT 'pending', -- pending | filled | cancelled
  filled_at   TIMESTAMPTZ,                     -- 7.2 time-to-fill tracking
  urgency     TEXT NOT NULL DEFAULT 'normal',  -- normal | urgent
  source      TEXT NOT NULL DEFAULT 'office',  -- office | portal | email
  notes       TEXT,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  created_by  INT REFERENCES accounts(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE shift_requests ADD COLUMN IF NOT EXISTS filled_at TIMESTAMPTZ; -- 7.2 fill-time

-- 3.10 / 4.1 offers of shifts to workers
CREATE TABLE IF NOT EXISTS offers (
  id           SERIAL PRIMARY KEY,
  request_id   INT REFERENCES shift_requests(id) ON DELETE CASCADE,
  shift_id     INT REFERENCES shifts(id) ON DELETE CASCADE,
  candidate_id INT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'sent', -- sent | accepted | declined | withdrawn
  decline_reason TEXT,                       -- 7.3 withdrawal/decline reason
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  created_by   INT REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE offers ADD COLUMN IF NOT EXISTS decline_reason TEXT; -- 7.3

-- 3.11 do-not-offer markers
CREATE TABLE IF NOT EXISTS candidate_blocks (
  id            SERIAL PRIMARY KEY,
  candidate_id  INT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  client_id     INT REFERENCES clients(id) ON DELETE CASCADE,
  individual_id INT REFERENCES individuals(id) ON DELETE CASCADE,
  reason        TEXT,
  created_by    INT REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Shift record additions
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS request_id INT REFERENCES shift_requests(id) ON DELETE SET NULL;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS individual_id INT REFERENCES individuals(id) ON DELETE SET NULL;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS allocated_by INT REFERENCES users(id);
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS worker_confirmed_at TIMESTAMPTZ;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS cancelled_by TEXT;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS actual_start TIME;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS actual_end TIME;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS actual_hours NUMERIC(4,1);
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS signatory_notes TEXT;          -- 6.10a
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS worker_sig_name TEXT;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS worker_sig_at TIMESTAMPTZ;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS client_sig_name TEXT;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS client_sig_at TIMESTAMPTZ;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS approved_by INT REFERENCES users(id);  -- 6.10c
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS timesheet_locked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS invoice_id INT;

-- 6.10 timesheet query / return-for-correction log
CREATE TABLE IF NOT EXISTS timesheet_queries (
  id          SERIAL PRIMARY KEY,
  shift_id    INT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  raised_by   INT REFERENCES users(id),
  note        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open', -- open | resolved
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- 4.4 standing-instruction acknowledgements
CREATE TABLE IF NOT EXISTS instruction_acks (
  id           SERIAL PRIMARY KEY,
  shift_id     INT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  candidate_id INT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  client_id    INT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  acked_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shift_id, candidate_id)
);

-- Phone-signing tokens for client signatories (6.2)
CREATE TABLE IF NOT EXISTS sign_tokens (
  id         SERIAL PRIMARY KEY,
  shift_id   INT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  token      TEXT UNIQUE NOT NULL,
  kind       TEXT NOT NULL,                  -- client_signature | worker_signature
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6.6 / 6.10c / 6.11 invoices
CREATE TABLE IF NOT EXISTS invoices (
  id          SERIAL PRIMARY KEY,
  client_id   INT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  number      TEXT UNIQUE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'draft', -- draft | sent | paid | cancelled
  issue_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date    DATE,
  subtotal    NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes       TEXT,
  sent_at     TIMESTAMPTZ,
  paid_at     TIMESTAMPTZ,
  created_by  INT REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS invoice_lines (
  id          SERIAL PRIMARY KEY,
  invoice_id  INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  shift_id    INT REFERENCES shifts(id) ON DELETE SET NULL,
  description TEXT,
  hours       NUMERIC(5,2),
  rate        NUMERIC(8,2),
  amount      NUMERIC(10,2) NOT NULL
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shifts_invoice_fk') THEN
    ALTER TABLE shifts ADD CONSTRAINT shifts_invoice_fk
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2.2 / 4.2-4.6 notification outbox (email log + WhatsApp deep links)
CREATE TABLE IF NOT EXISTS messages (
  id           SERIAL PRIMARY KEY,
  direction    TEXT NOT NULL DEFAULT 'outbound', -- outbound | inbound
  channel      TEXT NOT NULL,                    -- email | whatsapp | system
  to_name      TEXT,
  to_contact   TEXT,                             -- email address or phone
  subject      TEXT,
  body         TEXT,
  status       TEXT NOT NULL DEFAULT 'queued',   -- queued | sent | logged | failed
  entity_type  TEXT,
  entity_id    INT,
  created_by   INT REFERENCES users(id),
  sent_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8.9 audit trail
CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL PRIMARY KEY,
  account_id  INT REFERENCES accounts(id) ON DELETE SET NULL,
  actor_name  TEXT,
  action      TEXT NOT NULL,                 -- e.g. shift.allocated, timesheet.approved, rate.changed
  entity_type TEXT,
  entity_id   INT,
  detail      JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6.7 bank holidays (uplift rules reference)
CREATE TABLE IF NOT EXISTS bank_holidays (
  date DATE PRIMARY KEY,
  name TEXT
);

-- ─── Contracted-scope completion (additive, reversible) ────────────────────

-- A. Manual DBS/NMC recording is staff-entered, not independently verified.
ALTER TABLE register_checks ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual_staff'; -- manual_staff only in this phase
ALTER TABLE register_checks ADD COLUMN IF NOT EXISTS review_due DATE;                            -- next review/renewal date

-- A. Spreadsheet import batches (preview → commit) with per-row outcomes.
CREATE TABLE IF NOT EXISTS import_batches (
  id          SERIAL PRIMARY KEY,
  kind        TEXT NOT NULL DEFAULT 'training',
  filename    TEXT,
  mapping     JSONB NOT NULL DEFAULT '{}',
  row_count   INT NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'preview',  -- preview | committed | discarded
  summary     JSONB NOT NULL DEFAULT '{}',
  rows        JSONB NOT NULL DEFAULT '[]',      -- parsed rows with validation outcome
  created_by  INT REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  committed_at TIMESTAMPTZ
);

-- D. Financial snapshot frozen at timesheet approval so later rate/uplift
--    changes never rewrite historical pay, charge or margin (pence integers).
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS uplift_rule        TEXT;            -- none | night | weekend | bank_holiday
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS uplift_multiplier  NUMERIC(5,3);
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS paid_hours         NUMERIC(5,2);
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS pay_amount_pence   BIGINT;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS charge_amount_pence BIGINT;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS employer_ni_pence  BIGINT;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS bureau_fee_pence   BIGINT;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS engagement_type_at_approval TEXT;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS financial_snapshot JSONB;          -- inputs used (rates, settings) for audit
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS payroll_export_id  INT;

-- E. Payroll export runs — one row per bureau run; shifts reference the run so
--    a shift cannot be exported twice.
CREATE TABLE IF NOT EXISTS payroll_exports (
  id            SERIAL PRIMARY KEY,
  engagement    TEXT NOT NULL,                 -- paye | ltd
  period_from   DATE NOT NULL,
  period_to     DATE NOT NULL,
  shift_count   INT NOT NULL DEFAULT 0,
  total_pence   BIGINT NOT NULL DEFAULT 0,
  rejected      JSONB NOT NULL DEFAULT '[]',   -- [{shift_id, reasons[]}]
  format        TEXT NOT NULL DEFAULT 'provisional-v1',
  created_by    INT REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shifts_payroll_export_fk') THEN
    ALTER TABLE shifts ADD CONSTRAINT shifts_payroll_export_fk
      FOREIGN KEY (payroll_export_id) REFERENCES payroll_exports(id) ON DELETE SET NULL;
  END IF;
END $$;

-- G. Email delivery tracking + in-app inbox.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attempts     INT NOT NULL DEFAULT 0;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS last_error   TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS provider_id  TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at      TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS to_account_id INT REFERENCES accounts(id) ON DELETE SET NULL; -- in-app recipient
ALTER TABLE messages ADD COLUMN IF NOT EXISTS from_account_id INT REFERENCES accounts(id) ON DELETE SET NULL;

-- H. Audit log is append-only at the database level too. The FK to accounts is
-- dropped: ON DELETE SET NULL would rewrite audit history (which the trigger
-- rightly forbids). actor_name is stored, so the column alone is sufficient.
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_account_id_fkey;
CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'audit_log is append-only'; END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS audit_log_no_update ON audit_log;
CREATE TRIGGER audit_log_no_update BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

CREATE INDEX IF NOT EXISTS idx_messages_to_account ON messages(to_account_id, read_at);
CREATE INDEX IF NOT EXISTS idx_shifts_payroll_export ON shifts(payroll_export_id);

CREATE INDEX IF NOT EXISTS idx_candidates_status   ON candidates(status);
CREATE INDEX IF NOT EXISTS idx_candidates_role     ON candidates(role);
CREATE INDEX IF NOT EXISTS idx_compdocs_candidate  ON compliance_documents(candidate_id);
CREATE INDEX IF NOT EXISTS idx_compdocs_expiry     ON compliance_documents(expiry_date);
CREATE INDEX IF NOT EXISTS idx_vacancies_stage     ON vacancies(stage);
CREATE INDEX IF NOT EXISTS idx_placements_stage    ON placements(stage);
CREATE INDEX IF NOT EXISTS idx_shifts_date         ON shifts(shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_candidate    ON shifts(candidate_id);
CREATE INDEX IF NOT EXISTS idx_shifts_client       ON shifts(client_id);
CREATE INDEX IF NOT EXISTS idx_activities_entity   ON activities(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due           ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_cvmatch_vacancy     ON cv_matches(vacancy_id);
CREATE INDEX IF NOT EXISTS idx_accounts_kind_ref   ON accounts(kind, candidate_id, client_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry     ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_files_owner         ON files(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_registrations_status ON registrations(status);
CREATE INDEX IF NOT EXISTS idx_individuals_client  ON individuals(client_id);
CREATE INDEX IF NOT EXISTS idx_oh_candidate        ON oh_records(candidate_id);
CREATE INDEX IF NOT EXISTS idx_availability_date   ON availability(date);
CREATE INDEX IF NOT EXISTS idx_availability_cand   ON availability(candidate_id, date);
CREATE INDEX IF NOT EXISTS idx_requests_client     ON shift_requests(client_id, date);
CREATE INDEX IF NOT EXISTS idx_requests_status     ON shift_requests(status);
CREATE INDEX IF NOT EXISTS idx_offers_request      ON offers(request_id);
CREATE INDEX IF NOT EXISTS idx_offers_candidate    ON offers(candidate_id, status);
CREATE INDEX IF NOT EXISTS idx_blocks_candidate    ON candidate_blocks(candidate_id);
CREATE INDEX IF NOT EXISTS idx_shifts_request      ON shifts(request_id);
CREATE INDEX IF NOT EXISTS idx_shifts_individual   ON shifts(individual_id);
CREATE INDEX IF NOT EXISTS idx_tsqueries_shift     ON timesheet_queries(shift_id);
CREATE INDEX IF NOT EXISTS idx_invoice_client      ON invoices(client_id, status);
CREATE INDEX IF NOT EXISTS idx_invlines_invoice    ON invoice_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_messages_created    ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_entity        ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created       ON audit_log(created_at);
