-- Org chart: store internal phone extension on each node (Fix: phone was mapped by
-- title on the public page, so renaming a box in the personnel module lost the phone).
-- Run via Supabase Dashboard → SQL Editor.

ALTER TABLE org_chart_nodes ADD COLUMN IF NOT EXISTS phone text;

-- Backfill the lab's known internal extensions onto existing boxes (only where empty),
-- so the current chart keeps its phone numbers immediately after this migration.
UPDATE org_chart_nodes AS o SET phone = v.phone
FROM (VALUES
  ('หัวหน้ากลุ่มงานเทคนิคการแพทย์',                              '1453'),
  ('รองหัวหน้ากลุ่มงานเทคนิคการแพทย์',                           '1464, 1469'),
  ('งานคลังเลือด',                                              '1458'),
  ('งานตรวจพิเศษ และห้องปฏิบัติการตรวจต่อ',                     '1452, 1461, 1467'),
  ('งานบริการผู้ป่วยนอก',                                       '1606-07'),
  ('ห้องปฏิบัติการ ศสม.เมืองชลบุรี',                            '1633-4'),
  ('งานจุลชีววิทยาคลินิก และคลังน้ำยา',                         '1462-63'),
  ('งานบริการทั่วไป',                                           '1455'),
  ('ห้องปฏิบัติการเคมีคลินิกและภูมิคุ้มกันวิทยาคลินิก',          '1464, 1469'),
  ('ห้องปฏิบัติการโลหิตวิทยาคลินิกและจุลทรรศนศาสตร์คลินิก',       '1465-66, 1468')
) AS v(title, phone)
WHERE o.title = v.title
  AND (o.phone IS NULL OR o.phone = '');
