-- ══════════════════════════════════════════════════════════════════
-- KPI Real Data Seed — ปีงบประมาณ 2568 (ต.ค. 2567 – ก.ย. 2568)
-- ข้อมูลจริงครบ 12 เดือนทุกแผนก จาก Google Sheets ปีงบ 2568
-- (สามารถรันคู่กับ kpi-mockup-seed.sql ของปี 2569 ได้)
-- ══════════════════════════════════════════════════════════════════
-- หมายเหตุโครงสร้างปี 2568: ส่วน Risk มี 4.1 (OPD/Ward/Sticker),
--   4.2 Near Miss A-B, 4.3 Sentinel G-I (ไม่มี Low Risk C-D / Moderate E-F)

-- ensure denominator column + definitions/departments มีครบ (idempotent)
alter table kpi_definitions add column if not exists denominator text default null;

insert into departments (code, name_th, is_active) values
  ('CHE','เคมีคลินิก',true),('IMM','ภูมิคุ้มกันวิทยา',true),('HEM','โลหิตวิทยา',true),
  ('MIS','จุลทรรศน์ศาสตร์',true),('MIC','จุลชีววิทยา',true),('MOL','อณูชีววิทยา',true),
  ('BLB','คลังเลือด',true),('OUT','OUT LAB',true),('MCL','ศสม.',true),('OPD','OPD',true)
on conflict (code) do update set name_th = excluded.name_th, is_active = excluded.is_active;

insert into kpi_definitions (code, category, sub_code, name_th, unit, target_type, target_val, sort_order, denominator) values
  ('TAT_ROUTINE','TAT','1.1','Routine LAB ทันเวลา','%','gte',95,10,'จำนวนส่งตรวจทั้งหมด'),
  ('TAT_STROKE','TAT','1.2','Stroke Fast Tract 30 นาที','%','gte',100,20,'จำนวนส่งตรวจทั้งหมด'),
  ('TAT_CRITICAL','TAT','1.3','ค่าวิกฤติ 15 นาที','%','gte',100,30,'ค่าวิกฤติทั้งหมด'),
  ('TAT_UNCROSS','TAT','1.4','Uncrossmatch ทันเวลา','%','gte',100,40,'จำนวนเตรียมจ่ายเลือดทั้งหมด'),
  ('ERR_REPORT','ERROR','2','การรายงานผลคลาดเคลื่อน','%','lte',0.05,50,'จำนวนรายการทั้งหมด'),
  ('RISK_BLOOD','RISK','3','ผู้ป่วยได้รับเลือดผิด','ครั้ง','eq',0,60,null),
  ('RISK_ID_OPD','RISK','4.1','เจาะเลือดผิด OPD','ครั้ง','eq',0,70,null),
  ('RISK_ID_WARD','RISK','4.1','เจาะเลือดผิด Ward','ครั้ง','eq',0,80,null),
  ('RISK_STICKER','RISK','4.1','ติดสติ๊กเกอร์ผิด','ครั้ง','eq',0,90,null),
  ('RISK_NEARMISS','RISK','4.2','Near Miss A-B','%','gte',75,100,'อุบัติการณ์ทั้งหมด'),
  ('RISK_LOWRISK','RISK','4.3','Low Risk C-D','%','lte',25,110,'อุบัติการณ์ทั้งหมด'),
  ('RISK_MODERATE','RISK','4.4','Moderate Risk E-F','ครั้ง','eq',0,120,null),
  ('RISK_SENTINEL','RISK','4.5','Sentinel Event G-I','ครั้ง','eq',0,130,null)
on conflict (code) do update set
  name_th=excluded.name_th, unit=excluded.unit, target_type=excluded.target_type,
  target_val=excluded.target_val, sort_order=excluded.sort_order,
  denominator=excluded.denominator, category=excluded.category, sub_code=excluded.sub_code;

