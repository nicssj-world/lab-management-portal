-- ══════════════════════════════════════════════════════════════════
-- KPI Real Data Seed — ปีงบประมาณ 2569 (ต.ค. 2568 – เม.ย. 2569)
-- ข้อมูลจาก Google Sheets KPI 2569 รายแผนก (ตัวเลขจริงทุกเซลล์)
-- ══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- 0. ADD denominator COLUMN ถ้ายังไม่มี
-- ─────────────────────────────────────────────────────────────────
alter table kpi_definitions add column if not exists denominator text default null;

-- ─────────────────────────────────────────────────────────────────
-- 1. DEPARTMENTS
-- ─────────────────────────────────────────────────────────────────
insert into departments (code, name_th, is_active) values
  ('CHE', 'เคมีคลินิก',         true),
  ('IMM', 'ภูมิคุ้มกันวิทยา',   true),
  ('HEM', 'โลหิตวิทยา',         true),
  ('MIS', 'จุลทรรศน์ศาสตร์',   true),
  ('MIC', 'จุลชีววิทยา',        true),
  ('MOL', 'อณูชีววิทยา',        true),
  ('BLB', 'คลังเลือด',           true),
  ('OUT', 'OUT LAB',             true),
  ('MCL', 'ศสม.',                true),
  ('OPD', 'OPD',                 true)
on conflict (code) do update set name_th = excluded.name_th, is_active = excluded.is_active;

-- ─────────────────────────────────────────────────────────────────
-- 2. KPI DEFINITIONS
-- ─────────────────────────────────────────────────────────────────
insert into kpi_definitions (code, category, sub_code, name_th, unit, target_type, target_val, sort_order, denominator) values
  ('TAT_ROUTINE',   'TAT',   '1.1', 'Routine LAB ทันเวลา',       '%',     'gte', 95,   10, 'จำนวนส่งตรวจทั้งหมด'),
  ('TAT_STROKE',    'TAT',   '1.2', 'Stroke Fast Tract 30 นาที', '%',     'gte', 100,  20, 'จำนวนส่งตรวจทั้งหมด'),
  ('TAT_CRITICAL',  'TAT',   '1.3', 'ค่าวิกฤติ 15 นาที',         '%',     'gte', 100,  30, 'ค่าวิกฤติทั้งหมด'),
  ('TAT_UNCROSS',   'TAT',   '1.4', 'Uncrossmatch ทันเวลา',      '%',     'gte', 100,  40, 'จำนวนเตรียมจ่ายเลือดทั้งหมด'),
  ('ERR_REPORT',    'ERROR', '2',   'การรายงานผลคลาดเคลื่อน',   '%',     'lte', 0.05, 50, 'จำนวนรายการทั้งหมด'),
  ('RISK_BLOOD',    'RISK',  '3',   'ผู้ป่วยได้รับเลือดผิด',    'ครั้ง', 'eq',  0,    60, null),
  ('RISK_ID_OPD',   'RISK',  '4.1', 'เจาะเลือดผิด OPD',          'ครั้ง', 'eq',  0,    70, null),
  ('RISK_ID_WARD',  'RISK',  '4.1', 'เจาะเลือดผิด Ward',         'ครั้ง', 'eq',  0,    80, null),
  ('RISK_STICKER',  'RISK',  '4.1', 'ติดสติ๊กเกอร์ผิด',          'ครั้ง', 'eq',  0,    90, null),
  ('RISK_NEARMISS', 'RISK',  '4.2', 'Near Miss A-B',              '%',     'gte', 75,  100, 'อุบัติการณ์ทั้งหมด'),
  ('RISK_LOWRISK',  'RISK',  '4.3', 'Low Risk C-D',               '%',     'lte', 25,  110, 'อุบัติการณ์ทั้งหมด'),
  ('RISK_MODERATE', 'RISK',  '4.4', 'Moderate Risk E-F',          'ครั้ง', 'eq',  0,   120, null),
  ('RISK_SENTINEL', 'RISK',  '4.5', 'Sentinel Event G-I',         'ครั้ง', 'eq',  0,   130, null)
