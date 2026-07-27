-- Equipment map areas v4 — corrections requested after reviewing v3 against real work-unit knowledge
--
-- v3 mis-identified two areas: what it called "room-blood-bank-extension" is actually "คลังน้ำยา"
-- (reagent store), and reagent store itself is not a standalone room — it is a zone of "จุลชีววิทยา"
-- (microbiology). Also splits "ตรวจพิเศษ (โซนบน)" in half and widens "อณูชีววิทยา" from 2 zones to 4
-- (rightmost widest, per direct instruction — not derived from the source drawing this time).
--
-- Run via Supabase Dashboard -> SQL Editor, after equipment-map-areas-v3.sql. Safe to re-run.

begin;

-- (1) จุลชีววิทยา ('zone-microbiology') ขยายเป็นห้องแม่ ครอบคลุมพื้นที่ที่เคยเป็น
-- "room-blood-bank-extension" (ปัจจุบันลบแล้ว รวมเป็นโซนคลังน้ำยาด้านล่าง) — ไม่มีเครื่องมือผูก
-- area_code กับรหัสใดในกลุ่มนี้จากการตรวจสอบข้อมูลจริงก่อนหน้า จึงเปลี่ยน kind/parent/รหัสได้อิสระ
delete from equipment_areas where code = 'room-blood-bank-extension';

update equipment_areas set code = 'room-microbiology' where code = 'zone-microbiology';

insert into equipment_areas (code, kind, parent_code, name_th, sort_order, has_geometry) values
  ('zone-microbiology-main',      'zone', 'room-microbiology', 'จุลชีววิทยา', 9, true)
on conflict (code) do update
  set kind = excluded.kind, parent_code = excluded.parent_code,
      sort_order = excluded.sort_order, has_geometry = true;

-- คลังน้ำยาย้ายจากห้องเดี่ยวมาเป็นโซนลูกของจุลชีววิทยา — คงรหัสเดิม (ไม่มีเครื่องมือผูกไว้) แค่เปลี่ยน
-- kind และ parent_code ผ่านมาเป็นโซน ไม่ต้องลบ/สร้างใหม่ (ชื่อ "คลังน้ำยา" ไม่เปลี่ยน)
update equipment_areas
set kind = 'zone', parent_code = 'room-microbiology'
where code = 'zone-material-reagent-store';

-- (2) ตรวจพิเศษ (โซนบน) แบ่งครึ่งเป็น 2 โซนย่อย — ลบรหัสเดิม (ไม่มีเครื่องมือผูกจากการตรวจสอบก่อนหน้า)
delete from equipment_areas where code = 'zone-special-testing-upper';

insert into equipment_areas (code, kind, parent_code, name_th, sort_order, has_geometry) values
  ('zone-special-testing-upper-1', 'zone', 'zone-special-testing', 'ตรวจพิเศษ (โซนบน 1)', 33, true),
  ('zone-special-testing-upper-2', 'zone', 'zone-special-testing', 'ตรวจพิเศษ (โซนบน 2)', 34, true)
on conflict (code) do update
  set kind = excluded.kind, parent_code = excluded.parent_code,
      sort_order = excluded.sort_order, has_geometry = true;

-- (3) อณูชีววิทยา ขยายจาก 2 โซน (ซ้าย/ขวา) เป็น 4 โซน — ลบรหัสเดิม
delete from equipment_areas where code in ('zone-molecular-left', 'zone-molecular-right');

insert into equipment_areas (code, kind, parent_code, name_th, sort_order, has_geometry) values
  ('zone-molecular-1', 'zone', 'zone-molecular-genomics', 'อณูชีววิทยา (โซน 1)', 42, true),
  ('zone-molecular-2', 'zone', 'zone-molecular-genomics', 'อณูชีววิทยา (โซน 2)', 43, true),
  ('zone-molecular-3', 'zone', 'zone-molecular-genomics', 'อณูชีววิทยา (โซน 3)', 44, true),
  ('zone-molecular-4', 'zone', 'zone-molecular-genomics', 'อณูชีววิทยา (โซน 4)', 45, true)
on conflict (code) do update
  set kind = excluded.kind, parent_code = excluded.parent_code,
      sort_order = excluded.sort_order, has_geometry = true;

commit;

notify pgrst, 'reload schema';
