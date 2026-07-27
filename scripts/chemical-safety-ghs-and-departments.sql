-- GHS ระดับสารเคมี, คลังเอกสาร SDS แยกตามงาน, ผังการจัดเก็บ และการแก้บั๊ก H/P statement
-- รันหลัง scripts/chemical-safety-module.sql
BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. GHS ระดับสารเคมี
--
-- มาจากคอลัมน์ "ประเภทของสารเคมี (ตามระบบ GHS)" ใน Unit Chemical Inventory List
-- เก็บที่ระดับ product เพราะเป็นข้อมูลของสารเคมี ไม่ใช่ของเอกสาร SDS ฉบับใดฉบับหนึ่ง
-- เวลาแสดงผล: GHS จาก SDS ฉบับที่อนุมัติแล้วชนะเสมอ ค่านี้เป็น fallback
--
-- ตั้งใจไม่เพิ่มคีย์เหล่านี้เข้า product_keys ของ review_chemical_change_request
-- เพราะ RPC นั้นบังคับ ?& product_keys ครบทุกคีย์ การเพิ่มจะทำให้ draft ที่ค้างอยู่ใช้ไม่ได้ทั้งหมด
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.chemical_products
  ADD COLUMN IF NOT EXISTS ghs_source_text text,
  ADD COLUMN IF NOT EXISTS ghs_pictogram_codes text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS ghs_hazard_classes jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.chemical_products
  DROP CONSTRAINT IF EXISTS chemical_products_ghs_pictograms_valid;
ALTER TABLE public.chemical_products
  ADD CONSTRAINT chemical_products_ghs_pictograms_valid CHECK (
    ghs_pictogram_codes <@ ARRAY[
      'GHS01','GHS02','GHS03','GHS04','GHS05','GHS06','GHS07','GHS08','GHS09'
    ]::text[]
  );

-- Postgres ห้าม subquery ตรง ๆ ใน CHECK constraint (ต่างจาก WHERE ธรรมดา)
-- ต้องซ่อนไว้ในฟังก์ชันเสมอ — รูปแบบเดียวกับ chemical_sds_statements_valid ด้านล่าง
CREATE OR REPLACE FUNCTION public.chemical_ghs_hazard_classes_valid(
  p_hazard_classes jsonb
) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_typeof(p_hazard_classes) = 'array'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_hazard_classes) AS hazard
      WHERE jsonb_typeof(hazard) <> 'object'
        OR NOT hazard ?& ARRAY['class_th','class_en']
        OR EXISTS (
          SELECT 1 FROM jsonb_object_keys(hazard) AS hazard_key(key)
          WHERE key NOT IN ('class_th','class_en')
        )
        OR jsonb_typeof(hazard->'class_th') <> 'string'
        OR jsonb_typeof(hazard->'class_en') <> 'string'
        OR nullif(btrim(hazard->>'class_th'), '') IS NULL
        OR nullif(btrim(hazard->>'class_en'), '') IS NULL
    );
$$;

ALTER TABLE public.chemical_products
  DROP CONSTRAINT IF EXISTS chemical_products_ghs_hazard_classes_valid;
ALTER TABLE public.chemical_products
  ADD CONSTRAINT chemical_products_ghs_hazard_classes_valid
    CHECK (public.chemical_ghs_hazard_classes_valid(ghs_hazard_classes));

REVOKE ALL ON FUNCTION public.chemical_ghs_hazard_classes_valid(jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chemical_ghs_hazard_classes_valid(jsonb)
  TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. แก้บั๊กรูปแบบรหัส H/P statement
--
-- นิยามเดิมบังคับ ^H[0-9]{3}$ / ^P[0-9]{3}$ แต่ zod ใน lib/chemical-safety/schemas.ts
-- ยอมรับ H350i (รหัสที่มีตัวอักษรต่อท้าย) และ P301+P310 (รหัสรวม ซึ่งพบบ่อยมากใน SDS จริง)
-- ผลคือทุกครั้งที่มีคนกรอกรหัสรวม การบันทึกจะล้มด้วย constraint violation
-- ─────────────────────────────────────────────────────────────────────────────
-- ชื่อ constraint ถูกสร้างอัตโนมัติตอน CREATE TABLE จึงไม่เดาชื่อ
-- แต่ค้นหาทุก CHECK บนตารางที่เรียกฟังก์ชันนี้แล้วลบทิ้ง
DO $$
DECLARE constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.chemical_sds_versions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%chemical_sds_statements_valid%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.chemical_sds_versions DROP CONSTRAINT %I', constraint_name
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.chemical_sds_statements_valid(
  p_statements jsonb, p_prefix text
) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_typeof(p_statements) = 'array'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_statements) AS statement
      WHERE jsonb_typeof(statement) <> 'object'
        OR NOT statement ?& ARRAY['code','text']
        OR EXISTS (
          SELECT 1 FROM jsonb_object_keys(statement) AS statement_key(key)
          WHERE key NOT IN ('code','text')
        )
        OR jsonb_typeof(statement->'code') <> 'string'
        OR jsonb_typeof(statement->'text') <> 'string'
        OR statement->>'code' !~ (
          CASE
            -- H350i, H360FD: รหัสอันตรายที่มีตัวอักษรระบุผลกระทบต่อท้าย
            WHEN p_prefix = 'H' THEN '^H[0-9]{3}[A-Za-z]{0,2}$'
            -- P301+P310, P303+P361+P353: ข้อควรปฏิบัติแบบรวม
            ELSE '^P[0-9]{3}(\+P?[0-9]{3})*$'
          END
        )
        OR nullif(btrim(statement->>'text'), '') IS NULL
    );
