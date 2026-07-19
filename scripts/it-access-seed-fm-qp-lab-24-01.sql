-- Seed the HIS & LIS access-rights register from the signed paper form Fm-QP-LAB-24/01.
-- Run AFTER scripts/it-access-module.sql (needs it_systems seeded).
--
-- Auto-matches each row to profiles.ephis_id = the form's HIS ID:
--   • people who already have a portal account  → linked + imported
--   • people with no matching profile            → silently skipped (JOIN drops them)
--   • people who already have a register row      → skipped (ON CONFLICT)
-- Re-runnable. Name/position are NOT stored here; they come live from profiles.
--
-- Permission patterns from the form:
--   FULL  (operational, 5 ticks): register, view, report, verify, edit
--   ADMIN (all 7 ticks):          FULL + set_parameter + admin_setting
--   REG   (1 tick):               register only (HIS lab-log staff)

INSERT INTO it_access_records
  (profile_id, lis_user_id,
   can_register, can_view_result, can_report_result, can_verify_result, can_edit_result, can_set_parameter, can_admin_setting,
   system_ids, display_order)
SELECT
  p.id, v.lis,
  v.reg, v.viewr, v.report, v.verify, v.edit, v.setp, v.adm,
  -- Everyone gets HIS (all lab staff register through it); plus each row's own systems.
  COALESCE((SELECT array_agg(s.id) FROM it_systems s WHERE s.name = 'HIS' OR s.name = ANY(v.systems)), '{}'),
  v.ord
