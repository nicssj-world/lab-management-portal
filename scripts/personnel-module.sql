-- MT-CBH Staff / Personnel Management Module (ISO 15189:2022 clause 6.2)
-- Run via Supabase Dashboard → SQL Editor. Safe to re-run (IF NOT EXISTS guards).

-- ============================================================
-- A. Extend profiles with personnel-record fields (ISO 6.2.2–6.2.3)
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS position_title    text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS unit              text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS employment_type   text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS start_date        date;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS education         text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mt_license_no     text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mt_license_expiry date;

-- ============================================================
-- B. staff_certifications — licenses / certificates (ISO 6.2.3)
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_certifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cert_type   text,                       -- license | certificate | training-cert | other
  cert_name   text NOT NULL,
  cert_no     text,
  issuer      text,
  issue_date  date,
  expiry_date date,
  file_url    text,                        -- Supabase Storage path (staff-files bucket)
  status      text DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  remark      text,
  created_at  timestamptz DEFAULT now(),
  created_by  uuid REFERENCES profiles(id),
  deleted_at  timestamptz
);
CREATE INDEX IF NOT EXISTS staff_certifications_profile_idx ON staff_certifications(profile_id);
CREATE INDEX IF NOT EXISTS staff_certifications_expiry_idx  ON staff_certifications(expiry_date);

-- ============================================================
-- C. staff_training — training records (ISO 6.2.4)
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_training (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  topic         text NOT NULL,
  training_date date,
  hours         numeric(6, 2),
  provider      text,
  location      text,
  training_type text CHECK (training_type IN ('internal', 'external', 'CME', 'CPD')),
  cpd_credits   numeric(6, 2),
  evidence_url  text,
  notes         text,
  created_at    timestamptz DEFAULT now(),
  created_by    uuid REFERENCES profiles(id),
  deleted_at    timestamptz
);
CREATE INDEX IF NOT EXISTS staff_training_profile_idx ON staff_training(profile_id);
CREATE INDEX IF NOT EXISTS staff_training_date_idx    ON staff_training(training_date);

-- ============================================================
-- D. staff_competencies — competency assessments (ISO 6.2.5)
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_competencies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assessment_type text DEFAULT 'initial' CHECK (assessment_type IN ('initial', 'periodic')),
  area            text,                                  -- free-text competency area
  test_id         integer REFERENCES tests(id) ON DELETE SET NULL,  -- optional link to catalog
  assessor_id     uuid REFERENCES profiles(id),
  assessment_date date,
  next_due_date   date,
  score_knowledge numeric(5, 2),
  score_safety    numeric(5, 2),
  score_practical numeric(5, 2),
  result          text CHECK (result IN ('pass', 'fail')),
  evidence_url    text,
  notes           text,
  created_at      timestamptz DEFAULT now(),
  created_by      uuid REFERENCES profiles(id),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS staff_competencies_profile_idx  ON staff_competencies(profile_id);
CREATE INDEX IF NOT EXISTS staff_competencies_due_idx      ON staff_competencies(next_due_date);
CREATE INDEX IF NOT EXISTS staff_competencies_test_idx     ON staff_competencies(test_id);

-- ============================================================
-- E. staff_authorizations — work assignment / authorization matrix (ISO 6.2.6)
--    test_id NULL  = category-level authorization (use category column)
--    test_id SET   = per-test authorization
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_authorizations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  test_id         integer REFERENCES tests(id) ON DELETE CASCADE,
  category        text,
  role_type       text NOT NULL DEFAULT 'performer'
                  CHECK (role_type IN ('performer', 'reporter', 'approver', 'authorized_signatory', 'deputy')),
  competency_id   uuid REFERENCES staff_competencies(id) ON DELETE SET NULL,
  authorized_date date,
  authorized_by   uuid REFERENCES profiles(id),
  status          text DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  revoked_date    date,
  notes           text,
  created_at      timestamptz DEFAULT now(),
  created_by      uuid REFERENCES profiles(id),
  deleted_at      timestamptz
);
CREATE INDEX IF NOT EXISTS staff_authorizations_profile_idx ON staff_authorizations(profile_id);
CREATE INDEX IF NOT EXISTS staff_authorizations_test_idx    ON staff_authorizations(test_id);

-- ============================================================
-- RLS: read for authenticated, writes via service role only
-- ============================================================
ALTER TABLE staff_certifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_training        ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_competencies    ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_authorizations  ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "staff_certifications_select" ON staff_certifications FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "staff_training_select" ON staff_training FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "staff_competencies_select" ON staff_competencies FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "staff_authorizations_select" ON staff_authorizations FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- Storage bucket for attachments (cert / license / training evidence)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('staff-files', 'staff-files', false)
ON CONFLICT (id) DO NOTHING;