-- ─────────────────────────────────────────────────────────────────
-- KPI ENTRIES ปีงบ 2568 (ตัวเลขจริงทุกเซลล์)
-- month: 10=ต.ค. 11=พ.ย. 12=ธ.ค. 1=ม.ค. 2=ก.พ. 3=มี.ค. 4=เม.ย. 5=พ.ค. 6=มิ.ย. 7=ก.ค. 8=ส.ค. 9=ก.ย.
-- ─────────────────────────────────────────────────────────────────
with
  d as (select id, code from departments),
  k as (select id, code, target_type from kpi_definitions),
  raw (dept_code, kpi_code, fy, mo, num, den) as (values

  -- ════════ CHE เคมีคลินิก ════════
  ('CHE','TAT_ROUTINE',2568,10,42435,49432),('CHE','TAT_ROUTINE',2568,11,42827,47605),
  ('CHE','TAT_ROUTINE',2568,12,39449,43455),('CHE','TAT_ROUTINE',2568,1,46342,51588),
  ('CHE','TAT_ROUTINE',2568,2,40220,43767),('CHE','TAT_ROUTINE',2568,3,44514,48994),
  ('CHE','TAT_ROUTINE',2568,4,40603,43638),('CHE','TAT_ROUTINE',2568,5,46891,51529),
  ('CHE','TAT_ROUTINE',2568,6,43910,47220),('CHE','TAT_ROUTINE',2568,7,45477,49432),
  ('CHE','TAT_ROUTINE',2568,8,47880,51034),('CHE','TAT_ROUTINE',2568,9,46843,49561),
  ('CHE','TAT_CRITICAL',2568,10,373,507),('CHE','TAT_CRITICAL',2568,11,300,433),
  ('CHE','TAT_CRITICAL',2568,12,374,455),('CHE','TAT_CRITICAL',2568,1,428,566),
  ('CHE','TAT_CRITICAL',2568,2,369,469),('CHE','TAT_CRITICAL',2568,3,468,607),
  ('CHE','TAT_CRITICAL',2568,4,396,501),('CHE','TAT_CRITICAL',2568,5,364,447),
  ('CHE','TAT_CRITICAL',2568,6,367,465),('CHE','TAT_CRITICAL',2568,7,379,498),
  ('CHE','TAT_CRITICAL',2568,8,375,464),('CHE','TAT_CRITICAL',2568,9,334,421),
  ('CHE','ERR_REPORT',2568,10,0,49432),('CHE','ERR_REPORT',2568,11,0,47605),
  ('CHE','ERR_REPORT',2568,12,0,43455),('CHE','ERR_REPORT',2568,1,0,51588),
  ('CHE','ERR_REPORT',2568,2,0,43767),('CHE','ERR_REPORT',2568,3,0,48994),
  ('CHE','ERR_REPORT',2568,4,0,43638),('CHE','ERR_REPORT',2568,5,0,51529),
  ('CHE','ERR_REPORT',2568,6,0,47220),('CHE','ERR_REPORT',2568,7,0,49432),
  ('CHE','ERR_REPORT',2568,8,0,51034),('CHE','ERR_REPORT',2568,9,0,49561),
  ('CHE','RISK_ID_OPD',2568,10,2,null),('CHE','RISK_ID_OPD',2568,11,1,null),
  ('CHE','RISK_ID_WARD',2568,10,2,null),('CHE','RISK_ID_WARD',2568,11,3,null),
  ('CHE','RISK_ID_WARD',2568,12,2,null),('CHE','RISK_ID_WARD',2568,1,3,null),
  ('CHE','RISK_ID_WARD',2568,3,4,null),('CHE','RISK_ID_WARD',2568,5,2,null),
  ('CHE','RISK_ID_WARD',2568,6,2,null),('CHE','RISK_ID_WARD',2568,7,4,null),
  ('CHE','RISK_ID_WARD',2568,9,2,null),
  ('CHE','RISK_STICKER',2568,10,7,null),('CHE','RISK_STICKER',2568,11,14,null),
  ('CHE','RISK_STICKER',2568,12,2,null),('CHE','RISK_STICKER',2568,1,3,null),
  ('CHE','RISK_STICKER',2568,2,8,null),('CHE','RISK_STICKER',2568,3,12,null),
  ('CHE','RISK_STICKER',2568,4,5,null),('CHE','RISK_STICKER',2568,5,16,null),
  ('CHE','RISK_STICKER',2568,6,6,null),('CHE','RISK_STICKER',2568,7,5,null),
  ('CHE','RISK_STICKER',2568,8,4,null),('CHE','RISK_STICKER',2568,9,8,null),
  ('CHE','RISK_NEARMISS',2568,11,1,1),('CHE','RISK_NEARMISS',2568,8,2,0),

  -- ════════ IMM ภูมิคุ้มกันวิทยา ════════
  ('IMM','TAT_ROUTINE',2568,10,4269,7043),('IMM','TAT_ROUTINE',2568,11,4085,6380),
  ('IMM','TAT_ROUTINE',2568,12,3495,5539),('IMM','TAT_ROUTINE',2568,1,8081,13129),
  ('IMM','TAT_ROUTINE',2568,2,7682,11785),('IMM','TAT_ROUTINE',2568,3,8867,13367),
  ('IMM','TAT_ROUTINE',2568,4,7826,11387),('IMM','TAT_ROUTINE',2568,5,9346,13047),
  ('IMM','TAT_ROUTINE',2568,6,5630,6596),('IMM','TAT_ROUTINE',2568,7,7246,8147),
  ('IMM','TAT_ROUTINE',2568,8,6030,6982),('IMM','TAT_ROUTINE',2568,9,8543,9423),
  ('IMM','ERR_REPORT',2568,10,0,7043),('IMM','ERR_REPORT',2568,11,0,6380),
  ('IMM','ERR_REPORT',2568,12,0,5539),('IMM','ERR_REPORT',2568,1,0,13129),
  ('IMM','ERR_REPORT',2568,2,1,11785),('IMM','ERR_REPORT',2568,3,0,13367),
  ('IMM','ERR_REPORT',2568,4,0,11387),('IMM','ERR_REPORT',2568,5,1,13047),
  ('IMM','RISK_ID_WARD',2568,4,1,null),('IMM','RISK_ID_WARD',2568,6,1,null),
  ('IMM','RISK_ID_WARD',2568,9,1,null),
  ('IMM','RISK_STICKER',2568,7,1,null),('IMM','RISK_STICKER',2568,8,3,null),
  ('IMM','RISK_STICKER',2568,9,1,null),
  ('IMM','RISK_NEARMISS',2568,11,1,1),('IMM','RISK_NEARMISS',2568,4,1,1),
  ('IMM','RISK_NEARMISS',2568,9,2,2),

  -- ════════ HEM โลหิตวิทยา ════════
  ('HEM','TAT_ROUTINE',2568,10,27866,31506),('HEM','TAT_ROUTINE',2568,11,28171,30806),
  ('HEM','TAT_ROUTINE',2568,12,26247,28939),('HEM','TAT_ROUTINE',2568,1,29845,32631),
  ('HEM','TAT_ROUTINE',2568,2,25388,28311),('HEM','TAT_ROUTINE',2568,3,28100,31428),
  ('HEM','TAT_ROUTINE',2568,4,25517,27976),('HEM','TAT_ROUTINE',2568,5,30153,33006),
  ('HEM','TAT_ROUTINE',2568,6,26975,30022),('HEM','TAT_ROUTINE',2568,7,28671,31483),
  ('HEM','TAT_ROUTINE',2568,8,28333,30929),('HEM','TAT_ROUTINE',2568,9,28142,30579),
  ('HEM','TAT_STROKE',2568,10,72,78),('HEM','TAT_STROKE',2568,11,70,74),
  ('HEM','TAT_STROKE',2568,12,77,84),('HEM','TAT_STROKE',2568,1,46,52),
  ('HEM','TAT_STROKE',2568,2,54,55),('HEM','TAT_STROKE',2568,3,56,64),
  ('HEM','TAT_STROKE',2568,4,57,58),('HEM','TAT_STROKE',2568,5,48,54),
  ('HEM','TAT_STROKE',2568,6,60,62),('HEM','TAT_STROKE',2568,7,83,84),
  ('HEM','TAT_STROKE',2568,8,70,74),('HEM','TAT_STROKE',2568,9,56,62),
  ('HEM','TAT_CRITICAL',2568,10,98,231),('HEM','TAT_CRITICAL',2568,11,101,234),
  ('HEM','TAT_CRITICAL',2568,12,146,253),('HEM','TAT_CRITICAL',2568,1,155,260),
  ('HEM','TAT_CRITICAL',2568,2,159,263),('HEM','TAT_CRITICAL',2568,3,164,334),
  ('HEM','TAT_CRITICAL',2568,4,166,276),('HEM','TAT_CRITICAL',2568,5,151,287),
  ('HEM','TAT_CRITICAL',2568,6,118,227),('HEM','TAT_CRITICAL',2568,7,126,236),
  ('HEM','TAT_CRITICAL',2568,8,103,197),('HEM','TAT_CRITICAL',2568,9,121,214),
  ('HEM','ERR_REPORT',2568,10,0,31506),('HEM','ERR_REPORT',2568,11,0,30806),
  ('HEM','ERR_REPORT',2568,12,0,28939),('HEM','ERR_REPORT',2568,1,0,32631),
  ('HEM','ERR_REPORT',2568,2,0,28311),('HEM','ERR_REPORT',2568,3,0,31428),
  ('HEM','ERR_REPORT',2568,4,0,27976),('HEM','ERR_REPORT',2568,5,0,33006),
  ('HEM','ERR_REPORT',2568,6,0,30022),('HEM','ERR_REPORT',2568,7,0,31483),
  ('HEM','ERR_REPORT',2568,8,0,30929),('HEM','ERR_REPORT',2568,9,0,30579),
  ('HEM','RISK_ID_OPD',2568,10,1,null),('HEM','RISK_ID_OPD',2568,1,1,null),
  ('HEM','RISK_ID_OPD',2568,4,5,null),('HEM','RISK_ID_OPD',2568,5,2,null),
  ('HEM','RISK_ID_OPD',2568,6,1,null),('HEM','RISK_ID_OPD',2568,9,1,null),
  ('HEM','RISK_ID_WARD',2568,10,5,null),('HEM','RISK_ID_WARD',2568,11,4,null),
  ('HEM','RISK_ID_WARD',2568,12,2,null),('HEM','RISK_ID_WARD',2568,1,1,null),
  ('HEM','RISK_ID_WARD',2568,3,1,null),('HEM','RISK_ID_WARD',2568,4,8,null),
  ('HEM','RISK_ID_WARD',2568,5,1,null),('HEM','RISK_ID_WARD',2568,7,7,null),
  ('HEM','RISK_ID_WARD',2568,8,4,null),('HEM','RISK_ID_WARD',2568,9,8,null),
  ('HEM','RISK_STICKER',2568,4,1,null),('HEM','RISK_STICKER',2568,8,1,null),
  ('HEM','RISK_NEARMISS',2568,11,1,1),

  -- ════════ MIS จุลทรรศน์ศาสตร์ ════════
  ('MIS','TAT_ROUTINE',2568,10,9314,10162),('MIS','TAT_ROUTINE',2568,11,9146,9705),
  ('MIS','TAT_ROUTINE',2568,12,8398,8924),('MIS','TAT_ROUTINE',2568,1,9894,10834),
  ('MIS','TAT_ROUTINE',2568,2,8866,9506),('MIS','TAT_ROUTINE',2568,3,9295,10279),
  ('MIS','TAT_ROUTINE',2568,4,8480,9234),('MIS','TAT_ROUTINE',2568,5,10457,12810),
  ('MIS','TAT_ROUTINE',2568,6,9109,10038),('MIS','TAT_ROUTINE',2568,7,10289,11240),
  ('MIS','TAT_ROUTINE',2568,8,10782,11920),('MIS','TAT_ROUTINE',2568,9,9875,10188),
  ('MIS','ERR_REPORT',2568,10,0,10162),('MIS','ERR_REPORT',2568,11,0,9705),
  ('MIS','ERR_REPORT',2568,12,0,8924),('MIS','ERR_REPORT',2568,1,0,10834),
  ('MIS','ERR_REPORT',2568,2,0,9506),('MIS','ERR_REPORT',2568,3,0,10279),
  ('MIS','ERR_REPORT',2568,4,0,9234),('MIS','ERR_REPORT',2568,5,0,12810),
  ('MIS','ERR_REPORT',2568,6,0,10038),
  ('MIS','RISK_ID_WARD',2568,11,1,null),('MIS','RISK_ID_WARD',2568,1,1,null),
  ('MIS','RISK_ID_WARD',2568,3,2,null),('MIS','RISK_ID_WARD',2568,5,1,null),
  ('MIS','RISK_STICKER',2568,1,1,null),
  ('MIS','RISK_NEARMISS',2568,11,0,1),('MIS','RISK_NEARMISS',2568,1,0,2),
  ('MIS','RISK_NEARMISS',2568,3,0,2),('MIS','RISK_NEARMISS',2568,5,0,1),

  -- ════════ MIC จุลชีววิทยา ════════
  ('MIC','TAT_ROUTINE',2568,10,8732,9620),('MIC','TAT_ROUTINE',2568,11,7692,8636),
  ('MIC','TAT_ROUTINE',2568,12,7351,8182),('MIC','TAT_ROUTINE',2568,1,8626,9651),
  ('MIC','TAT_ROUTINE',2568,2,7430,8168),('MIC','TAT_ROUTINE',2568,3,8692,9650),
  ('MIC','TAT_ROUTINE',2568,4,7712,8403),('MIC','TAT_ROUTINE',2568,5,8527,9295),
  ('MIC','TAT_ROUTINE',2568,6,8193,9047),('MIC','TAT_ROUTINE',2568,7,8402,9229),
  ('MIC','TAT_ROUTINE',2568,8,7994,8673),('MIC','TAT_ROUTINE',2568,9,16173,17654),
  ('MIC','TAT_CRITICAL',2568,10,266,307),('MIC','TAT_CRITICAL',2568,11,217,249),
  ('MIC','TAT_CRITICAL',2568,12,202,241),('MIC','TAT_CRITICAL',2568,1,223,261),
  ('MIC','TAT_CRITICAL',2568,2,166,206),('MIC','TAT_CRITICAL',2568,3,256,311),
  ('MIC','TAT_CRITICAL',2568,4,238,283),('MIC','TAT_CRITICAL',2568,5,266,333),
  ('MIC','TAT_CRITICAL',2568,6,212,304),('MIC','TAT_CRITICAL',2568,7,199,254),
  ('MIC','TAT_CRITICAL',2568,8,298,357),('MIC','TAT_CRITICAL',2568,9,235,265),
  ('MIC','ERR_REPORT',2568,10,1,9620),('MIC','ERR_REPORT',2568,11,0,8636),
  ('MIC','ERR_REPORT',2568,12,2,8182),('MIC','ERR_REPORT',2568,1,1,9651),
  ('MIC','ERR_REPORT',2568,2,2,8168),('MIC','ERR_REPORT',2568,3,0,9650),
  ('MIC','ERR_REPORT',2568,4,0,8403),('MIC','ERR_REPORT',2568,5,2,9295),
  ('MIC','ERR_REPORT',2568,6,1,9047),('MIC','ERR_REPORT',2568,7,2,9229),
  ('MIC','ERR_REPORT',2568,8,0,8673),('MIC','ERR_REPORT',2568,9,0,17654),
  ('MIC','RISK_STICKER',2568,10,3,null),('MIC','RISK_STICKER',2568,2,3,null),
  ('MIC','RISK_NEARMISS',2568,10,1,3),('MIC','RISK_NEARMISS',2568,2,2,3),

  -- ════════ MOL อณูชีววิทยา ════════
  ('MOL','TAT_ROUTINE',2568,10,1930,1939),('MOL','TAT_ROUTINE',2568,11,1762,1779),
  ('MOL','TAT_ROUTINE',2568,12,1950,1973),('MOL','TAT_ROUTINE',2568,1,1945,1953),
  ('MOL','TAT_ROUTINE',2568,2,1952,1982),('MOL','TAT_ROUTINE',2568,3,1937,1959),
  ('MOL','TAT_ROUTINE',2568,4,1450,1461),('MOL','TAT_ROUTINE',2568,5,1743,1751),
  ('MOL','TAT_ROUTINE',2568,6,1460,1465),('MOL','TAT_ROUTINE',2568,7,1880,1886),
  ('MOL','TAT_ROUTINE',2568,8,1687,1690),('MOL','TAT_ROUTINE',2568,9,1770,1774),
  ('MOL','ERR_REPORT',2568,10,0,1939),('MOL','ERR_REPORT',2568,11,0,1779),
  ('MOL','ERR_REPORT',2568,12,0,1973),('MOL','ERR_REPORT',2568,1,0,1953),
  ('MOL','ERR_REPORT',2568,2,0,1982),('MOL','ERR_REPORT',2568,3,0,1959),
  ('MOL','ERR_REPORT',2568,4,0,1461),('MOL','ERR_REPORT',2568,5,0,1751),
  ('MOL','ERR_REPORT',2568,6,0,1465),('MOL','ERR_REPORT',2568,7,0,1886),
  ('MOL','ERR_REPORT',2568,8,0,1690),('MOL','ERR_REPORT',2568,9,0,1774),
  ('MOL','RISK_ID_OPD',2568,6,1,null),
  ('MOL','RISK_NEARMISS',2568,10,1,1),('MOL','RISK_NEARMISS',2568,11,3,3),
  ('MOL','RISK_NEARMISS',2568,12,8,8),('MOL','RISK_NEARMISS',2568,1,14,14),
  ('MOL','RISK_NEARMISS',2568,2,6,6),('MOL','RISK_NEARMISS',2568,3,7,7),
  ('MOL','RISK_NEARMISS',2568,4,6,6),('MOL','RISK_NEARMISS',2568,5,19,19),
  ('MOL','RISK_NEARMISS',2568,6,8,8),('MOL','RISK_NEARMISS',2568,7,1,1),
  ('MOL','RISK_NEARMISS',2568,8,1,1),('MOL','RISK_NEARMISS',2568,9,2,2),

  -- ════════ BLB คลังเลือด ════════
  ('BLB','TAT_ROUTINE',2568,10,3781,4322),('BLB','TAT_ROUTINE',2568,11,3325,3841),
  ('BLB','TAT_ROUTINE',2568,12,3415,4033),('BLB','TAT_ROUTINE',2568,1,3603,4230),
  ('BLB','TAT_ROUTINE',2568,2,3207,3719),('BLB','TAT_ROUTINE',2568,3,3709,4256),
  ('BLB','TAT_ROUTINE',2568,4,3259,3757),('BLB','TAT_ROUTINE',2568,5,3755,4440),
  ('BLB','TAT_ROUTINE',2568,6,3592,4227),('BLB','TAT_ROUTINE',2568,7,3336,4154),
  ('BLB','TAT_ROUTINE',2568,8,3210,4107),('BLB','TAT_ROUTINE',2568,9,3299,4396),
  ('BLB','TAT_UNCROSS',2568,10,20,20),('BLB','TAT_UNCROSS',2568,11,12,12),
  ('BLB','TAT_UNCROSS',2568,12,21,21),('BLB','TAT_UNCROSS',2568,1,16,16),
  ('BLB','TAT_UNCROSS',2568,2,17,17),('BLB','TAT_UNCROSS',2568,3,19,19),
  ('BLB','TAT_UNCROSS',2568,4,12,12),('BLB','TAT_UNCROSS',2568,5,24,24),
  ('BLB','TAT_UNCROSS',2568,6,13,13),('BLB','TAT_UNCROSS',2568,7,11,11),
  ('BLB','TAT_UNCROSS',2568,8,9,9),('BLB','TAT_UNCROSS',2568,9,23,23),
  ('BLB','ERR_REPORT',2568,10,0,4322),('BLB','ERR_REPORT',2568,11,0,3841),
  ('BLB','ERR_REPORT',2568,12,0,4033),('BLB','ERR_REPORT',2568,1,0,4230),
  ('BLB','ERR_REPORT',2568,2,0,3719),('BLB','ERR_REPORT',2568,3,0,4256),
  ('BLB','ERR_REPORT',2568,4,0,3757),('BLB','ERR_REPORT',2568,5,0,4440),
  ('BLB','ERR_REPORT',2568,6,1,4227),('BLB','ERR_REPORT',2568,7,0,4154),
  ('BLB','ERR_REPORT',2568,8,0,4107),('BLB','ERR_REPORT',2568,9,0,4396),
  ('BLB','RISK_ID_WARD',2568,3,1,null),('BLB','RISK_ID_WARD',2568,4,1,null),
  ('BLB','RISK_ID_WARD',2568,7,1,null),('BLB','RISK_ID_WARD',2568,8,2,null),
  ('BLB','RISK_STICKER',2568,10,4,null),('BLB','RISK_STICKER',2568,11,3,null),
  ('BLB','RISK_STICKER',2568,12,5,null),('BLB','RISK_STICKER',2568,1,11,null),
  ('BLB','RISK_STICKER',2568,2,6,null),('BLB','RISK_STICKER',2568,3,7,null),
  ('BLB','RISK_STICKER',2568,4,3,null),('BLB','RISK_STICKER',2568,5,8,null),
  ('BLB','RISK_STICKER',2568,6,13,null),('BLB','RISK_STICKER',2568,7,5,null),
  ('BLB','RISK_STICKER',2568,8,16,null),('BLB','RISK_STICKER',2568,9,8,null),
  ('BLB','RISK_NEARMISS',2568,10,10,10),('BLB','RISK_NEARMISS',2568,11,5,5),
  ('BLB','RISK_NEARMISS',2568,12,7,7),('BLB','RISK_NEARMISS',2568,1,10,10),
  ('BLB','RISK_NEARMISS',2568,2,8,8),('BLB','RISK_NEARMISS',2568,3,18,19),
  ('BLB','RISK_NEARMISS',2568,4,7,8),('BLB','RISK_NEARMISS',2568,5,14,14),
  ('BLB','RISK_NEARMISS',2568,6,14,15),('BLB','RISK_NEARMISS',2568,7,28,28),
  ('BLB','RISK_NEARMISS',2568,8,35,42),('BLB','RISK_NEARMISS',2568,9,29,34),

  -- ════════ MCL ศสม. ════════
  ('MCL','TAT_ROUTINE',2568,10,8064,8365),('MCL','TAT_ROUTINE',2568,11,8189,8440),
  ('MCL','TAT_ROUTINE',2568,12,6629,7346),('MCL','TAT_ROUTINE',2568,1,7751,7987),
  ('MCL','TAT_ROUTINE',2568,2,5895,6029),('MCL','TAT_ROUTINE',2568,3,5297,5324),
  ('MCL','TAT_ROUTINE',2568,4,3365,3383),('MCL','TAT_ROUTINE',2568,5,4475,4547),
  ('MCL','TAT_ROUTINE',2568,6,4302,4329),('MCL','TAT_ROUTINE',2568,7,3927,3948),
  ('MCL','TAT_ROUTINE',2568,8,3840,3862),('MCL','TAT_ROUTINE',2568,9,4790,4856),
  ('MCL','TAT_CRITICAL',2568,10,12,15),('MCL','TAT_CRITICAL',2568,11,6,10),
  ('MCL','TAT_CRITICAL',2568,12,9,12),('MCL','TAT_CRITICAL',2568,1,3,3),
  ('MCL','TAT_CRITICAL',2568,2,10,11),('MCL','TAT_CRITICAL',2568,3,1,1),
  ('MCL','TAT_CRITICAL',2568,4,5,6),('MCL','TAT_CRITICAL',2568,5,6,6),
  ('MCL','TAT_CRITICAL',2568,6,2,5),('MCL','TAT_CRITICAL',2568,7,2,4),
  ('MCL','TAT_CRITICAL',2568,8,3,8),('MCL','TAT_CRITICAL',2568,9,5,6),
  ('MCL','ERR_REPORT',2568,10,0,8365),('MCL','ERR_REPORT',2568,11,0,8440),
  ('MCL','ERR_REPORT',2568,12,0,7346),('MCL','ERR_REPORT',2568,1,0,7987),
  ('MCL','ERR_REPORT',2568,2,0,6029),('MCL','ERR_REPORT',2568,3,0,5324),
  ('MCL','ERR_REPORT',2568,4,0,3383),('MCL','ERR_REPORT',2568,5,0,4547),
  ('MCL','ERR_REPORT',2568,6,0,4329),('MCL','ERR_REPORT',2568,7,0,3948),
  ('MCL','ERR_REPORT',2568,8,0,3862),('MCL','ERR_REPORT',2568,9,0,4856),

  -- ════════ OUT OUT LAB ════════
  ('OUT','TAT_ROUTINE',2568,10,2560,2564),('OUT','TAT_ROUTINE',2568,11,1800,1809),
  ('OUT','TAT_ROUTINE',2568,12,1550,1559),('OUT','TAT_ROUTINE',2568,1,1870,1876),
  ('OUT','TAT_ROUTINE',2568,2,1665,1673),('OUT','TAT_ROUTINE',2568,3,1870,1877),
  ('OUT','TAT_ROUTINE',2568,4,2040,2049),('OUT','TAT_ROUTINE',2568,5,2015,2024),
  ('OUT','TAT_ROUTINE',2568,6,1804,1808),('OUT','TAT_ROUTINE',2568,7,1940,1944),
  ('OUT','TAT_ROUTINE',2568,8,1390,1398),('OUT','TAT_ROUTINE',2568,9,1349,1354),
  ('OUT','ERR_REPORT',2568,10,0,2564),('OUT','ERR_REPORT',2568,11,0,1809),
  ('OUT','ERR_REPORT',2568,12,0,1559),('OUT','ERR_REPORT',2568,1,0,1876),
  ('OUT','ERR_REPORT',2568,2,0,1673),('OUT','ERR_REPORT',2568,3,0,1877),
  ('OUT','ERR_REPORT',2568,4,0,2049),('OUT','ERR_REPORT',2568,5,0,2024),
  ('OUT','ERR_REPORT',2568,6,0,1808),('OUT','ERR_REPORT',2568,7,0,1944),
  ('OUT','ERR_REPORT',2568,8,0,1398),('OUT','ERR_REPORT',2568,9,0,1354),

  -- ════════ OPD ════════ (ส่วนใหญ่ไม่มีข้อมูล มีเฉพาะ Ward errors + Sentinel)
  ('OPD','RISK_ID_WARD',2568,10,1,null),('OPD','RISK_ID_WARD',2568,11,1,null),
  ('OPD','RISK_ID_WARD',2568,3,1,null),('OPD','RISK_ID_WARD',2568,4,1,null),
  ('OPD','RISK_ID_WARD',2568,5,1,null),('OPD','RISK_ID_WARD',2568,6,1,null),
  ('OPD','RISK_ID_WARD',2568,7,1,null),('OPD','RISK_ID_WARD',2568,8,1,null),
  ('OPD','RISK_ID_WARD',2568,9,1,null),
  ('OPD','RISK_SENTINEL',2568,2,1,null)
)
insert into kpi_entries (dept_id, kpi_id, fiscal_year, month, numerator, denominator, result_pct)
select d.id, k.id, raw.fy, raw.mo, raw.num, raw.den,
  case
    when k.target_type = 'eq'           then null
    when raw.den is null or raw.den = 0 then null
    else round((raw.num::numeric / raw.den) * 100, 2)
  end
from raw
join d on d.code = raw.dept_code
join k on k.code = raw.kpi_code
on conflict (dept_id, kpi_id, fiscal_year, month) do update set
  numerator = excluded.numerator, denominator = excluded.denominator, result_pct = excluded.result_pct;

-- ─────────────────────────────────────────────────────────────────
-- ความพึงพอใจ ปีงบ 2568 (อัปเดต/เพิ่ม)
-- ─────────────────────────────────────────────────────────────────
insert into kpi_satisfaction (metric_code, metric_name, fiscal_year, value) values
  ('inpatient', 'ผู้ป่วยใน',         2568, 75.37),
  ('donor',     'ผู้รับบริจาคโลหิต', 2568, 91.32)
on conflict (metric_code, fiscal_year) do update set value = excluded.value;
