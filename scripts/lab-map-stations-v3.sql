-- Digital laboratory map — checkpoint stations for evacuation-by-location (F3-2026.07.26-03).
-- lib/lab-map/manifest.ts adds 6 'checkpoint' stations (the position of each fingerprint scan
-- point) so the evacuation plan can start from where a visitor is actually standing, instead
-- of always showing the office's plan. lab_map_stations has no query path in application code
-- (LAB_STATIONS in the manifest is read directly) — this script keeps the table's stable codes
-- in sync with the manifest for documentation/audit purposes only, matching the pattern already
-- used by scripts/lab-map-rebuild-v2.sql. Non-destructive: nothing is deleted.

BEGIN;

INSERT INTO lab_map_stations (code, name_th) VALUES
  ('at-central-lab', 'จุดสแกนนิ้วมือ ห้องปฏิบัติการกลาง'),
  ('at-clinical-immunology', 'จุดสแกนนิ้วมือ ห้องปฏิบัติการภูมิคุ้มกันวิทยาคลินิก'),
  ('at-molecular', 'จุดสแกนนิ้วมือ งานอณูชีววิทยา'),
  ('at-microbiology', 'จุดสแกนนิ้วมือ งานจุลชีววิทยา'),
  ('at-special-testing', 'จุดสแกนนิ้วมือ ห้องปฏิบัติการตรวจพิเศษ'),
  ('at-blood-bank', 'จุดสแกนนิ้วมือ งานคลังเลือด')
ON CONFLICT (code) DO UPDATE SET name_th = EXCLUDED.name_th, is_active = true, updated_at = now();

-- เรขาคณิตของผังไม่เปลี่ยน แต่ชุดเส้นทางหนีไฟและสถานีใหม่ทำให้ manifest hash เปลี่ยน
-- ฉบับที่เผยแพร่ไว้เดิมจึงไม่ใช่ฉบับใช้งานจริงอีกต่อไป ต้องสร้างฉบับร่างใหม่และผ่าน
-- การเดินตรวจตาม docs/lab-map/floor-3-acceptance.md ก่อนเผยแพร่ซ้ำ
UPDATE lab_map_versions SET status = 'retired', updated_at = now() WHERE status = 'published';

NOTIFY pgrst, 'reload schema';
COMMIT;
