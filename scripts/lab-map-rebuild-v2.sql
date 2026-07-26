-- Digital laboratory map rebuild (F3-2026.07.26-02).
-- Re-seeds the stable codes that lib/lab-map/manifest.ts expects. Geometry itself stays in Git.
-- Non-destructive: rows that no longer exist in the manifest are deactivated, never deleted, and
-- lab_map_person_assignments is retained untouched for recoverability even though the map no longer
-- queries it.

BEGIN;

-- ── ห้องและพื้นที่ ──
INSERT INTO lab_map_spaces (code, name_th, infection_class) VALUES
  ('restroom-northwest-1', 'ห้องน้ำ', 'clean'),
  ('shower-northwest', 'ห้องอาบน้ำ', 'clean'),
  ('restroom-northwest-2', 'ห้องน้ำ', 'clean'),
  ('staff-rest-room', 'ห้องพักเวรเจ้าหน้าที่', 'clean'),
  ('central-lab', 'ห้องปฏิบัติการกลาง', 'infectious'),
  ('bsl2-enhance', 'BSL2 Enhance', 'infectious'),
  ('restroom-northeast', 'ห้องน้ำ', 'clean'),
  ('pcr-room', 'ห้อง PCR', 'infectious'),
  ('fungus-room', 'ห้องเชื้อรา', 'infectious'),
  ('genomics-lab', 'ห้องปฏิบัติการจีโนมิกส์', 'infectious'),
  ('molecular-biology-lab', 'ห้องปฏิบัติการอณูชีววิทยา', 'infectious'),
  ('equipment-wash', 'ห้องล้างอุปกรณ์', 'infectious'),
  ('ppe-zone', 'โซน PPE', 'clean'),
  ('clinical-immunology-room', 'ห้องปฏิบัติการภูมิคุ้มกันวิทยาคลินิก', 'infectious'),
  ('chemical-prep', 'ห้องเตรียมสารเคมี', 'risk'),
  ('electrical-control', 'ห้องควบคุมไฟฟ้า', 'clean'),
  ('computer-control', 'ห้องควบคุมระบบคอมพิวเตอร์', 'clean'),
  ('meeting-room', 'ห้องประชุม', 'clean'),
  ('group-head-office', 'ห้องหัวหน้ากลุ่มงานเทคนิคการแพทย์', 'clean'),
  ('group-head-restroom', 'ห้องน้ำ', 'clean'),
  ('south-restroom-2', 'ห้องน้ำ', 'clean'),
  ('south-restroom-3', 'ห้องน้ำ', 'clean'),
  ('lift-3', 'ลิฟท์ 3', 'clean'),
  ('lift-4', 'ลิฟท์ 4', 'clean'),
  ('locker-room', 'ห้อง Locker จนท.', 'clean'),
  ('microbiology-staff-room', 'ห้องพัก จนท. งานจุลชีววิทยา', 'clean'),
  ('cold-material-reagent-store', 'ห้องเก็บวัสดุและน้ำยาแช่เย็น', 'clean'),
  ('special-testing-lab', 'ห้องปฏิบัติการตรวจพิเศษ', 'infectious'),
  ('blood-component-room', 'ห้องแยกส่วนประกอบของเลือด', 'infectious'),
  ('blood-prep-room', 'ห้องเตรียมเลือด', 'infectious'),
  ('material-store', 'คลังวัสดุ', 'clean'),
  ('microbiology-lab', 'ห้องปฏิบัติการจุลชีววิทยาคลินิก', 'infectious'),
  ('material-reagent-store', 'คลังวัสดุและน้ำยา', 'clean'),
  ('blood-donation-room', 'ห้องรับบริจาคเลือด งานคลังเลือด', 'infectious'),
  ('donor-snack-room', 'ห้องอาหารว่างสำหรับผู้บริจาคเลือด', 'clean'),
  ('donor-restroom-1', 'ห้องน้ำ', 'clean'),
  ('donor-restroom-2', 'ห้องน้ำ', 'clean'),
  ('office', 'สำนักงานกลุ่มงานเทคนิคการแพทย์', 'clean'),
  ('stair-room', 'ห้องบันได', 'clean'),
  ('lift-2', 'ลิฟท์ 2', 'clean'),
  ('lift-1', 'ลิฟท์ 1', 'clean'),
  ('staff-waiting-area', 'บริเวณที่พักเจ้าหน้าที่', 'clean'),
  ('supplies-equipment-store', 'ห้องเก็บพัสดุและอุปกรณ์', 'clean')
