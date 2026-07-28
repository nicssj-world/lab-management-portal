-- Safety assets, assembly points, release snapshots, and risk locations.
-- Run after scripts/lab-map-module.sql and scripts/risk-module-v2.sql.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.lab_map_safety_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_th text NOT NULL,
  kind text NOT NULL CHECK (kind IN (
    'fire-extinguisher', 'fire-hose', 'manual-call-point', 'aed', 'first-aid-kit',
    'eyewash', 'emergency-shower', 'spill-kit', 'emergency-shutoff'
  )),
  shutoff_for text CHECK (shutoff_for IN ('electricity', 'gas')),
  x numeric(8,2) NOT NULL CHECK (x BETWEEN 0 AND 1477),
  y numeric(8,2) NOT NULL CHECK (y BETWEEN 0 AND 892),
  space_code text REFERENCES public.lab_map_spaces(code) ON UPDATE CASCADE ON DELETE SET NULL,
  source_note_th text,
  position_status text NOT NULL DEFAULT 'unverified' CHECK (position_status IN ('unverified', 'verified')),
  lifecycle_status text NOT NULL DEFAULT 'active' CHECK (lifecycle_status IN ('active', 'retired')),
  position_verified_by uuid REFERENCES public.profiles(id),
  position_verified_at timestamptz,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT safety_asset_shutoff_kind CHECK (
    (kind = 'emergency-shutoff' AND shutoff_for IS NOT NULL)
    OR (kind <> 'emergency-shutoff' AND shutoff_for IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_lab_map_safety_assets_status
  ON public.lab_map_safety_assets(lifecycle_status, position_status);
CREATE INDEX IF NOT EXISTS idx_lab_map_safety_assets_space
  ON public.lab_map_safety_assets(space_code);
CREATE INDEX IF NOT EXISTS idx_lab_map_safety_assets_verified_by
  ON public.lab_map_safety_assets(position_verified_by);
CREATE INDEX IF NOT EXISTS idx_lab_map_safety_assets_created_by
  ON public.lab_map_safety_assets(created_by);

CREATE TABLE IF NOT EXISTS public.lab_map_safety_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.lab_map_safety_assets(id) ON DELETE RESTRICT,
  result text NOT NULL CHECK (result IN ('passed', 'needs_attention', 'failed', 'not_found')),
  inspected_on date NOT NULL,
  next_inspection_date date,
  expires_on date,
  note text,
  photo_r2_key text NOT NULL UNIQUE,
  photo_file_name text NOT NULL,
  photo_content_type text NOT NULL CHECK (photo_content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  photo_size_bytes bigint NOT NULL CHECK (photo_size_bytes > 0 AND photo_size_bytes <= 10485760),
  inspected_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lab_map_safety_inspections_asset
  ON public.lab_map_safety_inspections(asset_id, inspected_on DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lab_map_safety_inspections_actor
  ON public.lab_map_safety_inspections(inspected_by);

CREATE TABLE IF NOT EXISTS public.lab_map_safety_inspection_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_th text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  filter_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_by uuid NOT NULL REFERENCES public.profiles(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid REFERENCES public.profiles(id),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lab_map_safety_inspection_round_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.lab_map_safety_inspection_rounds(id) ON DELETE RESTRICT,
  asset_id uuid NOT NULL REFERENCES public.lab_map_safety_assets(id) ON DELETE RESTRICT,
  sequence_no integer NOT NULL CHECK (sequence_no > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
  inspection_id uuid REFERENCES public.lab_map_safety_inspections(id) ON DELETE RESTRICT,
  completed_at timestamptz,
  UNIQUE (round_id, asset_id),
  UNIQUE (round_id, sequence_no)
);

ALTER TABLE public.lab_map_safety_inspections
  ADD COLUMN IF NOT EXISTS round_item_id uuid REFERENCES public.lab_map_safety_inspection_round_items(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS checklist_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_lab_map_safety_rounds_status
  ON public.lab_map_safety_inspection_rounds(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_lab_map_safety_round_items_sequence
  ON public.lab_map_safety_inspection_round_items(round_id, sequence_no);
CREATE INDEX IF NOT EXISTS idx_lab_map_safety_inspections_round_item
  ON public.lab_map_safety_inspections(round_item_id);

CREATE TABLE IF NOT EXISTS public.lab_map_safety_editors (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lab_map_safety_editors_created_by
  ON public.lab_map_safety_editors(created_by);

CREATE TABLE IF NOT EXISTS public.lab_map_assembly_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_th text NOT NULL,
  detail_th text,
  latitude numeric(9,6) CHECK (latitude BETWEEN -90 AND 90),
  longitude numeric(10,6) CHECK (longitude BETWEEN -180 AND 180),
  position_status text NOT NULL DEFAULT 'unverified' CHECK (position_status IN ('unverified', 'verified')),
  lifecycle_status text NOT NULL DEFAULT 'active' CHECK (lifecycle_status IN ('active', 'retired')),
  position_verified_by uuid REFERENCES public.profiles(id),
  position_verified_at timestamptz,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assembly_gps_pair CHECK ((latitude IS NULL) = (longitude IS NULL))
);

CREATE TABLE IF NOT EXISTS public.lab_map_assembly_point_exits (
  assembly_point_id uuid NOT NULL REFERENCES public.lab_map_assembly_points(id) ON DELETE CASCADE,
  exit_code text NOT NULL REFERENCES public.lab_map_access_points(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  PRIMARY KEY (assembly_point_id, exit_code)
);
CREATE INDEX IF NOT EXISTS idx_lab_map_assembly_point_exits_exit
  ON public.lab_map_assembly_point_exits(exit_code);

CREATE TABLE IF NOT EXISTS public.lab_map_assembly_point_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_point_id uuid NOT NULL REFERENCES public.lab_map_assembly_points(id) ON DELETE RESTRICT,
  latitude numeric(9,6) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude numeric(10,6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  accuracy_meters numeric(10,2) CHECK (accuracy_meters >= 0),
  note text,
  photo_r2_key text NOT NULL UNIQUE,
  photo_file_name text NOT NULL,
  photo_content_type text NOT NULL CHECK (photo_content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  photo_size_bytes bigint NOT NULL CHECK (photo_size_bytes > 0 AND photo_size_bytes <= 10485760),
  verified_by uuid NOT NULL REFERENCES public.profiles(id),
  verified_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lab_map_assembly_verifications_point
  ON public.lab_map_assembly_point_verifications(assembly_point_id, verified_at DESC);
CREATE INDEX IF NOT EXISTS idx_lab_map_assembly_verifications_actor
  ON public.lab_map_assembly_point_verifications(verified_by);
CREATE INDEX IF NOT EXISTS idx_lab_map_assembly_points_verified_by
  ON public.lab_map_assembly_points(position_verified_by);
CREATE INDEX IF NOT EXISTS idx_lab_map_assembly_points_created_by
  ON public.lab_map_assembly_points(created_by);

ALTER TABLE public.lab_map_versions
  ADD COLUMN IF NOT EXISTS asset_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS assembly_point_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.incident_reports
  ADD COLUMN IF NOT EXISTS space_code text REFERENCES public.lab_map_spaces(code) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE public.risk_register
  ADD COLUMN IF NOT EXISTS space_code text REFERENCES public.lab_map_spaces(code) ON UPDATE CASCADE ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_incident_reports_space_date
  ON public.incident_reports(space_code, event_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_risk_register_space_status
  ON public.risk_register(space_code, status) WHERE deleted_at IS NULL;

ALTER TABLE public.lab_map_safety_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_map_safety_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_map_safety_inspection_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_map_safety_inspection_round_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_map_safety_editors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_map_assembly_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_map_assembly_point_exits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_map_assembly_point_verifications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.lab_map_safety_assets, public.lab_map_safety_inspections,
  public.lab_map_safety_inspection_rounds, public.lab_map_safety_inspection_round_items,
  public.lab_map_safety_editors, public.lab_map_assembly_points,
  public.lab_map_assembly_point_exits, public.lab_map_assembly_point_verifications
  FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_map_safety_assets,
  public.lab_map_safety_inspections, public.lab_map_safety_inspection_rounds,
  public.lab_map_safety_inspection_round_items, public.lab_map_safety_editors,
  public.lab_map_assembly_points, public.lab_map_assembly_point_exits,
  public.lab_map_assembly_point_verifications TO service_role;

INSERT INTO public.lab_map_safety_assets
  (code, name_th, kind, x, y, source_note_th, position_status, lifecycle_status)
VALUES
  ('extinguisher-1', 'ถังดับเพลิง 1', 'fire-extinguisher', 1195, 140, 'ผนังโถงเหนือ ใต้ BSL2 Enhance', 'unverified', 'active'),
  ('extinguisher-2', 'ถังดับเพลิง 2', 'fire-extinguisher', 492, 168, 'โถงเหนือ ฝั่งตะวันตก', 'unverified', 'active'),
  ('extinguisher-3', 'ถังดับเพลิง 3', 'fire-extinguisher', 841, 168, 'โถงเหนือ ช่วงกลาง', 'unverified', 'active'),
  ('extinguisher-4', 'ถังดับเพลิง 4', 'fire-extinguisher', 522, 255, 'ฝั่งตะวันตก ใต้แนวโถงเหนือ — ให้ยืนยันเป็นลำดับแรก', 'unverified', 'active'),
  ('extinguisher-5', 'ถังดับเพลิง 5', 'fire-extinguisher', 775, 239, 'แกนกลาง ตอนบน', 'unverified', 'active'),
  ('extinguisher-6', 'ถังดับเพลิง 6', 'fire-extinguisher', 1022, 334, 'โถงระหว่างบล็อกกลางกับปีกตะวันออก', 'unverified', 'active'),
  ('extinguisher-7', 'ถังดับเพลิง 7', 'fire-extinguisher', 775, 426, 'แกนกลาง ข้างห้องปฏิบัติการตรวจพิเศษ', 'unverified', 'active'),
  ('extinguisher-8', 'ถังดับเพลิง 8', 'fire-extinguisher', 1039, 596, 'ช่องเปิดฝั่งตะวันออกของห้องเตรียมเลือด', 'unverified', 'active'),
  ('extinguisher-9', 'ถังดับเพลิง 9', 'fire-extinguisher', 778, 591, 'รอยต่อห้องแยกส่วนประกอบของเลือดกับห้องเตรียมเลือด', 'unverified', 'active'),
  ('extinguisher-10', 'ถังดับเพลิง 10', 'fire-extinguisher', 1312, 551, 'ห้องรับบริจาคเลือด ข้างห้องอาหารว่าง', 'unverified', 'active'),
  ('extinguisher-11', 'ถังดับเพลิง 11', 'fire-extinguisher', 1208, 730, 'โถงใต้ ก่อนถึงทางออก 3C', 'unverified', 'active')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.lab_map_assembly_points
  (code, name_th, detail_th, position_status, lifecycle_status)
VALUES
  ('assembly-front-admin-building', 'พื้นที่หน้าอาคารอำนวยการ', 'ด้านหน้าหอพระ', 'unverified', 'active')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.lab_map_assembly_point_exits (assembly_point_id, exit_code)
SELECT point.id, exit.code
FROM public.lab_map_assembly_points point
CROSS JOIN (VALUES ('exit-3a'), ('exit-3b'), ('exit-3c')) AS exit(code)
WHERE point.code = 'assembly-front-admin-building'
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.record_lab_map_safety_inspection(
  p_asset_id uuid, p_result text, p_inspected_on date, p_next_inspection_date date,
  p_expires_on date, p_note text, p_photo_r2_key text, p_photo_file_name text,
  p_photo_content_type text, p_photo_size_bytes bigint, p_actor_id uuid,
  p_round_item_id uuid, p_checklist_snapshot jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  new_id uuid;
  item_asset_id uuid;
  item_status text;
  round_status text;
BEGIN
  IF p_result NOT IN ('passed', 'needs_attention', 'failed', 'not_found') THEN
    RAISE EXCEPTION 'invalid_inspection_result';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lab_map_safety_assets WHERE id = p_asset_id AND lifecycle_status = 'active' FOR UPDATE) THEN
    RAISE EXCEPTION 'safety_asset_not_active';
  END IF;
  IF p_round_item_id IS NOT NULL THEN
    SELECT item.asset_id, item.status, round.status
      INTO item_asset_id, item_status, round_status
    FROM public.lab_map_safety_inspection_round_items item
    JOIN public.lab_map_safety_inspection_rounds round ON round.id = item.round_id
    WHERE item.id = p_round_item_id
    FOR UPDATE OF item, round;
    IF NOT FOUND OR item_asset_id <> p_asset_id OR item_status <> 'pending' OR round_status <> 'open' THEN
      RAISE EXCEPTION 'invalid_safety_inspection_round_item';
    END IF;
  END IF;
  INSERT INTO public.lab_map_safety_inspections (
    asset_id, result, inspected_on, next_inspection_date, expires_on, note,
    photo_r2_key, photo_file_name, photo_content_type, photo_size_bytes, inspected_by,
    round_item_id, checklist_snapshot
  ) VALUES (
    p_asset_id, p_result, p_inspected_on, p_next_inspection_date, p_expires_on, p_note,
    p_photo_r2_key, p_photo_file_name, p_photo_content_type, p_photo_size_bytes, p_actor_id,
    p_round_item_id, COALESCE(p_checklist_snapshot, '[]'::jsonb)
  ) RETURNING id INTO new_id;
  IF p_round_item_id IS NOT NULL THEN
    UPDATE public.lab_map_safety_inspection_round_items
    SET status = 'completed', inspection_id = new_id, completed_at = now()
    WHERE id = p_round_item_id;
  END IF;
  UPDATE public.lab_map_safety_assets SET
    position_status = CASE WHEN p_result = 'not_found' THEN 'unverified' ELSE 'verified' END,
    position_verified_by = CASE WHEN p_result = 'not_found' THEN NULL ELSE p_actor_id END,
    position_verified_at = CASE WHEN p_result = 'not_found' THEN NULL ELSE now() END,
    updated_at = now()
  WHERE id = p_asset_id;
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_lab_map_assembly_verification(
  p_assembly_point_id uuid, p_latitude numeric, p_longitude numeric, p_accuracy_meters numeric,
  p_note text, p_photo_r2_key text, p_photo_file_name text, p_photo_content_type text,
  p_photo_size_bytes bigint, p_actor_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE new_id uuid;
BEGIN
  IF p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'invalid_gps';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.lab_map_assembly_points
    WHERE id = p_assembly_point_id AND lifecycle_status = 'active' FOR UPDATE
  ) THEN RAISE EXCEPTION 'assembly_point_not_active'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lab_map_assembly_point_exits WHERE assembly_point_id = p_assembly_point_id) THEN
    RAISE EXCEPTION 'assembly_point_requires_exit';
  END IF;
  INSERT INTO public.lab_map_assembly_point_verifications (
    assembly_point_id, latitude, longitude, accuracy_meters, note,
    photo_r2_key, photo_file_name, photo_content_type, photo_size_bytes, verified_by
  ) VALUES (
    p_assembly_point_id, p_latitude, p_longitude, p_accuracy_meters, p_note,
    p_photo_r2_key, p_photo_file_name, p_photo_content_type, p_photo_size_bytes, p_actor_id
  ) RETURNING id INTO new_id;
  UPDATE public.lab_map_assembly_points SET latitude = p_latitude, longitude = p_longitude,
    position_status = 'verified', position_verified_by = p_actor_id,
    position_verified_at = now(), updated_at = now()
  WHERE id = p_assembly_point_id;
  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_lab_map_safety_inspection(
  uuid,text,date,date,date,text,text,text,text,bigint,uuid,uuid,jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_lab_map_safety_inspection(
  uuid,text,date,date,date,text,text,text,text,bigint,uuid,uuid,jsonb
) TO service_role;
REVOKE ALL ON FUNCTION public.record_lab_map_assembly_verification(
  uuid,numeric,numeric,numeric,text,text,text,text,bigint,uuid
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_lab_map_assembly_verification(
  uuid,numeric,numeric,numeric,text,text,text,text,bigint,uuid
) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