$$;

ALTER TABLE public.chemical_sds_versions
  ADD CONSTRAINT chemical_sds_versions_h_statements_check
    CHECK (public.chemical_sds_statements_valid(h_statements, 'H')),
  ADD CONSTRAINT chemical_sds_versions_p_statements_check
    CHECK (public.chemical_sds_statements_valid(p_statements, 'P'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ห้องเก็บสารเคมีและผังตู้
--
-- ชื่อห้องใน seed เดิมคือ "ห้องเตรียมสารเคมี" แต่ทั้ง master list และผังเรียก "ห้องเก็บสารเคมี"
-- และ materializer ก็ใช้ชื่อหลัง ทำให้ upsert ทับกันไปมา
-- display_geometry คือพิกัดบนผัง: A/T แถวบน, B แถวกลาง, C แถวล่าง
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE public.chemical_rooms
SET name_th = 'ห้องเก็บสารเคมี', updated_at = now()
WHERE code = 'chemical-prep' AND name_th IS DISTINCT FROM 'ห้องเก็บสารเคมี';

UPDATE public.chemical_storage_locations AS location
SET display_geometry = geometry.value
FROM (VALUES
  ('A1', '{"row":1,"col":1}'::jsonb), ('A2', '{"row":1,"col":2}'::jsonb),
  ('T1', '{"row":1,"col":3}'::jsonb), ('T2', '{"row":1,"col":4}'::jsonb),
  ('B1', '{"row":2,"col":1}'::jsonb), ('B2', '{"row":2,"col":2}'::jsonb),
  ('B3', '{"row":2,"col":3}'::jsonb), ('B4', '{"row":2,"col":4}'::jsonb),
  ('C1', '{"row":3,"col":1}'::jsonb), ('C2', '{"row":3,"col":2}'::jsonb),
  ('C3', '{"row":3,"col":3}'::jsonb), ('C4', '{"row":3,"col":4}'::jsonb),
  ('C5', '{"row":3,"col":5}'::jsonb)
) AS geometry(code, value)
WHERE location.code = geometry.code
  AND location.room_id = (SELECT id FROM public.chemical_rooms WHERE code = 'chemical-prep');

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. คลังเอกสาร SDS แยกตามงาน
--
-- โฟลเดอร์งานในคลัง MSDS 2568 เก็บ SDS ของน้ำยาและชุดตรวจเชิงพาณิชย์ ซึ่งไม่ใช่รายการ
-- คลังสารเคมีของห้องเก็บสารเคมี จึงแยกตารางออกจาก chemical_products อย่างเด็ดขาด
-- การเผยแพร่ทำทั้งงานพร้อมกันโดยหัวหน้างาน ไม่ใช่ทีละไฟล์
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chemical_sds_departments (
  code text PRIMARY KEY,
  department text NOT NULL UNIQUE,
  archive_folder text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  published_by uuid REFERENCES public.profiles(id),
  published_at timestamptz,
  display_order integer NOT NULL DEFAULT 1 CHECK (display_order > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chemical_sds_department_publication_coherent CHECK (
    (status = 'draft' AND published_by IS NULL AND published_at IS NULL)
    OR (status = 'published' AND published_by IS NOT NULL AND published_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.chemical_department_sds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- URL สาธารณะอ้าง public_id เท่านั้น ไม่เคยเปิด file_id หรือ r2_key
  public_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  department_code text NOT NULL REFERENCES public.chemical_sds_departments(code)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  file_id uuid NOT NULL REFERENCES public.chemical_sds_files(id) ON DELETE RESTRICT,
  source_path text NOT NULL,
  display_name text NOT NULL CHECK (nullif(btrim(display_name), '') IS NOT NULL),
  -- true = มีคนแก้ชื่อด้วยมือแล้ว การ backfill รอบถัดไปต้องไม่เขียนทับ
  display_name_edited boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (department_code, file_id)
);

CREATE INDEX IF NOT EXISTS idx_chemical_department_sds_department
  ON public.chemical_department_sds(department_code);

INSERT INTO public.chemical_sds_departments (code, department, archive_folder, display_order)
VALUES
  ('chemistry', 'งานเคมีคลินิก', 'งานเคมีคลินิก', 1),
  ('hematology', 'งานโลหิตวิทยาคลินิก', 'งานโลหิตวิทยาคลินิก', 2),
  ('immunology', 'งานภูมิคุ้มกันวิทยาคลินิก', 'งานภูมิคุ้มกันวิทยา', 3),
  ('microscopy', 'งานจุลทรรศนศาสตร์คลินิก', 'งานจุลทรรศนศาสตร์', 4),
  ('biomolecular', 'งานอณูชีววิทยา', 'งานอณูชีววิทยา', 5),
  ('microbiology', 'งานจุลชีววิทยา', 'งานจุลชีววิทยา', 6),
  ('blood-bank', 'งานคลังเลือด', 'งานคลังเลือด', 7),
  ('special-test', 'งานตรวจพิเศษและห้องปฏิบัติการตรวจต่อ', 'งานตรวจพิเศษและห้องปฏิบัติการตรวจต่อ', 8),
  ('outpatient', 'งานบริการผู้ป่วยนอก', 'งานบริการผู้ป่วยนอก', 9),
  ('chonburi-pcu', 'ห้องปฏิบัติการศูนย์สุขภาพชุมชนเมืองชลบุรี', 'ศูนย์สุขภาพชุมชนเมืองชลบุรี', 10)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.chemical_sds_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chemical_department_sds ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.chemical_sds_departments, public.chemical_department_sds
  FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.chemical_sds_departments, public.chemical_department_sds
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