ON CONFLICT (code) DO UPDATE SET
  name_th = EXCLUDED.name_th,
  infection_class = EXCLUDED.infection_class,
  is_active = true,
  updated_at = now();

-- ห้องที่ถูกรวมเข้าห้องอื่นในรอบนี้ — ปิดใช้งาน ไม่ลบ
--   central-lab-left/right  → central-lab
--   culture-media-prep, specimen-prep, infectious-diagnosis-room → microbiology-lab
--     (แบบต้นฉบับวาดพื้นที่จุลชีววิทยาเป็นห้องเดียวเต็มบล็อก มีเพียงคลังวัสดุซ้อนอยู่มุมล่างซ้าย)
UPDATE lab_map_spaces SET is_active = false, updated_at = now()
WHERE code IN ('central-lab-left', 'central-lab-right',
               'culture-media-prep', 'specimen-prep', 'infectious-diagnosis-room');

DELETE FROM lab_map_zone_spaces
WHERE space_id IN (SELECT id FROM lab_map_spaces WHERE is_active = false);

-- ── โซน ──
INSERT INTO lab_map_zones (code, name_th) VALUES
  ('central-lab-zone', 'ห้องปฏิบัติการกลาง (Central Lab)'),
  ('immunology-zone', 'พื้นที่งานภูมิคุ้มกันวิทยาคลินิก'),
  ('microbiology-zone', 'พื้นที่งานจุลชีววิทยา'),
  ('storage-zone', 'โซนคลังวัสดุ'),
  ('blood-bank-zone', 'พื้นที่งานคลังเลือด'),
  ('molecular-zone', 'พื้นที่งานอณูชีววิทยา'),
  ('special-testing-zone', 'พื้นที่งานตรวจพิเศษและห้องปฏิบัติการตรวจต่อ')
ON CONFLICT (code) DO UPDATE SET name_th = EXCLUDED.name_th, is_active = true, updated_at = now();

UPDATE lab_map_zones SET is_active = false, updated_at = now()
WHERE code IN ('central-lab', 'central-lab-left-zone', 'central-lab-right-zone');

DELETE FROM lab_map_zone_spaces
WHERE zone_id IN (SELECT id FROM lab_map_zones WHERE is_active = false);

INSERT INTO lab_map_zone_spaces (zone_id, space_id)
SELECT z.id, s.id FROM (VALUES
  ('central-lab-zone','central-lab'),
  ('immunology-zone','clinical-immunology-room'), ('immunology-zone','chemical-prep'),
  ('microbiology-zone','bsl2-enhance'), ('microbiology-zone','pcr-room'),
  ('microbiology-zone','fungus-room'), ('microbiology-zone','microbiology-lab'),
  ('microbiology-zone','material-store'),
  ('microbiology-zone','material-reagent-store'), ('microbiology-zone','cold-material-reagent-store'),
  ('storage-zone','material-store'), ('storage-zone','material-reagent-store'),
  ('storage-zone','cold-material-reagent-store'),
  ('blood-bank-zone','blood-donation-room'), ('blood-bank-zone','blood-component-room'),
  ('blood-bank-zone','blood-prep-room'), ('blood-bank-zone','donor-snack-room'),
  ('molecular-zone','molecular-biology-lab'), ('molecular-zone','genomics-lab'),
  ('special-testing-zone','special-testing-lab')
) AS seed(zone_code, space_code)
JOIN lab_map_zones z ON z.code = seed.zone_code
JOIN lab_map_spaces s ON s.code = seed.space_code
ON CONFLICT DO NOTHING;

