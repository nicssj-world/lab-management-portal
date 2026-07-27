-- Equipment map areas v2 — ผังวาดใหม่จากไฟล์ต้นฉบับ แผนผังกลุ่มงาน2569.pptx
--
-- v1 (equipment-map-module.sql) ยืมรูปทรงห้องมาจากแผนที่ความปลอดภัย (lab_map_spaces) ซึ่ง
-- **เป็นคนละแบบกับผังเครื่องมือจริง** ห้องจึงไปแสดงผิดตำแหน่งทั้งหมด สคริปต์นี้แทนที่ชุดพื้นที่เดิม
-- ด้วยชุดที่ถอดพิกัดจาก .pptx โดยตรง (ดู lib/equipment-map/manifest.ts)
--
-- รหัสพื้นที่ที่ความหมายยังตรงกันถูก "คงไว้" เพื่อไม่ให้เครื่องมือที่กำหนดโซนไปแล้วหลุดการผูก
-- Run via Supabase Dashboard -> SQL Editor. Safe to re-run.

begin;

-- (1) ลบพื้นที่ v1 ที่ไม่มีในผังใหม่
-- equipment.area_code เป็น on delete set null อยู่แล้ว จึงไม่ทำให้แถวเครื่องมือหาย
-- เงื่อนไข has_geometry = true กันไม่ให้ลบ "พื้นที่นอกผัง" ที่ผู้ใช้สร้างเองผ่านหน้าเว็บ
delete from equipment_areas
where has_geometry = true
  and code not in (
    'room-nw-corner', 'room-nw-store', 'room-central-lab',
    'zone-central-chem-immuno', 'zone-central-microscopy', 'zone-central-hematology',
    'room-north-lab-1', 'room-north-lab-2', 'room-north-small', 'room-north-lab-3',
    'room-north-corridor', 'zone-microbiology',
    'zone-molecular-genomics', 'zone-equipment-wash', 'zone-clinical-immunology',
    'room-centre-upper', 'zone-cold-storage', 'zone-material-reagent-store',
    'zone-special-testing', 'zone-special-testing-upper', 'zone-special-testing-mid',
    'zone-special-testing-lower', 'zone-blood-bank',
    'room-fume-hood', 'room-fume-hood-side',
    'room-sw-1', 'room-sw-2', 'room-sw-3', 'room-sw-4',
    'room-se-1', 'room-se-2'
  );

-- (2) พื้นที่ที่คงรหัสเดิมไว้ แต่เปลี่ยนชื่อ/ชนิดตามผังใหม่
-- ('อณูชีววิทยา' เดิมรวมห้องจีโนมิกส์ — ผังใหม่เป็นห้องเดียวอยู่แล้ว จึงคงรหัสเดิมได้)
update equipment_areas set kind = 'room', parent_code = null where code in (
  'zone-microbiology', 'zone-molecular-genomics', 'zone-equipment-wash',
  'zone-clinical-immunology', 'zone-cold-storage', 'zone-material-reagent-store',
  'zone-special-testing', 'zone-blood-bank'
);

-- (3) เพิ่ม/อัปเดตพื้นที่ทั้งหมดของผังใหม่
-- on conflict อัปเดตเฉพาะ kind/parent_code/sort_order — **ไม่แตะ name_th** เพื่อไม่เขียนทับชื่อที่ผู้ใช้แก้เอง
insert into equipment_areas (code, kind, parent_code, name_th, sort_order, has_geometry) values
  ('room-nw-corner',             'room', null, 'ห้องมุมตะวันตกเฉียงเหนือ',   1, true),
  ('room-nw-store',              'room', null, 'ห้องเก็บของทิศเหนือ',        2, true),
  ('room-central-lab',           'room', null, 'ห้องปฏิบัติการกลาง',         3, true),
  ('room-north-lab-1',           'room', null, 'ห้องปฏิบัติการทิศเหนือ 1',   4, true),
  ('room-north-lab-2',           'room', null, 'ห้องปฏิบัติการทิศเหนือ 2',   5, true),
  ('room-north-small',           'room', null, 'ห้องเล็กทิศเหนือ',           6, true),
  ('room-north-lab-3',           'room', null, 'ห้องปฏิบัติการทิศเหนือ 3',   7, true),
  ('room-north-corridor',        'room', null, 'โถงทิศเหนือ',                8, true),
  ('zone-microbiology',          'room', null, 'จุลชีววิทยา',                9, true),
  ('zone-molecular-genomics',    'room', null, 'อณูชีววิทยา',               10, true),
  ('zone-equipment-wash',        'room', null, 'ห้องล้าง',                  11, true),
  ('zone-clinical-immunology',   'room', null, 'ภูมิคุ้มกัน',               12, true),
  ('room-centre-upper',          'room', null, 'ห้องกลางด้านบน',            13, true),
  ('zone-cold-storage',          'room', null, 'ตู้เย็น',                   14, true),
  ('zone-material-reagent-store','room', null, 'คลังน้ำยา',                 15, true),
  ('zone-special-testing',       'room', null, 'ตรวจพิเศษและตรวจต่อ',       16, true),
  ('zone-blood-bank',            'room', null, 'คลังเลือด',                 17, true),
  ('room-fume-hood',             'room', null, 'ห้องดูดควัน',               18, true),
  ('room-fume-hood-side',        'room', null, 'ห้องข้างห้องดูดควัน',       19, true),
  ('room-sw-1',                  'room', null, 'ห้องว่างตะวันตกเฉียงใต้ 1', 20, true),
  ('room-sw-2',                  'room', null, 'ห้องว่างตะวันตกเฉียงใต้ 2', 21, true),
  ('room-sw-3',                  'room', null, 'ห้องว่างตะวันตกเฉียงใต้ 3', 22, true),
  ('room-sw-4',                  'room', null, 'ห้องว่างตะวันตกเฉียงใต้ 4', 23, true),
  ('room-se-1',                  'room', null, 'ห้องทิศตะวันออกเฉียงใต้ 1', 24, true),
  ('room-se-2',                  'room', null, 'ห้องทิศตะวันออกเฉียงใต้ 2', 25, true)
on conflict (code) do update
  set kind = excluded.kind, parent_code = excluded.parent_code,
      sort_order = excluded.sort_order, has_geometry = true;

-- โซนลูก ต้องใส่หลังห้องแม่เสมอ (FK parent_code)
insert into equipment_areas (code, kind, parent_code, name_th, sort_order, has_geometry) values
  ('zone-central-chem-immuno',   'zone', 'room-central-lab',     'เคมีคลินิก + ภูมิคุ้มกัน', 30, true),
  ('zone-central-microscopy',    'zone', 'room-central-lab',     'จุลทรรศนศาสตร์',           31, true),
  ('zone-central-hematology',    'zone', 'room-central-lab',     'โลหิตวิทยา',               32, true),
  ('zone-special-testing-upper', 'zone', 'zone-special-testing', 'ตรวจพิเศษ (โซนบน)',        33, true),
  ('zone-special-testing-mid',   'zone', 'zone-special-testing', 'ตรวจพิเศษ (โซนกลาง)',      34, true),
  ('zone-special-testing-lower', 'zone', 'zone-special-testing', 'ตรวจพิเศษ (โซนล่าง)',      35, true)
on conflict (code) do update
  set kind = excluded.kind, parent_code = excluded.parent_code,
      sort_order = excluded.sort_order, has_geometry = true;

commit;

notify pgrst, 'reload schema';