FROM (VALUES
  --  ord | HIS   | LIS      | reg  view  report verify edit  setp  adm  | systems                                  -- name
  ( 1, '308',   'L308',  true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- ณัฏฐ์ฤทัย ไพโรจน์
  ( 2, '486',   'L486',  true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- สิทธิพงศ์ ทับทิม
  ( 3, '704',   'L704',  true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- ดวงพร วิวัฒนศร
  ( 4, '2905',  'L2905', true, true,  true,  true,  true,  true, true,  ARRAY['Cobas Infinity','SMART-LIMS']),  -- พรหทัย สร้อยสุวรรณ (admin)
  ( 5, '846',   '846',   true, true,  true,  true,  true,  true, true,  ARRAY['AI-LIS']),                        -- ภสพร อินทร์อาสา (admin)
  ( 6, '833',   'L833',  true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- นันทยา ไชยวุฒิ
  ( 7, '747',   'L747',  true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- นฤมล งามวชิราพร
  ( 8, '2909',  'L2909', true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- สมรัตน์ มาตเจือ
  ( 9, '9827',  'L9827', true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- ลลิตา เหลืองพิพัฒน์สร
  (10, '2153',  'L2153', true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- ประภาพร สังข์นวม
  (11, '2218',  '2218',  true, true,  true,  true,  true,  false,false, ARRAY['AI-LIS']),                        -- เบญจวรรณ ใจเย็น
  (12, '834',   'L834',  true, true,  true,  true,  true,  false,false, ARRAY['M-Lab']),                         -- ปภัชญา สุขจำรัส
  (13, '743',   'L743',  true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- สมภพ สรรเพชุดา
  (14, '2981',  '2981',  true, true,  true,  true,  true,  false,false, ARRAY['AI-LIS']),                        -- อธิตศักดิ์ ขุนคงมี
  (15, '3258',  '3258',  true, true,  true,  true,  true,  true, true,  ARRAY['AI-LIS']),                        -- จุฑามาศ เตชะเมธีกุล (admin)
  (16, '2405',  'L2405', true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- อุมาภรณ์ รัตนโมรา
  (17, '9495',  'L9495', true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- ศิริวัฒน์ จำปีรัตน์
  (18, '2681',  'L2681', true, true,  true,  true,  true,  true, true,  ARRAY['Cobas Infinity','SMART-LIMS']),  -- วรวุฒิ วงษ์เจริญผล (admin)
  (19, '3479',  'L3479', true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- วิรุฬห์ เหลื่อมทองหลาง
  (20, '9917',  'L9917', true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- สิริมา แก้วนุช
  (21, '9914',  '9914',  true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- ธนาวุฒิ แก้วทอง
  (22, '9926',  'L9926', true, true,  true,  true,  true,  false,false, ARRAY['AI-LIS']),                        -- นิรุตต์ อาลี
  (23, '9915',  '9915',  true, true,  true,  true,  true,  false,false, ARRAY['AI-LIS']),                        -- สิริณัฏฐ์ พัชรเสริมสุข
  (24, '9916',  '9916',  true, true,  true,  true,  true,  false,false, ARRAY['AI-LIS']),                        -- ธิดารัตน์ มงคลดาว
  (25, '10947', 'L10947',true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- สุธีมนต์ รัตนปรีดากุล
  (26, '11351', 'L11351',true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- ศิริธร ฉวีวรรณชล
  (27, '12343', '12343', true, true,  true,  true,  true,  false,false, ARRAY['AI-LIS']),                        -- จิระภา ลี้เกตุประชาลักษณ์
  (28, '12056', 'L12056',true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- พิชญะภัทร์ วาสน์หิรัญชัย
  (29, '11493', 'L11493',true, true,  true,  true,  true,  true, true,  ARRAY['M-Lab']),                         -- นาคพรรดิ พระเนตร (admin)
  (30, '12027', 'L12027',true, true,  true,  true,  true,  false,false, ARRAY['M-Lab']),                         -- ชนิดา จุมพล
  (31, '11646', 'L11646',true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- กิตติ เกษมสุข
  (32, '12493', 'L12493',true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- วันทกานต์ ทาบ้านฆ้อง
  (33, '12498', 'L12498',true, true,  true,  true,  true,  false,false, ARRAY['M-Lab']),                         -- ศรีชนก หนูสุวรรณ
  (34, '12970', 'L12970',true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- ศิริลักษณ์ สุธรรม
  (35, '12426', 'L12426',true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- ลัดดาวัลย์ เหลืองอ่อน
  (36, '12805', 'L12805',true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- รสสุคนธ์ ทัดทรง
  (37, '12945', 'L12945',true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- ขนิษฐา เสริฐสงัด
  (38, '12969', 'L12969',true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- นฤมล พูลขำ
  (39, '764',   'L764',  true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- ชวลิต คงงาม
  (40, '784',   'L784',  true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- เสริมศักดิ์ อินอุดม
  (41, '11828', 'L11828',true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- มณฑา แสงจันทร์
  (42, '1286',  NULL,    true, false, false, false, false, false,false, ARRAY['HIS']),                           -- พัชรินทร์ มีทรัพย์ปรุง
  (43, '1433',  NULL,    true, false, false, false, false, false,false, ARRAY['HIS']),                           -- ธนเสฎฐ์ จันทรศร
  (44, '1406',  NULL,    true, false, false, false, false, false,false, ARRAY['HIS']),                           -- วนิดา พึ่งรัตนา
  (45, '1482',  NULL,    true, false, false, false, false, false,false, ARRAY['HIS']),                           -- วันทนา ยิ่งประเสริฐ
  (46, '1905',  NULL,    true, false, false, false, false, false,false, ARRAY['HIS']),                           -- วราห์ ลิ้มศรี
  (47, '1437',  NULL,    true, false, false, false, false, false,false, ARRAY['HIS']),                           -- ปาลีรัตน์ สิมมา
  (48, '3325',  NULL,    true, false, false, false, false, false,false, ARRAY['HIS']),                           -- ชวนขวัญ ศรีดารา
  (49, '1508',  NULL,    true, false, false, false, false, false,false, ARRAY['HIS']),                           -- อรศิริ พงษ์สมบูรณ์
  (50, '1582',  NULL,    true, false, false, false, false, false,false, ARRAY['HIS']),                           -- กาญจนา ศิลาเจริญ
  (51, '1378',  NULL,    true, false, false, false, false, false,false, ARRAY['HIS']),                           -- สุมาลี อารีราษฎรพิทักษ์
  (52, '2020',  NULL,    true, false, false, false, false, false,false, ARRAY['HIS']),                           -- ขวัญเรือน ศิลธรรม
  (53, '9535',  NULL,    true, false, false, false, false, false,false, ARRAY['HIS']),                           -- สุภพิมล อาจวารินทร์
  (54, '10664', NULL,    true, false, false, false, false, false,false, ARRAY['HIS']),                           -- สุพรชัย ใจเย็น
  (55, '10662', NULL,    true, false, false, false, false, false,false, ARRAY['HIS']),                           -- ปทิตตา เหลืองอร่าม
  (56, '10660', '10660', true, false, false, false, false, false,false, ARRAY['AI-LIS']),                        -- ปนัดดา เจริญผล
  (57, '10951', '10951', true, false, false, false, false, false,false, ARRAY['AI-LIS']),                        -- จันทร์เพ็ญ สงวนวาที
  (58, '11836', NULL,    true, false, false, false, false, false,false, ARRAY['HIS']),                           -- พฤติมา พึ่งกุศล
  (59, '10014', '10014', true, false, false, false, false, false,false, ARRAY['AI-LIS']),                        -- อารีรัตน์ แจ่มกลาง
  (60, '10214', NULL,    true, false, false, false, false, false,false, ARRAY['HIS']),                           -- สุจิตรา ใจเย็น
  (61, '11840', NULL,    true, false, false, false, false, false,false, ARRAY['HIS']),                           -- ศศิวิมล ช้างสาร
  (62, '11050', NULL,    true, false, false, false, false, false,false, ARRAY['HIS']),                           -- ลัดดามาศ สุขประเสริฐ
  (63, '12496', NULL,    true, false, false, false, false, false,false, ARRAY['HIS']),                           -- นุชรีรัตน์ พรมผิว
  (64, '13454', NULL,    true, false, false, false, false, false,false, ARRAY['HIS']),                           -- เสาวลักษณ์ ทิพย์ตำแย
  (65, '13810', '13810', true, true,  true,  true,  true,  false,false, ARRAY['AI-LIS']),                        -- ศิริลักษณ์ เพิ่มพูล
  (66, '13811', '13811', true, true,  true,  true,  true,  false,false, ARRAY['AI-LIS']),                        -- ณัฐวีร์ วิเศษเธียรกุล
  (67, '14072', '14072', true, true,  true,  true,  true,  false,false, ARRAY['AI-LIS']),                        -- ภัทรมน โคตรสมบัติ
  (68, '14153', NULL,    true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- จรัญญา ขนทรัพย์
  (69, '14250', 'L14250',true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- สุชัญญา ทองสม
  (70, '14252', 'L14252',true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- เอมวิกา จันทร์ทอง
  (71, '14251', 'L14251',true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- วรรษชล มนุษย์จันทร์
  (72, '14271', 'L14271',true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- ศิวนนท์ ใจนา
  (73, '14371', NULL,    true, false, false, false, false, false,false, ARRAY['HIS']),                           -- เบญจวรรณ หมวดธรรม
  (74, '14432', 'L14432',true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- ฐานิตา อังวราวงศ์
  (75, '14426', '14426', true, false, false, false, false, false,false, ARRAY['AI-LIS']),                        -- ณัฐธินัน สามารถ
  (76, '14743', 'L14743',true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- ณัฐดนัย ดีเจริญ
  (77, '14812', 'L14812',true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- พลอย นารี
  (78, '14930', 'L14930',true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- ผกาพรรณ เผื่อแผ่
  (79, '15060', 'L15060',true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- นันธวัช พรมดี
  (80, '15149', 'L15149',true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- ปรียาภัทร โตเจริญ
  (81, '15148', 'L15148',true, true,  true,  true,  true,  false,false, ARRAY['Cobas Infinity','SMART-LIMS']),  -- ธนรัชต์ มงคลธนวัฒน์
  (82, '15545', NULL,    true, false, false, false, false, false,false, ARRAY['HIS']),                           -- นริตา มักทองหลาง
  (83, '15607', '15607', true, true,  true,  true,  true,  false,false, ARRAY['AI-LIS'])                         -- ลลิล โชติกาภากร
) AS v(ord, his, lis, reg, viewr, report, verify, edit, setp, adm, systems)
JOIN profiles p ON p.ephis_id = v.his AND p.deleted_at IS NULL
ON CONFLICT (profile_id) DO NOTHING;

-- Ensure HIS is present on EVERY register row, including rows imported by an earlier
-- run (ON CONFLICT DO NOTHING above skips existing rows, so this back-fills them).
-- Idempotent: only appends HIS when the row does not already contain it.
UPDATE it_access_records r
SET system_ids = r.system_ids || (SELECT id FROM it_systems WHERE name = 'HIS')
WHERE (SELECT id FROM it_systems WHERE name = 'HIS') <> ALL (r.system_ids);
