-- ─────────────────────────────────────────────────────────────────────────────
-- HEARTH — Full Database Schema
-- Run this in your Supabase SQL editor to set up all tables
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── CORE ────────────────────────────────────────────────────────────────────

CREATE TABLE households (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  address     TEXT,
  country     TEXT,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE household_members (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id  UUID REFERENCES households(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id),
  role          TEXT DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(household_id, user_id)
);

-- ─── MODULE 1: DOCUMENTS ─────────────────────────────────────────────────────

CREATE TABLE documents (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id    UUID REFERENCES households(id) ON DELETE CASCADE,
  uploaded_by     UUID REFERENCES auth.users(id),
  member_name     TEXT,                          -- which family member this belongs to
  file_url        TEXT,
  file_name       TEXT,
  document_type   TEXT,                          -- passport, insurance, warranty, etc.
  title           TEXT,
  issuer          TEXT,
  holder_name     TEXT,
  issue_date      DATE,
  expiry_date     DATE,
  document_number TEXT,
  key_fields      JSONB DEFAULT '{}',
  summary         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE document_alerts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id        UUID REFERENCES households(id) ON DELETE CASCADE,
  document_id         UUID REFERENCES documents(id) ON DELETE CASCADE,
  urgency             TEXT CHECK (urgency IN ('upcoming', 'urgent', 'critical', 'expired')),
  message             TEXT,
  days_until_expiry   INT,
  sent_at             TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(document_id, urgency)
);

-- ─── MODULE 2: BILLS ─────────────────────────────────────────────────────────

CREATE TABLE bills (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id    UUID REFERENCES households(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  category        TEXT,                          -- utilities, subscriptions, insurance, etc.
  amount          DECIMAL(10,2),
  currency        TEXT DEFAULT 'USD',
  billing_cycle   TEXT DEFAULT 'monthly',        -- monthly, annual, weekly
  next_due_date   DATE,
  provider        TEXT,
  notes           TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bill_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bill_id     UUID REFERENCES bills(id) ON DELETE CASCADE,
  amount      DECIMAL(10,2),
  period      TEXT,                              -- e.g. "2026-04"
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE savings_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id    UUID REFERENCES households(id) ON DELETE CASCADE,
  bill_id         UUID REFERENCES bills(id),
  amount_saved    DECIMAL(10,2),
  description     TEXT,
  achieved_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── MODULE 3: GROCERY ───────────────────────────────────────────────────────

CREATE TABLE household_preferences (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id        UUID REFERENCES households(id) ON DELETE CASCADE UNIQUE,
  household_size      INT DEFAULT 2,
  weekly_budget       DECIMAL(10,2),
  currency            TEXT DEFAULT 'USD',
  dietary_restrictions TEXT[],                   -- ['vegetarian', 'gluten-free', etc.]
  cuisine_preferences TEXT[],
  disliked_ingredients TEXT[],
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE meal_plans (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id  UUID REFERENCES households(id) ON DELETE CASCADE,
  week_start    DATE,
  plan_data     JSONB,                           -- full 7-day plan with meals + recipes
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE shopping_lists (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id  UUID REFERENCES households(id) ON DELETE CASCADE,
  meal_plan_id  UUID REFERENCES meal_plans(id),
  items         JSONB,                           -- [{name, quantity, unit, checked}]
  week_start    DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE waste_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id  UUID REFERENCES households(id) ON DELETE CASCADE,
  item_name     TEXT,
  estimated_value DECIMAL(10,2),
  week_start    DATE,
  logged_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── MODULE 4: MAINTENANCE ───────────────────────────────────────────────────

CREATE TABLE home_profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id    UUID REFERENCES households(id) ON DELETE CASCADE UNIQUE,
  property_type   TEXT,                          -- apartment, house, etc.
  year_built      INT,
  appliances      JSONB DEFAULT '[]',            -- [{name, brand, year_installed}]
  vehicles        JSONB DEFAULT '[]',            -- [{make, model, year, mileage}]
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE maintenance_tasks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id    UUID REFERENCES households(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  category        TEXT,                          -- hvac, plumbing, vehicle, appliance, etc.
  frequency_days  INT,                           -- how often in days
  next_due_date   DATE,
  last_done_date  DATE,
  estimated_cost  DECIMAL(10,2),
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE maintenance_history (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id       UUID REFERENCES maintenance_tasks(id) ON DELETE CASCADE,
  completed_at  TIMESTAMPTZ DEFAULT NOW(),
  cost          DECIMAL(10,2),
  notes         TEXT,
  done_by       TEXT                             -- 'self' or tradesperson name
);

CREATE TABLE repair_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id  UUID REFERENCES households(id) ON DELETE CASCADE,
  title         TEXT,
  description   TEXT,
  photo_url     TEXT,
  ai_diagnosis  TEXT,
  ai_fix        TEXT,
  status        TEXT DEFAULT 'open',             -- open, in_progress, resolved
  reported_at   TIMESTAMPTZ DEFAULT NOW(),
  resolved_at   TIMESTAMPTZ
);

-- ─── MODULE 5: HEALTH ────────────────────────────────────────────────────────

CREATE TABLE family_health_profiles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id    UUID REFERENCES households(id) ON DELETE CASCADE,
  member_name     TEXT NOT NULL,
  date_of_birth   DATE,
  blood_type      TEXT,
  allergies       TEXT[],
  chronic_conditions TEXT[],
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE health_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id    UUID REFERENCES households(id) ON DELETE CASCADE,
  member_name     TEXT,
  symptoms        TEXT,
  triage_result   TEXT,                          -- home | pharmacy | gp | emergency
  ai_response     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE medications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id    UUID REFERENCES households(id) ON DELETE CASCADE,
  member_name     TEXT,
  name            TEXT NOT NULL,
  dosage          TEXT,
  frequency       TEXT,
  start_date      DATE,
  end_date        DATE,
  notes           TEXT,
  is_active       BOOLEAN DEFAULT TRUE
);

CREATE TABLE health_reminders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id    UUID REFERENCES households(id) ON DELETE CASCADE,
  member_name     TEXT,
  reminder_type   TEXT,                          -- medication | appointment | checkup
  title           TEXT,
  due_at          TIMESTAMPTZ,
  is_sent         BOOLEAN DEFAULT FALSE
);

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────────
-- Users can only see data belonging to their household

ALTER TABLE households           ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents            ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_alerts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills                ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_history         ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans           ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_lists       ENABLE ROW LEVEL SECURITY;
ALTER TABLE waste_log            ENABLE ROW LEVEL SECURITY;
ALTER TABLE home_profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_tasks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_health_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications          ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_reminders     ENABLE ROW LEVEL SECURITY;

-- Helper function: get user's household_id
CREATE OR REPLACE FUNCTION get_my_household_id()
RETURNS UUID AS $$
  SELECT household_id FROM household_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Apply policy to all tables
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'documents', 'document_alerts', 'bills', 'bill_history',
    'savings_log', 'household_preferences', 'meal_plans',
    'shopping_lists', 'waste_log', 'home_profiles',
    'maintenance_tasks', 'maintenance_history', 'repair_log',
    'family_health_profiles', 'health_events', 'medications', 'health_reminders'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY "household_access" ON %I
       FOR ALL USING (household_id = get_my_household_id())', t
    );
  END LOOP;
END $$;

-- Household members policy
CREATE POLICY "members_access" ON household_members
  FOR ALL USING (user_id = auth.uid() OR household_id = get_my_household_id());

-- Households policy
CREATE POLICY "households_access" ON households
  FOR ALL USING (id = get_my_household_id());

-- ─── STORAGE BUCKET ──────────────────────────────────────────────────────────
-- Run this separately in Supabase dashboard > Storage > New bucket
-- Name: documents
-- Public: false (private encrypted storage)
