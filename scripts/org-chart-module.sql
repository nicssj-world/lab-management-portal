-- Organization Chart (ผังองค์กร) — editable, profile-linkable (Phase 2 of personnel module)
-- Run via Supabase Dashboard → SQL Editor.

CREATE TABLE IF NOT EXISTS org_chart_nodes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id   uuid REFERENCES org_chart_nodes(id) ON DELETE CASCADE,
  title       text NOT NULL,                 -- box label (position or unit name)
  person_name text,                          -- manually-typed name (when not linked)
  profile_id  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  photo_url   text,                          -- uploaded photo path (staff-files bucket)
  node_type   text DEFAULT 'unit' CHECK (node_type IN ('leadership', 'position', 'unit')),
  is_linkable boolean DEFAULT true,          -- false = top hospital-leadership boxes (no profile link)
  sort_order  integer DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  deleted_at  timestamptz
);
CREATE INDEX IF NOT EXISTS org_chart_nodes_parent_idx ON org_chart_nodes(parent_id);

ALTER TABLE org_chart_nodes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "org_chart_nodes_select" ON org_chart_nodes FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Seed the blank structure (titles + hierarchy only; no photos / no names) ──
-- Mirrors ผังองค์กร2569 (กลุ่มงานเทคนิคการแพทย์ รพ.ชลบุรี). Only runs when table is empty.
DO $$
DECLARE
  dir     uuid; deputy_dir uuid; head uuid; deputy uuid; central uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM org_chart_nodes) THEN RETURN; END IF;

  INSERT INTO org_chart_nodes (title, node_type, is_linkable, sort_order)
    VALUES ('ผู้อำนวยการโรงพยาบาลชลบุรี', 'leadership', false, 0) RETURNING id INTO dir;
  INSERT INTO org_chart_nodes (parent_id, title, node_type, is_linkable, sort_order)
    VALUES (dir, 'รองผู้อำนวยการด้านพัฒนาระบบบริการและสนับสนุนบริการสุขภาพ', 'leadership', false, 0) RETURNING id INTO deputy_dir;
  INSERT INTO org_chart_nodes (parent_id, title, node_type, is_linkable, sort_order)
    VALUES (deputy_dir, 'หัวหน้ากลุ่มงานเทคนิคการแพทย์', 'position', true, 0) RETURNING id INTO head;
  INSERT INTO org_chart_nodes (parent_id, title, node_type, is_linkable, sort_order)
    VALUES (head, 'รองหัวหน้ากลุ่มงานเทคนิคการแพทย์', 'position', true, 0) RETURNING id INTO deputy;

  INSERT INTO org_chart_nodes (parent_id, title, node_type, is_linkable, sort_order) VALUES
    (deputy, 'งานคลังเลือด', 'unit', true, 1),
    (deputy, 'งานตรวจพิเศษ และห้องปฏิบัติการตรวจต่อ', 'unit', true, 2);
  INSERT INTO org_chart_nodes (parent_id, title, node_type, is_linkable, sort_order)
    VALUES (deputy, 'ห้องปฏิบัติการกลาง', 'unit', true, 3) RETURNING id INTO central;
  INSERT INTO org_chart_nodes (parent_id, title, node_type, is_linkable, sort_order) VALUES
    (deputy, 'งานบริการผู้ป่วยนอก', 'unit', true, 4),
    (deputy, 'ห้องปฏิบัติการ ศสม.เมืองชลบุรี', 'unit', true, 5),
    (deputy, 'งานจุลชีววิทยาคลินิก และคลังน้ำยา', 'unit', true, 6),
    (deputy, 'งานบริการทั่วไป', 'unit', true, 7);

  INSERT INTO org_chart_nodes (parent_id, title, node_type, is_linkable, sort_order) VALUES
    (central, 'ห้องปฏิบัติการเคมีคลินิกและภูมิคุ้มกันวิทยาคลินิก', 'unit', true, 1),
    (central, 'ห้องปฏิบัติการโลหิตวิทยาคลินิกและจุลทรรศนศาสตร์คลินิก', 'unit', true, 2);
END $$;
