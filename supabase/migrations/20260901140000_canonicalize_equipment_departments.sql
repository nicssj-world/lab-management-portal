-- Keep equipment department values aligned with the shared staff department names.
-- The application still accepts these aliases during rollout; this migration
-- removes the duplicate spellings already stored in the equipment table.

UPDATE public.equipment
SET department = CASE regexp_replace(trim(department), '[[:space:]]+', ' ', 'g')
  WHEN 'เคมีคลินิก' THEN 'งานเคมีคลินิก'
  WHEN 'โลหิตวิทยา' THEN 'งานโลหิตวิทยาคลินิก'
  WHEN 'ภูมิคุ้มกันวิทยา' THEN 'งานภูมิคุ้มกันวิทยาคลินิก'
  WHEN 'จุลทรรศน์' THEN 'งานจุลทรรศนศาสตร์คลินิก'
  WHEN 'จุลทรรศน์ศาสตร์' THEN 'งานจุลทรรศนศาสตร์คลินิก'
  WHEN 'จุลทรรศน์ศาสตร์คลินิก' THEN 'งานจุลทรรศนศาสตร์คลินิก'
  WHEN 'อณูชีววิทยา' THEN 'งานอณูชีววิทยา'
  WHEN 'จุลชีววิทยา' THEN 'งานจุลชีววิทยา'
  WHEN 'คลังเลือด' THEN 'งานคลังเลือด'
  WHEN 'ผู้ป่วยนอก' THEN 'งานบริการผู้ป่วยนอก'
  WHEN 'OPD' THEN 'งานบริการผู้ป่วยนอก'
  WHEN 'ศสม' THEN 'ห้องปฏิบัติการศูนย์สุขภาพชุมชนเมืองชลบุรี'
  WHEN 'ศสม.' THEN 'ห้องปฏิบัติการศูนย์สุขภาพชุมชนเมืองชลบุรี'
  WHEN 'Muang Chonburi' THEN 'ห้องปฏิบัติการศูนย์สุขภาพชุมชนเมืองชลบุรี'
  WHEN 'ตรวจพิเศษและปฏิบัติการตรวจต่อ' THEN 'งานตรวจพิเศษและห้องปฏิบัติการตรวจต่อ'
  WHEN 'งานตรวจพิเศษและปฏิบัติการตรวจต่อ' THEN 'งานตรวจพิเศษและห้องปฏิบัติการตรวจต่อ'
  WHEN 'ตรวจพิเศษและตรวจต่อ' THEN 'งานตรวจพิเศษและห้องปฏิบัติการตรวจต่อ'
  WHEN 'งานตรวจพิเศษและตรวจต่อ' THEN 'งานตรวจพิเศษและห้องปฏิบัติการตรวจต่อ'
  ELSE regexp_replace(trim(department), '[[:space:]]+', ' ', 'g')
END
WHERE regexp_replace(trim(department), '[[:space:]]+', ' ', 'g') IN (
  'เคมีคลินิก',
  'โลหิตวิทยา',
  'ภูมิคุ้มกันวิทยา',
  'จุลทรรศน์',
  'จุลทรรศน์ศาสตร์',
  'จุลทรรศน์ศาสตร์คลินิก',
  'อณูชีววิทยา',
  'จุลชีววิทยา',
  'คลังเลือด',
  'ผู้ป่วยนอก',
  'OPD',
  'ศสม',
  'ศสม.',
  'Muang Chonburi',
  'ตรวจพิเศษและปฏิบัติการตรวจต่อ',
  'งานตรวจพิเศษและปฏิบัติการตรวจต่อ',
  'ตรวจพิเศษและตรวจต่อ',
  'งานตรวจพิเศษและตรวจต่อ'
);
