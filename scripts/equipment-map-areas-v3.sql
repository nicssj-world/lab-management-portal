-- Equipment map areas v3 — corrections found by comparing v2 against the source .pptx more closely
--
-- v2 collapsed several rooms that are actually subdivided in the drawing (a nested-rectangle pattern
-- the same as central-lab's 3 zones, just missed on the first pass) and mis-measured a couple of
-- L-shaped rooms as plain rectangles. See lib/equipment-map/manifest.ts comments for the geometry.
--
-- Run via Supabase Dashboard -> SQL Editor, after equipment-map-areas-v2.sql. Safe to re-run.

begin;

-- (1) โถงทิศเหนือเดิมเป็นห้องเดียว จริง ๆ แบ่งเป็น 3 ห้อง — ลบรหัสเดิม (equipment.area_code
-- เป็น on delete set null อยู่แล้ว และไม่มีเครื่องมือผูกไว้ที่นี่จากการสำรวจข้อมูลจริง)
delete from equipment_areas where code = 'room-north-corridor';

insert into equipment_areas (code, kind, parent_code, name_th, sort_order, has_geometry) values
  ('room-north-corridor-1',      'room', null, 'โถงทิศเหนือ 1',              8, true),
  ('room-north-corridor-2',      'room', null, 'โถงทิศเหนือ 2',              9, true),
  ('room-north-corridor-3',      'room', null, 'โถงทิศเหนือ 3',             10, true),
  ('room-blood-bank-extension',  'room', null, 'คลังเลือด (ส่วนขยาย)',      26, true)
on conflict (code) do update
  set kind = excluded.kind, parent_code = excluded.parent_code,
      sort_order = excluded.sort_order, has_geometry = true;

-- (2) อณูชีววิทยา ('zone-molecular-genomics') มี 2 ห้องย่อยจริงในผังต้นฉบับ — เพิ่มเป็นโซนลูก
-- คงรหัสห้องแม่เดิมไว้เพราะมีเครื่องมือผูก area_code กับรหัสนี้ไปแล้ว
insert into equipment_areas (code, kind, parent_code, name_th, sort_order, has_geometry) values
  ('zone-molecular-left',  'zone', 'zone-molecular-genomics', 'อณูชีววิทยา (โซนซ้าย)', 40, true),
  ('zone-molecular-right', 'zone', 'zone-molecular-genomics', 'อณูชีววิทยา (โซนขวา)', 41, true)
on conflict (code) do update
  set kind = excluded.kind, parent_code = excluded.parent_code,
      sort_order = excluded.sort_order, has_geometry = true;

commit;

notify pgrst, 'reload schema';
