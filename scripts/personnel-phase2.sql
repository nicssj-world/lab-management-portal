-- MT-CBH Staff / Personnel Module — Phase 2
-- (JD/JS, Training Plan, Orientation, Peer-assessment sign-off)
-- Run via Supabase Dashboard → SQL Editor. Safe to re-run.

-- ============================================================
-- Job Descriptions / Job Specifications (ISO 6.2.2)
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_jd (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  jd_code        text,                       -- e.g. FM-JD-001
  position_title text,
  version        text NOT NULL DEFAULT '1',
  content        text,
  file_url       text,                        -- optional attached file (staff-files bucket)
  effective_date date,
  approver_id    uuid REFERENCES profiles(id),
  approver_name  text,
  approver_position text,
  status         text DEFAULT 'Draft' CHECK (status IN ('Draft', 'Active', 'Obsolete')),
  created_at     timestamptz DEFAULT now(),
  created_by     uuid REFERENCES profiles(id),
  updated_at     timestamptz DEFAULT now(),
  deleted_at     timestamptz
);
CREATE INDEX IF NOT EXISTS staff_jd_profile_idx ON staff_jd(profile_id);

CREATE TABLE IF NOT EXISTS staff_jd_revisions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jd_id          uuid NOT NULL REFERENCES staff_jd(id) ON DELETE CASCADE,
  version        text NOT NULL,
  content        text,
  file_url       text,
  effective_date date,
  approver_name  text,
  approver_position text,
  revision_note  text,
  revised_by     uuid REFERENCES profiles(id),
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS staff_jd_revisions_jd_idx ON staff_jd_revisions(jd_id);

ALTER TABLE staff_jd ADD COLUMN IF NOT EXISTS approver_position text;
ALTER TABLE staff_jd_revisions ADD COLUMN IF NOT EXISTS approver_position text;

UPDATE staff_jd
SET approver_position = 'รองผู้อำนวยการด้านพัฒนาระบบบริการและสนับสนุนบริการสุขภาพ'
WHERE approver_position IS NULL
  AND effective_date = DATE '2026-03-09'
  AND approver_name = 'นางเกศสิรี กรสิทธิกุล'
  AND status = 'Active'
  AND deleted_at IS NULL;

-- ============================================================
-- Annual Training Plan (ISO 6.2.4) — based on competency gaps
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_training_plan (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  year        integer NOT NULL,
  topic       text NOT NULL,
  source      text,                            -- e.g. "competency gap", "annual plan"
  status      text DEFAULT 'planned' CHECK (status IN ('planned', 'done', 'cancelled')),
  training_id uuid REFERENCES staff_training(id) ON DELETE SET NULL,  -- link to actual record
  notes       text,
  created_at  timestamptz DEFAULT now(),
  created_by  uuid REFERENCES profiles(id),
  deleted_at  timestamptz
);
CREATE INDEX IF NOT EXISTS staff_training_plan_profile_idx ON staff_training_plan(profile_id);
CREATE INDEX IF NOT EXISTS staff_training_plan_year_idx    ON staff_training_plan(year);

-- ============================================================
-- New-staff Orientation checklist (ISO 6.2.4 / ISO 15190)
-- One row per profile; items stored as JSONB array of { key, label, done }
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_orientation (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  items        jsonb NOT NULL DEFAULT '[]'::jsonb,
  completed_by uuid REFERENCES profiles(id),
  completed_at timestamptz,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- ============================================================
-- Peer-assessment sign-off on competency assessments (ISO 6.2.5)
-- ============================================================
ALTER TABLE staff_competencies ADD COLUMN IF NOT EXISTS assessor_signoff    boolean DEFAULT false;
ALTER TABLE staff_competencies ADD COLUMN IF NOT EXISTS assessor_signoff_at timestamptz;
ALTER TABLE staff_competencies ADD COLUMN IF NOT EXISTS assessee_ack        boolean DEFAULT false;
ALTER TABLE staff_competencies ADD COLUMN IF NOT EXISTS assessee_ack_at     timestamptz;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE staff_jd              ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_jd_revisions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_training_plan   ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_orientation     ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN CREATE POLICY "staff_jd_select" ON staff_jd FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "staff_jd_revisions_select" ON staff_jd_revisions FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "staff_training_plan_select" ON staff_training_plan FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "staff_orientation_select" ON staff_orientation FOR SELECT TO authenticated USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
