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