on conflict (code) do update set
  name_th = excluded.name_th, unit = excluded.unit,
  target_type = excluded.target_type, target_val = excluded.target_val,
  sort_order = excluded.sort_order, denominator = excluded.denominator,
  category = excluded.category, sub_code = excluded.sub_code;

-- ─────────────────────────────────────────────────────────────────
-- 3. KPI ENTRIES — ตัวเลขจริงจาก Google Sheets รายแผนก
-- ─────────────────────────────────────────────────────────────────
-- Columns: dept_code, kpi_code, fiscal_year, month, numerator, denominator
-- month: 10=ต.ค., 11=พ.ย., 12=ธ.ค., 1=ม.ค., 2=ก.พ., 3=มี.ค., 4=เม.ย.
-- fiscal_year 2569 = ต.ค. 2568 – ก.ย. 2569

with
  d   as (select id, code from departments),
  k   as (select id, code, target_type from kpi_definitions),
  raw (dept_code, kpi_code, fy, mo, num, den) as (values

  -- ════════════════════════════════════════════════════════════════
  -- CHE เคมีคลินิก
  -- ════════════════════════════════════════════════════════════════
  -- TAT_ROUTINE (Oct–Mar มีข้อมูล, Apr ยังไม่บันทึก)
  ('CHE','TAT_ROUTINE', 2569,10, 48991, 51349),
  ('CHE','TAT_ROUTINE', 2569,11, 47632, 50245),
  ('CHE','TAT_ROUTINE', 2569,12, 49098, 51367),
  ('CHE','TAT_ROUTINE', 2569, 1, 48709, 51899),
  ('CHE','TAT_ROUTINE', 2569, 2, 49578, 52467),
  ('CHE','TAT_ROUTINE', 2569, 3, 50122, 52988),
  -- TAT_CRITICAL (Oct–Jan มีข้อมูล)
  ('CHE','TAT_CRITICAL',2569,10,   416,   526),
  ('CHE','TAT_CRITICAL',2569,11,   378,   478),
  ('CHE','TAT_CRITICAL',2569,12,   379,   505),
  ('CHE','TAT_CRITICAL',2569, 1,   393,   522),
  -- ERR_REPORT: 0 ทุกเดือน (denominator = total routine tests)
  ('CHE','ERR_REPORT',2569,10,     0, 51349),
  ('CHE','ERR_REPORT',2569,11,     0, 50245),
  ('CHE','ERR_REPORT',2569,12,     0, 51367),
  ('CHE','ERR_REPORT',2569, 1,     0, 51899),
  ('CHE','ERR_REPORT',2569, 2,     0, 52467),
  ('CHE','ERR_REPORT',2569, 3,     0, 52988),
  -- Near Miss A-B (denominator = Near Miss + Low Risk per month)
  ('CHE','RISK_NEARMISS',2569,10,   1,    1),
  ('CHE','RISK_NEARMISS',2569,11,   0,    8),
  ('CHE','RISK_NEARMISS',2569,12,   0,    6),
  ('CHE','RISK_NEARMISS',2569, 1,   1,    4),
  ('CHE','RISK_NEARMISS',2569, 2,   2,    6),
  ('CHE','RISK_NEARMISS',2569, 3,   0,    8),
  -- Low Risk C-D
  ('CHE','RISK_LOWRISK', 2569,10,   0,    1),
  ('CHE','RISK_LOWRISK', 2569,11,   8,    8),
  ('CHE','RISK_LOWRISK', 2569,12,   6,    6),
  ('CHE','RISK_LOWRISK', 2569, 1,   3,    4),
  ('CHE','RISK_LOWRISK', 2569, 2,   4,    6),
  ('CHE','RISK_LOWRISK', 2569, 3,   8,    8),

  -- ════════════════════════════════════════════════════════════════
  -- IMM ภูมิคุ้มกันวิทยา — ข้อมูลรายเดือนครบ 7 เดือน
  -- ════════════════════════════════════════════════════════════════
  ('IMM','TAT_ROUTINE', 2569,10,  7781,  8961),
  ('IMM','TAT_ROUTINE', 2569,11,  7658,  8648),
  ('IMM','TAT_ROUTINE', 2569,12,  6946,  8488),
  ('IMM','TAT_ROUTINE', 2569, 1,  7646,  9304),
  ('IMM','TAT_ROUTINE', 2569, 2,  8001,  9184),
  ('IMM','TAT_ROUTINE', 2569, 3,  8799, 10280),
  ('IMM','TAT_ROUTINE', 2569, 4,  7653,  8586),
  -- ERR_REPORT: 0 ทุกเดือน
  ('IMM','ERR_REPORT',2569,10,     0,  8961),
  ('IMM','ERR_REPORT',2569,11,     0,  8648),
  ('IMM','ERR_REPORT',2569,12,     0,  8488),
  ('IMM','ERR_REPORT',2569, 1,     0,  9304),
  ('IMM','ERR_REPORT',2569, 2,     0,  9184),
  ('IMM','ERR_REPORT',2569, 3,     0, 10280),
  ('IMM','ERR_REPORT',2569, 4,     0,  8586),
  -- Near Miss & Low Risk (เดือนที่มีข้อมูล)
  ('IMM','RISK_NEARMISS',2569,12,   1,    2),
  ('IMM','RISK_NEARMISS',2569, 3,   1,    2),
  ('IMM','RISK_LOWRISK', 2569,10,   1,    1),
  ('IMM','RISK_LOWRISK', 2569, 1,   1,    1),
  ('IMM','RISK_LOWRISK', 2569,12,   1,    2),
  ('IMM','RISK_LOWRISK', 2569, 3,   1,    2),

  -- ════════════════════════════════════════════════════════════════
  -- HEM โลหิตวิทยา — ครบ 7 เดือน
  -- ════════════════════════════════════════════════════════════════
  ('HEM','TAT_ROUTINE', 2569,10, 28917, 31510),
  ('HEM','TAT_ROUTINE', 2569,11, 27574, 30563),
  ('HEM','TAT_ROUTINE', 2569,12, 28214, 31422),
  ('HEM','TAT_ROUTINE', 2569, 1, 28563, 31627),
  ('HEM','TAT_ROUTINE', 2569, 2, 26012, 28858),
  ('HEM','TAT_ROUTINE', 2569, 3, 28913, 32071),
  ('HEM','TAT_ROUTINE', 2569, 4, 26291, 28725),
  -- TAT_STROKE (ข้อมูลจาก Sheet1 = HEM ทั้งหมด)
  ('HEM','TAT_STROKE',2569,10,    61,    62),
  ('HEM','TAT_STROKE',2569,11,    61,    68),
  ('HEM','TAT_STROKE',2569,12,    50,    54),
  ('HEM','TAT_STROKE',2569, 1,    69,    70),
  ('HEM','TAT_STROKE',2569, 2,    70,    74),
  ('HEM','TAT_STROKE',2569, 3,    55,    56),
  ('HEM','TAT_STROKE',2569, 4,    38,    42),
  -- TAT_CRITICAL
  ('HEM','TAT_CRITICAL',2569,10,   116,   226),
  ('HEM','TAT_CRITICAL',2569,11,   145,   279),
  ('HEM','TAT_CRITICAL',2569,12,   144,   255),
  ('HEM','TAT_CRITICAL',2569, 1,   125,   232),
  ('HEM','TAT_CRITICAL',2569, 2,   125,   234),
  ('HEM','TAT_CRITICAL',2569, 3,   142,   233),
  ('HEM','TAT_CRITICAL',2569, 4,   188,   315),
  -- ERR_REPORT (3 errors: Dec, Feb, Mar)
  ('HEM','ERR_REPORT',2569,10,     0, 31510),
  ('HEM','ERR_REPORT',2569,11,     0, 30563),
  ('HEM','ERR_REPORT',2569,12,     1, 31422),
  ('HEM','ERR_REPORT',2569, 1,     0, 31627),
  ('HEM','ERR_REPORT',2569, 2,     1, 28858),
  ('HEM','ERR_REPORT',2569, 3,     1, 32071),
  ('HEM','ERR_REPORT',2569, 4,     0, 28725),
  -- IPSG1
  ('HEM','RISK_ID_OPD',2569,10,   3, null),
  ('HEM','RISK_ID_OPD',2569,11,   2, null),
  ('HEM','RISK_ID_OPD',2569,12,   3, null),
  ('HEM','RISK_ID_OPD',2569, 1,   2, null),
  ('HEM','RISK_ID_OPD',2569, 2,   3, null),
  ('HEM','RISK_ID_OPD',2569, 3,   1, null),
  ('HEM','RISK_ID_OPD',2569, 4,   1, null),
  ('HEM','RISK_ID_WARD', 2569,10,   1, null),
  ('HEM','RISK_ID_WARD', 2569,11,   3, null),
  ('HEM','RISK_ID_WARD', 2569,12,   2, null),
  ('HEM','RISK_ID_WARD', 2569, 1,   5, null),
  ('HEM','RISK_ID_WARD', 2569, 2,   5, null),
  ('HEM','RISK_ID_WARD', 2569, 3,   4, null),
  ('HEM','RISK_ID_WARD', 2569, 4,   2, null),
  ('HEM','RISK_STICKER', 2569,10,   1, null),
  ('HEM','RISK_STICKER', 2569,11,   1, null),
  ('HEM','RISK_STICKER', 2569,12,   1, null),
  ('HEM','RISK_STICKER', 2569, 1,   1, null),
  ('HEM','RISK_STICKER', 2569, 2,   2, null),
  ('HEM','RISK_STICKER', 2569, 3,   1, null),
  ('HEM','RISK_STICKER', 2569, 4,   2, null),
  -- Near Miss / Low Risk
  ('HEM','RISK_NEARMISS',2569,10,   0,    0),
  ('HEM','RISK_NEARMISS',2569,11,   0,    0),
  ('HEM','RISK_NEARMISS',2569,12,   0,    0),
  ('HEM','RISK_NEARMISS',2569, 1,   0,    0),
  ('HEM','RISK_NEARMISS',2569, 2,   3,  189),
  ('HEM','RISK_NEARMISS',2569, 3,  27,  263),
  ('HEM','RISK_NEARMISS',2569, 4, 220,  237),
  ('HEM','RISK_LOWRISK', 2569,10, 245,  256),
  ('HEM','RISK_LOWRISK', 2569,11, 259,  274),
  ('HEM','RISK_LOWRISK', 2569,12, 222,  235),
  ('HEM','RISK_LOWRISK', 2569, 1, 195,  209),
  ('HEM','RISK_LOWRISK', 2569, 2, 169,  186),
  ('HEM','RISK_LOWRISK', 2569, 3, 236,  263),
  ('HEM','RISK_LOWRISK', 2569, 4,  20,  237),

  -- ════════════════════════════════════════════════════════════════
  -- MIS จุลทรรศน์ศาสตร์ — 5 เดือน (Oct–Feb)
  -- ════════════════════════════════════════════════════════════════
  ('MIS','TAT_ROUTINE', 2569,10,  9041,  9412),
  ('MIS','TAT_ROUTINE', 2569,11,  8238,  8618),
  ('MIS','TAT_ROUTINE', 2569,12,  8029,  8548),
  ('MIS','TAT_ROUTINE', 2569, 1,  8901,  9615),
  ('MIS','TAT_ROUTINE', 2569, 2,  8759,  9101),
  ('MIS','ERR_REPORT',2569,10,     0,  9412),
  ('MIS','ERR_REPORT',2569,11,     0,  8618),
  ('MIS','ERR_REPORT',2569,12,     0,  8548),
  ('MIS','ERR_REPORT',2569, 1,     0,  9615),
  ('MIS','ERR_REPORT',2569, 2,     0,  9101),
  ('MIS','RISK_ID_OPD',2569,10,   8, null),
  ('MIS','RISK_ID_OPD',2569,11,   3, null),
  ('MIS','RISK_ID_OPD',2569,12,   2, null),
  ('MIS','RISK_ID_OPD',2569, 1,   5, null),
  ('MIS','RISK_ID_OPD',2569, 2,   7, null),
  ('MIS','RISK_ID_WARD', 2569,10,   2, null),
  ('MIS','RISK_ID_WARD', 2569,11,   1, null),
  ('MIS','RISK_ID_WARD', 2569,12,   1, null),
  ('MIS','RISK_ID_WARD', 2569, 1,   4, null),
  ('MIS','RISK_ID_WARD', 2569, 2,   2, null),
  ('MIS','RISK_STICKER', 2569,10,   2, null),
  ('MIS','RISK_STICKER', 2569,11,   7, null),
  ('MIS','RISK_STICKER', 2569,12,   4, null),
  ('MIS','RISK_STICKER', 2569, 1,   5, null),
  ('MIS','RISK_STICKER', 2569, 2,   2, null),

  -- ════════════════════════════════════════════════════════════════
  -- MIC จุลชีววิทยา — 5 เดือน (Oct–Feb)
  -- ════════════════════════════════════════════════════════════════
  ('MIC','TAT_ROUTINE', 2569,10,  8592,  9553),
  ('MIC','TAT_ROUTINE', 2569,11,  8133,  8851),
  ('MIC','TAT_ROUTINE', 2569,12,  8482,  9282),
  ('MIC','TAT_ROUTINE', 2569, 1,  8158,  9181),
  ('MIC','TAT_ROUTINE', 2569, 2,  5844,  6126),
  ('MIC','TAT_CRITICAL',2569,10,   233,   282),
  ('MIC','TAT_CRITICAL',2569,11,   239,   301),
  ('MIC','TAT_CRITICAL',2569,12,   238,   297),
  ('MIC','TAT_CRITICAL',2569, 1,   181,   221),
  ('MIC','TAT_CRITICAL',2569, 2,   177,   203),
  -- ERR_REPORT (2 errors Dec, 1 error Jan)
  ('MIC','ERR_REPORT',2569,10,     0,  9553),
  ('MIC','ERR_REPORT',2569,11,     0,  8851),
  ('MIC','ERR_REPORT',2569,12,     2,  9282),
  ('MIC','ERR_REPORT',2569, 1,     1,  9181),
  ('MIC','ERR_REPORT',2569, 2,     0,  6126),
  -- Near Miss
  ('MIC','RISK_NEARMISS',2569,10,   1,    1),
  -- Low Risk
  ('MIC','RISK_LOWRISK', 2569,11,   1,    1),

  -- ════════════════════════════════════════════════════════════════
  -- MOL อณูชีววิทยา — ครบ 7 เดือน (TAT 100% ทุกเดือน)
  -- ════════════════════════════════════════════════════════════════
  ('MOL','TAT_ROUTINE', 2569,10,  2094,  2094),
  ('MOL','TAT_ROUTINE', 2569,11,  1609,  1609),
  ('MOL','TAT_ROUTINE', 2569,12,  1984,  1984),
  ('MOL','TAT_ROUTINE', 2569, 1,  1715,  1715),
  ('MOL','TAT_ROUTINE', 2569, 2,  1916,  1916),
  ('MOL','TAT_ROUTINE', 2569, 3,  1760,  1760),
  ('MOL','TAT_ROUTINE', 2569, 4,  1263,  1263),
  ('MOL','ERR_REPORT',2569,10,     0,  2094),
  ('MOL','ERR_REPORT',2569,11,     0,  1609),
  ('MOL','ERR_REPORT',2569,12,     0,  1984),
  ('MOL','ERR_REPORT',2569, 1,     0,  1715),
  ('MOL','ERR_REPORT',2569, 2,     0,  1916),
  ('MOL','ERR_REPORT',2569, 3,     0,  1760),
  ('MOL','ERR_REPORT',2569, 4,     0,  1263),
  -- Low Risk (Jan only)
  ('MOL','RISK_LOWRISK', 2569, 1,   1,    1),

  -- ════════════════════════════════════════════════════════════════
  -- BLB คลังเลือด — ครบ 7 เดือน
  -- ════════════════════════════════════════════════════════════════
  ('BLB','TAT_ROUTINE', 2569,10,  5452,  6796),
  ('BLB','TAT_ROUTINE', 2569,11,  6001,  7488),
  ('BLB','TAT_ROUTINE', 2569,12,  6352,  7815),
  ('BLB','TAT_ROUTINE', 2569, 1,  6218,  7647),
  ('BLB','TAT_ROUTINE', 2569, 2,  5685,  6701),
  ('BLB','TAT_ROUTINE', 2569, 3,  6528,  7756),
  ('BLB','TAT_ROUTINE', 2569, 4,  5698,  7117),
  -- TAT_UNCROSS (ข้อมูลจาก Sheet1 = BLB ทั้งหมด)
  ('BLB','TAT_UNCROSS', 2569,10,    13,    13),
  ('BLB','TAT_UNCROSS', 2569,11,    12,    12),
  ('BLB','TAT_UNCROSS', 2569,12,    13,    13),
  ('BLB','TAT_UNCROSS', 2569, 1,    26,    26),
  ('BLB','TAT_UNCROSS', 2569, 2,    14,    14),
  ('BLB','TAT_UNCROSS', 2569, 3,    25,    25),
  ('BLB','TAT_UNCROSS', 2569, 4,     9,     9),
  -- ERR_REPORT: 0 ทุกเดือน
  ('BLB','ERR_REPORT',2569,10,     0,  6796),
  ('BLB','ERR_REPORT',2569,11,     0,  7488),
  ('BLB','ERR_REPORT',2569,12,     0,  7815),
  ('BLB','ERR_REPORT',2569, 1,     0,  7647),
  ('BLB','ERR_REPORT',2569, 2,     0,  6701),
  ('BLB','ERR_REPORT',2569, 3,     0,  7756),
  ('BLB','ERR_REPORT',2569, 4,     0,  7117),
  -- IPSG1
  ('BLB','RISK_ID_WARD', 2569,10,   1, null),
  ('BLB','RISK_ID_WARD', 2569,11,   1, null),
  ('BLB','RISK_ID_WARD', 2569, 2,   1, null),
  ('BLB','RISK_ID_WARD', 2569, 4,   2, null),
  ('BLB','RISK_STICKER', 2569,10,  13, null),
  ('BLB','RISK_STICKER', 2569,11,  12, null),
  ('BLB','RISK_STICKER', 2569,12,  14, null),
  ('BLB','RISK_STICKER', 2569, 1,  15, null),
  ('BLB','RISK_STICKER', 2569, 2,   8, null),
  ('BLB','RISK_STICKER', 2569, 3,   8, null),
  ('BLB','RISK_STICKER', 2569, 4,   2, null),
  -- Near Miss / Low Risk
  ('BLB','RISK_NEARMISS',2569,10,  49,   55),
  ('BLB','RISK_NEARMISS',2569,11,  25,   32),
  ('BLB','RISK_NEARMISS',2569,12,  36,   38),
  ('BLB','RISK_NEARMISS',2569, 1,  15,   18),
  ('BLB','RISK_NEARMISS',2569, 2,  12,   18),
  ('BLB','RISK_NEARMISS',2569, 3,  19,   26),
  ('BLB','RISK_NEARMISS',2569, 4,  23,   26),
  ('BLB','RISK_LOWRISK', 2569,10,   6,   55),
  ('BLB','RISK_LOWRISK', 2569,11,   5,   32),
  ('BLB','RISK_LOWRISK', 2569,12,   2,   38),
  ('BLB','RISK_LOWRISK', 2569, 1,   3,   18),
  ('BLB','RISK_LOWRISK', 2569, 2,   6,   18),
  ('BLB','RISK_LOWRISK', 2569, 3,   7,   26),
  ('BLB','RISK_LOWRISK', 2569, 4,   3,   26),
  -- Sentinel: Nov มี 2 incidents
  ('BLB','RISK_SENTINEL',2569,11,   2, null),

  -- ════════════════════════════════════════════════════════════════
  -- MCL ศสม. — ครบ 7 เดือน
  -- ════════════════════════════════════════════════════════════════
  ('MCL','TAT_ROUTINE', 2569,10,  8665,  8989),
  ('MCL','TAT_ROUTINE', 2569,11,  8569,  8854),
  ('MCL','TAT_ROUTINE', 2569,12,  9223,  9271),
  ('MCL','TAT_ROUTINE', 2569, 1,  8896,  9185),
  ('MCL','TAT_ROUTINE', 2569, 2,  8394,  8447),
  ('MCL','TAT_ROUTINE', 2569, 3,  6598,  6631),
  ('MCL','TAT_ROUTINE', 2569, 4,  7294,  7340),
  ('MCL','TAT_CRITICAL',2569,10,     8,    16),
  ('MCL','TAT_CRITICAL',2569,11,    14,    17),
  ('MCL','TAT_CRITICAL',2569,12,    16,    23),
  ('MCL','TAT_CRITICAL',2569, 1,    11,    14),
  ('MCL','TAT_CRITICAL',2569, 2,     9,    11),
  ('MCL','TAT_CRITICAL',2569, 3,     6,     8),
  ('MCL','TAT_CRITICAL',2569, 4,    10,    17),
  ('MCL','ERR_REPORT',2569,10,     0,  8989),
  ('MCL','ERR_REPORT',2569,11,     0,  8854),
  ('MCL','ERR_REPORT',2569,12,     0,  9271),
  ('MCL','ERR_REPORT',2569, 1,     0,  9185),
  ('MCL','ERR_REPORT',2569, 2,     0,  8447),
  ('MCL','ERR_REPORT',2569, 3,     0,  6631),
  ('MCL','ERR_REPORT',2569, 4,     0,  7340),
  -- Near Miss / Low Risk (ข้อมูลน้อย)
  ('MCL','RISK_NEARMISS',2569,11,   1,    1),
  ('MCL','RISK_LOWRISK', 2569,12,   1,    1),

  -- ════════════════════════════════════════════════════════════════
  -- OUT OUT LAB — 6 เดือน (Oct–Mar)
  -- ════════════════════════════════════════════════════════════════
  ('OUT','TAT_ROUTINE', 2569,10,  1829,  1830),
  ('OUT','TAT_ROUTINE', 2569,11,  1041,  1044),
  ('OUT','TAT_ROUTINE', 2569,12,  1144,  1150),
  ('OUT','TAT_ROUTINE', 2569, 1,   995,   997),
  ('OUT','TAT_ROUTINE', 2569, 2,   917,   922),
  ('OUT','TAT_ROUTINE', 2569, 3,  1001,  1010),
  ('OUT','ERR_REPORT',2569,10,     0,  1830),
  ('OUT','ERR_REPORT',2569,11,     0,  1044),
  ('OUT','ERR_REPORT',2569,12,     0,  1150),
  ('OUT','ERR_REPORT',2569, 1,     0,   997),
  ('OUT','ERR_REPORT',2569, 2,     0,   922),
  ('OUT','ERR_REPORT',2569, 3,     0,  1010)

  -- OPD: ไม่มีข้อมูล (sheet ว่าง — OPD ส่ง HN ไปยังแผนกอื่น)
)
insert into kpi_entries (dept_id, kpi_id, fiscal_year, month, numerator, denominator, result_pct)
select
  d.id,
  k.id,
  raw.fy,
  raw.mo,
  raw.num,
  raw.den,
  case
    when k.target_type = 'eq'           then null
    when raw.den is null or raw.den = 0 then null
    else round((raw.num::numeric / raw.den) * 100, 2)
  end
from raw
join d on d.code = raw.dept_code
join k on k.code = raw.kpi_code
on conflict (dept_id, kpi_id, fiscal_year, month) do update set
  numerator   = excluded.numerator,
  denominator = excluded.denominator,
  result_pct  = excluded.result_pct;




