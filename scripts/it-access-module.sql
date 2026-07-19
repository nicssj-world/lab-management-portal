-- IT Module — HIS & LIS Access Rights Register (Fm-QP-LAB-24/01) + Downtime + Backup logs
-- Run in Supabase Dashboard → SQL Editor

-- ── 1. Information systems (HIS, Cobas Infinity, SMART-LIMS, AI-LIS, M-Lab) ──
CREATE TABLE IF NOT EXISTS it_systems (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL UNIQUE,
  is_active     boolean NOT NULL DEFAULT true,
  display_order integer,
  created_at    timestamptz DEFAULT now()
);

-- ── 2. Access-rights register (one row per person; name/position/HIS-ID join from profiles) ──
CREATE TABLE IF NOT EXISTS it_access_records (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  lis_user_id       text,                             -- e.g. 'L9495' (HIS ID uses profiles.ephis_id)
  can_register      boolean NOT NULL DEFAULT false,   -- ลงทะเบียน / รับตัวอย่าง (combined column on the form)
  can_view_result   boolean NOT NULL DEFAULT false,   -- ดูรายงานผล
  can_report_result boolean NOT NULL DEFAULT false,   -- รายงานผล
  can_verify_result boolean NOT NULL DEFAULT false,   -- ตรวจสอบผล
  can_edit_result   boolean NOT NULL DEFAULT false,   -- แก้ไขผล
  can_set_parameter boolean NOT NULL DEFAULT false,   -- Setting parameter
  can_admin_setting boolean NOT NULL DEFAULT false,   -- Admin setting
  system_ids        uuid[] NOT NULL DEFAULT '{}',     -- → it_systems.id (คอลัมน์หมายเหตุ)
  display_order     integer,
  created_at        timestamptz DEFAULT now(),
  created_by        uuid REFERENCES profiles(id)
);

-- ── 3. Annual review log (whole-register review → approval, matching the signed paper form) ──
CREATE TABLE IF NOT EXISTS it_access_reviews (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewed_at      timestamptz NOT NULL DEFAULT now(),
  reviewed_by      uuid REFERENCES profiles(id),
  reviewed_by_name text NOT NULL,
  note             text,
  approved_at      timestamptz,                       -- null = ยังไม่อนุมัติ
  approved_by      uuid REFERENCES profiles(id),
  approved_by_name text,
  created_at       timestamptz DEFAULT now()
);

-- ── 4. System downtime log ──
CREATE TABLE IF NOT EXISTS it_downtime_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id        uuid NOT NULL REFERENCES it_systems(id),
  started_at       timestamptz NOT NULL,
  ended_at         timestamptz,                       -- null = ยังไม่กลับมาใช้งาน
  cause            text,
  resolution       text,
  used_contingency boolean NOT NULL DEFAULT false,    -- ใช้แผนสำรอง
  created_at       timestamptz DEFAULT now(),
  created_by       uuid REFERENCES profiles(id)
);

-- ── 5. Backup / restore-test log ──
CREATE TABLE IF NOT EXISTS it_backup_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id    uuid NOT NULL REFERENCES it_systems(id),
  log_date     date NOT NULL,
  activity     text NOT NULL DEFAULT 'backup' CHECK (activity IN ('backup', 'restore_test')),
  result       text NOT NULL DEFAULT 'success' CHECK (result IN ('success', 'failed')),
  performed_by uuid REFERENCES profiles(id),
  note         text,
  created_at   timestamptz DEFAULT now(),
  created_by   uuid REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS it_downtime_system_idx ON it_downtime_logs(system_id);
CREATE INDEX IF NOT EXISTS it_downtime_started_idx ON it_downtime_logs(started_at);
CREATE INDEX IF NOT EXISTS it_backup_system_idx ON it_backup_logs(system_id);
CREATE INDEX IF NOT EXISTS it_backup_date_idx ON it_backup_logs(log_date);

-- ── RLS: read for authenticated, write via service role only ──
ALTER TABLE it_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE it_access_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE it_access_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE it_downtime_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE it_backup_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "it_systems_select"        ON it_systems        FOR SELECT TO authenticated USING (true);
CREATE POLICY "it_access_records_select" ON it_access_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "it_access_reviews_select" ON it_access_reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "it_downtime_logs_select"  ON it_downtime_logs  FOR SELECT TO authenticated USING (true);
CREATE POLICY "it_backup_logs_select"    ON it_backup_logs    FOR SELECT TO authenticated USING (true);

-- ── Seed the five information systems ──
INSERT INTO it_systems (name, display_order) VALUES
  ('HIS', 1), ('Cobas Infinity', 2), ('SMART-LIMS', 3), ('AI-LIS', 4), ('M-Lab', 5)
ON CONFLICT (name) DO NOTHING;