-- ── จุดเข้าออก ──
INSERT INTO lab_map_access_points (code, name_th, kind, status) VALUES
  ('fingerprint-central-lab', 'จุดสแกนนิ้วมือ ประตูห้องปฏิบัติการกลาง (บานตะวันตก)', 'fingerprint', 'fingerprint_controlled'),
  ('fingerprint-central-lab-second', 'จุดสแกนนิ้วมือ ประตูห้องปฏิบัติการกลาง (บานตะวันออก)', 'fingerprint', 'fingerprint_controlled'),
  ('fingerprint-molecular', 'จุดสแกนนิ้วมือ แนวกั้นข้างโซน PPE ใต้ห้องปฏิบัติการกลาง', 'fingerprint', 'fingerprint_controlled'),
  ('fingerprint-clinical-immunology', 'จุดสแกนนิ้วมือ ห้องปฏิบัติการภูมิคุ้มกันวิทยาคลินิก', 'fingerprint', 'fingerprint_controlled'),
  ('fingerprint-microbiology', 'จุดสแกนนิ้วมือ แนวกั้นพื้นที่งานจุลชีววิทยา', 'fingerprint', 'fingerprint_controlled'),
  ('fingerprint-special-testing', 'จุดสแกนนิ้วมือ ห้องปฏิบัติการตรวจพิเศษ', 'fingerprint', 'fingerprint_controlled'),
  ('fingerprint-blood-bank', 'จุดสแกนนิ้วมือ ห้องเตรียมเลือด งานคลังเลือด', 'fingerprint', 'fingerprint_controlled'),
  ('fingerprint-office', 'จุดสแกนนิ้วมือ สำนักงานกลุ่มงานเทคนิคการแพทย์', 'fingerprint', 'fingerprint_controlled'),
  ('door-locked-electrical-corridor', 'ประตูล็อคถาวร (ทางเชื่อมห้องควบคุมไฟฟ้า)', 'door', 'permanently_locked'),
  ('exit-3a', 'ทางออก 3A', 'exit', 'open'),
  ('exit-3b', 'ทางออก 3B', 'exit', 'open'),
  ('exit-3c', 'ทางออก 3C', 'exit', 'open')
ON CONFLICT (code) DO UPDATE SET name_th = EXCLUDED.name_th, kind = EXCLUDED.kind,
  status = EXCLUDED.status, is_active = true, updated_at = now();

UPDATE lab_map_access_points SET is_active = false, updated_at = now()
WHERE code IN ('fingerprint-central-left', 'fingerprint-central-right',
               'door-central-left', 'door-central-right', 'door-electrical-control');

-- ── จุดติดตั้งแผนที่ ──
INSERT INTO lab_map_stations (code, name_th) VALUES
  ('office', 'จุดติดตั้งแผนที่ หน้าสำนักงานกลุ่มงานฯ'),
  ('central-corridor', 'จุดติดตั้งแผนที่ โถงหน้าห้องปฏิบัติการกลาง'),
  ('south-corridor', 'จุดติดตั้งแผนที่ โถงทางเดินด้านทิศใต้')
ON CONFLICT (code) DO UPDATE SET name_th = EXCLUDED.name_th, is_active = true, updated_at = now();

-- เรขาคณิตใหม่ = manifest hash ใหม่ → ฉบับที่เผยแพร่ไว้เดิมไม่ใช่ฉบับใช้งานจริงอีกต่อไป
UPDATE lab_map_versions SET status = 'retired', updated_at = now() WHERE status = 'published';

NOTIFY pgrst, 'reload schema';
COMMIT;
