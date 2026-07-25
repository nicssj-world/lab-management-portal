-- Digital laboratory map metadata, controlled releases, and personnel assignments.
-- Geometry remains versioned in Git; this schema stores stable codes and editable relationships.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS lab_map_spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_th text NOT NULL,
  infection_class text NOT NULL CHECK (infection_class IN ('infectious', 'clean', 'risk')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lab_map_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_th text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lab_map_zone_spaces (
  zone_id uuid NOT NULL REFERENCES lab_map_zones(id) ON DELETE CASCADE,
  space_id uuid NOT NULL REFERENCES lab_map_spaces(id) ON DELETE CASCADE,
  PRIMARY KEY (zone_id, space_id)
);

CREATE TABLE IF NOT EXISTS lab_map_space_work_units (
  space_id uuid NOT NULL REFERENCES lab_map_spaces(id) ON DELETE CASCADE,
  work_unit text NOT NULL,
  PRIMARY KEY (space_id, work_unit)
);

CREATE TABLE IF NOT EXISTS lab_map_access_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_th text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('fingerprint', 'door', 'exit')),
  status text NOT NULL CHECK (status IN ('open', 'fingerprint_controlled', 'permanently_locked')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lab_map_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_th text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lab_map_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'retired')),
  manifest_hash text NOT NULL CHECK (manifest_hash ~ '^[a-f0-9]{64}$'),
  effective_date date,
  reviewed_by uuid REFERENCES profiles(id),
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  notes text,
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS lab_map_one_published_version_idx
  ON lab_map_versions ((status)) WHERE status = 'published';

