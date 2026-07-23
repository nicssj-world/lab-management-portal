-- MT-CBH Staff / Personnel Module — Health & Confidentiality
-- (Staff health/immunization records + signed confidentiality agreements — ISO 15189 6.2)
-- Run via Supabase Dashboard → SQL Editor. Safe to re-run.

-- ============================================================
-- Health / immunization records (ISO 6.2 — staff health)
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_health_records (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  record_type   text DEFAULT 'vaccination' CHECK (record_type IN ('vaccination', 'health_check', 'other')),
  name          text NOT NULL,                 -- e.g. "วัคซีน HBV เข็ม 3", "ตรวจสุขภาพประจำปี"
  record_date   date,
  next_due_date date,                          -- optional; drives the near-expiry reminder colour
  result        text,
  evidence_url  text,                          -- staff-files bucket path
  notes         text,
  created_at    timestamptz DEFAULT now(),
  created_by    uuid REFERENCES profiles(id),
  deleted_at    timestamptz
);
CREATE INDEX IF NOT EXISTS staff_health_records_profile_idx  ON staff_health_records(profile_id);
CREATE INDEX IF NOT EXISTS staff_health_records_next_due_idx ON staff_health_records(next_due_date);

-- ============================================================
-- Confidentiality agreements (ISO 6.2 — signed confidentiality)
-- One row per signing; a staff member may re-sign over the years.
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_confidentiality_agreements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  signed_date date,
  file_url    text,                            -- signed PDF/image, staff-files bucket path
  notes       text,
  created_at  timestamptz DEFAULT now(),
  created_by  uuid REFERENCES profiles(id),
  deleted_at  timestamptz
);
CREATE INDEX IF NOT EXISTS staff_confidentiality_profile_idx ON staff_confidentiality_agreements(profile_id);

-- ============================================================
-- RLS (writes go through service role only)
-- ============================================================
ALTER TABLE staff_health_records            ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_confidentiality_agreements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_health_records_select" ON staff_health_records;
DROP POLICY IF EXISTS "staff_confidentiality_select" ON staff_confidentiality_agreements;
REVOKE SELECT ON TABLE staff_health_records, staff_confidentiality_agreements FROM anon, authenticated;
