-- Complete the responsible-unit list for the chemical registry.
-- Run after scripts/chemical-safety-module.sql.
--
-- Existing import units are renamed in place so their IDs, holdings, product links,
-- and role scopes remain intact. The remaining units match profiles.dept exactly.
BEGIN;

UPDATE public.chemical_units
SET code = 'OFFICE', name_th = 'สำนักงานกลุ่มงานเทคนิคการแพทย์', active = true
WHERE code = 'TECHMED'
  AND name_th = 'กลุ่มงานเทคนิคการแพทย์'
  AND NOT EXISTS (
    SELECT 1 FROM public.chemical_units
    WHERE code = 'OFFICE' OR name_th = 'สำนักงานกลุ่มงานเทคนิคการแพทย์'
  );

UPDATE public.chemical_units
SET code = 'MICROBIOLOGY', name_th = 'งานจุลชีววิทยา', active = true
WHERE code = 'MICRO'
  AND name_th = 'จุลชีววิทยา'
  AND NOT EXISTS (
    SELECT 1 FROM public.chemical_units
    WHERE code = 'MICROBIOLOGY' OR name_th = 'งานจุลชีววิทยา'
  );

UPDATE public.chemical_units
SET code = 'IMMUNOLOGY', name_th = 'งานภูมิคุ้มกันวิทยาคลินิก', active = true
WHERE code = 'IMMUNO'
  AND name_th = 'ภูมิคุ้มกันวิทยา'
  AND NOT EXISTS (
    SELECT 1 FROM public.chemical_units
    WHERE code = 'IMMUNOLOGY' OR name_th = 'งานภูมิคุ้มกันวิทยาคลินิก'
  );

UPDATE public.chemical_units
SET code = 'HEMATOLOGY', name_th = 'งานโลหิตวิทยาคลินิก', active = true
WHERE code = 'HEMA'
  AND name_th = 'โลหิตวิทยา'
  AND NOT EXISTS (
    SELECT 1 FROM public.chemical_units
    WHERE code = 'HEMATOLOGY' OR name_th = 'งานโลหิตวิทยาคลินิก'
  );

INSERT INTO public.chemical_units (code, name_th, active)
VALUES
  ('OFFICE', 'สำนักงานกลุ่มงานเทคนิคการแพทย์', true),
  ('CHEMISTRY', 'งานเคมีคลินิก', true),
  ('HEMATOLOGY', 'งานโลหิตวิทยาคลินิก', true),
  ('IMMUNOLOGY', 'งานภูมิคุ้มกันวิทยาคลินิก', true),
  ('MICROSCOPY', 'งานจุลทรรศนศาสตร์คลินิก', true),
  ('BIOMOLECULAR', 'งานอณูชีววิทยา', true),
  ('MICROBIOLOGY', 'งานจุลชีววิทยา', true),
  ('BLOODBANK', 'งานคลังเลือด', true),
  ('OUTLAB', 'งานตรวจพิเศษและห้องปฏิบัติการตรวจต่อ', true),
  ('OPD', 'งานบริการผู้ป่วยนอก', true),
  ('MCPCC', 'ห้องปฏิบัติการศูนย์สุขภาพชุมชนเมืองชลบุรี', true)
ON CONFLICT (code) DO UPDATE
SET name_th = EXCLUDED.name_th,
    active = true;

COMMIT;