CREATE TABLE IF NOT EXISTS lab_map_person_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  space_id uuid REFERENCES lab_map_spaces(id) ON DELETE CASCADE,
  zone_id uuid REFERENCES lab_map_zones(id) ON DELETE CASCADE,
  assignment_type text NOT NULL CHECK (assignment_type IN ('primary', 'responsible')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lab_map_person_assignment_one_target CHECK (num_nonnulls(space_id, zone_id) = 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS lab_map_person_assignment_space_unique
  ON lab_map_person_assignments(profile_id, assignment_type, space_id) WHERE space_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS lab_map_person_assignment_zone_unique
  ON lab_map_person_assignments(profile_id, assignment_type, zone_id) WHERE zone_id IS NOT NULL;

ALTER TABLE lab_map_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_map_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_map_zone_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_map_space_work_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_map_access_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_map_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_map_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_map_person_assignments ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies: all reads and writes go through permission-filtered server code.
REVOKE ALL ON lab_map_spaces, lab_map_zones, lab_map_zone_spaces,
  lab_map_space_work_units, lab_map_access_points, lab_map_stations,
  lab_map_versions, lab_map_person_assignments FROM anon, authenticated;

INSERT INTO lab_map_spaces (code, name_th, infection_class) VALUES
  ('office', 'สำนักงานกลุ่มงานเทคนิคการแพทย์', 'clean'),
  ('group-head-office', 'ห้องหัวหน้ากลุ่มงานเทคนิคการแพทย์', 'clean'),
  ('meeting-room', 'ห้องประชุม', 'clean'),
  ('central-lab-left', 'ห้องปฏิบัติการกลาง — ฝั่งซ้าย', 'infectious'),
  ('central-lab-right', 'ห้องปฏิบัติการกลาง — ฝั่งขวา', 'infectious'),
  ('clinical-immunology-room', 'ห้องปฏิบัติการภูมิคุ้มกันวิทยาคลินิก', 'infectious'),
  ('molecular-biology-lab', 'ห้องปฏิบัติการอณูชีววิทยา', 'infectious'),
  ('genomics-lab', 'ห้องปฏิบัติการจีโนมิกส์', 'infectious'),
  ('microbiology-lab', 'ห้องปฏิบัติการจุลชีววิทยาคลินิก', 'infectious'),
  ('infectious-diagnosis-room', 'ห้องวินิจฉัยเชื้อ', 'infectious'),
  ('bsl2-enhance', 'BSL2 Enhance', 'infectious'),
  ('pcr-room', 'ห้อง PCR', 'infectious'),
  ('culture-media-prep', 'ห้องเตรียมอาหารเลี้ยงเชื้อ', 'infectious'),
  ('specimen-prep', 'ห้องเตรียมตัวอย่าง', 'infectious'),
  ('material-store', 'คลังวัสดุ', 'clean'),
  ('material-reagent-store', 'คลังวัสดุและน้ำยา', 'clean'),
  ('cold-material-reagent-store', 'ห้องเก็บวัสดุและน้ำยาแช่เย็น', 'clean'),
  ('special-testing-lab', 'ห้องปฏิบัติการตรวจพิเศษ', 'infectious'),
  ('blood-donation-room', 'ห้องรับบริจาคเลือด', 'infectious'),
  ('blood-component-room', 'ห้องแยกส่วนประกอบของเลือด', 'infectious'),
  ('blood-prep-room', 'ห้องเตรียมเลือด', 'infectious'),
  ('ppe-zone', 'โซน PPE', 'clean'),
  ('equipment-wash', 'ห้องล้างอุปกรณ์', 'infectious'),
  ('chemical-prep', 'ห้องเตรียมสารเคมี', 'risk'),
  ('electrical-control', 'ห้องควบคุมไฟฟ้า', 'clean'),
  ('computer-control', 'ห้องควบคุมระบบคอมพิวเตอร์', 'clean')
ON CONFLICT (code) DO UPDATE SET
  name_th = EXCLUDED.name_th,
  infection_class = EXCLUDED.infection_class,
  updated_at = now();

INSERT INTO lab_map_zones (code, name_th) VALUES
  ('central-lab', 'ห้องปฏิบัติการกลาง (Central Lab)'),
  ('central-lab-left-zone', 'Central Lab ฝั่งซ้าย'),
  ('central-lab-right-zone', 'Central Lab ฝั่งขวา'),
  ('microbiology-zone', 'พื้นที่งานจุลชีววิทยา'),
  ('storage-zone', 'โซนคลังวัสดุ'),
  ('blood-bank-zone', 'พื้นที่งานคลังเลือด'),
  ('molecular-zone', 'พื้นที่งานอณูชีววิทยา')
ON CONFLICT (code) DO UPDATE SET name_th = EXCLUDED.name_th, updated_at = now();

INSERT INTO lab_map_zone_spaces (zone_id, space_id)
SELECT z.id, s.id FROM (VALUES
  ('central-lab','central-lab-left'), ('central-lab','central-lab-right'),
  ('central-lab-left-zone','central-lab-left'), ('central-lab-right-zone','central-lab-right'),
  ('microbiology-zone','bsl2-enhance'), ('microbiology-zone','pcr-room'),
  ('microbiology-zone','culture-media-prep'), ('microbiology-zone','specimen-prep'),
  ('microbiology-zone','microbiology-lab'), ('microbiology-zone','infectious-diagnosis-room'),
  ('microbiology-zone','material-store'), ('microbiology-zone','material-reagent-store'),
  ('microbiology-zone','cold-material-reagent-store'),
  ('storage-zone','material-store'), ('storage-zone','material-reagent-store'),
  ('storage-zone','cold-material-reagent-store'),
  ('blood-bank-zone','blood-donation-room'), ('blood-bank-zone','blood-component-room'),
  ('blood-bank-zone','blood-prep-room'),
  ('molecular-zone','molecular-biology-lab'), ('molecular-zone','genomics-lab')
) AS seed(zone_code, space_code)
JOIN lab_map_zones z ON z.code = seed.zone_code
JOIN lab_map_spaces s ON s.code = seed.space_code
ON CONFLICT DO NOTHING;

INSERT INTO lab_map_access_points (code, name_th, kind, status) VALUES
  ('fingerprint-central-left', 'จุดสแกนนิ้วมือ Central Lab ฝั่งซ้าย', 'fingerprint', 'fingerprint_controlled'),
  ('fingerprint-molecular', 'จุดสแกนนิ้วมืองานอณูชีววิทยา', 'fingerprint', 'fingerprint_controlled'),
  ('fingerprint-central-right', 'จุดสแกนนิ้วมือ Central Lab ฝั่งขวา', 'fingerprint', 'fingerprint_controlled'),
  ('fingerprint-microbiology', 'จุดสแกนนิ้วมืองานจุลชีววิทยา', 'fingerprint', 'fingerprint_controlled'),
  ('fingerprint-special-testing', 'จุดสแกนนิ้วมืองานตรวจพิเศษ', 'fingerprint', 'fingerprint_controlled'),
  ('fingerprint-blood-bank', 'จุดสแกนนิ้วมืองานคลังเลือด', 'fingerprint', 'fingerprint_controlled'),
  ('fingerprint-office', 'จุดสแกนนิ้วมือสำนักงานกลุ่มงานฯ', 'fingerprint', 'fingerprint_controlled'),
  ('door-central-left', 'ประตู Central Lab ฝั่งซ้าย', 'door', 'open'),
  ('door-central-right', 'ประตู Central Lab ฝั่งขวา', 'door', 'open'),
  ('door-electrical-control', 'ประตูห้องควบคุมไฟฟ้า (ล็อคถาวร)', 'door', 'permanently_locked'),
  ('exit-3a', 'ทางออก 3A', 'exit', 'open'), ('exit-3b', 'ทางออก 3B', 'exit', 'open'),
  ('exit-3c', 'ทางออก 3C', 'exit', 'open')
ON CONFLICT (code) DO UPDATE SET name_th = EXCLUDED.name_th, kind = EXCLUDED.kind,
  status = EXCLUDED.status, updated_at = now();

INSERT INTO lab_map_stations (code, name_th) VALUES
  ('office', 'สำนักงานกลุ่มงานเทคนิคการแพทย์'),
  ('central-corridor', 'โถงหน้าห้องปฏิบัติการกลาง'),
  ('south-corridor', 'โถงทางเดินด้านทิศใต้')
ON CONFLICT (code) DO UPDATE SET name_th = EXCLUDED.name_th, updated_at = now();

CREATE OR REPLACE FUNCTION publish_lab_map_release(
  p_release_id uuid,
  p_manifest_hash text,
  p_actor_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE target lab_map_versions%ROWTYPE;
BEGIN
  LOCK TABLE lab_map_versions IN SHARE ROW EXCLUSIVE MODE;
  SELECT * INTO target FROM lab_map_versions WHERE id = p_release_id FOR UPDATE;
  IF NOT FOUND OR target.status <> 'draft' THEN RAISE EXCEPTION 'release_not_draft'; END IF;
  IF target.manifest_hash <> p_manifest_hash THEN RAISE EXCEPTION 'manifest_hash_mismatch'; END IF;
  IF target.effective_date IS NULL OR target.reviewed_by IS NULL OR target.approved_by IS NULL THEN
    RAISE EXCEPTION 'release_metadata_incomplete';
  END IF;
  IF target.reviewed_by = target.approved_by THEN RAISE EXCEPTION 'reviewer_must_differ'; END IF;
  UPDATE lab_map_versions SET status = 'retired', updated_at = now() WHERE status = 'published';
  UPDATE lab_map_versions SET status = 'published', approved_at = now(), updated_at = now()
    WHERE id = p_release_id;
  RETURN jsonb_build_object('id', p_release_id, 'status', 'published', 'approvedByActor', p_actor_id);
END;
$$;

REVOKE ALL ON FUNCTION publish_lab_map_release(uuid,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION publish_lab_map_release(uuid,text,uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
