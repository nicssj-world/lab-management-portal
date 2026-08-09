BEGIN;

-- Draft checklist content for the Chemical Spill Kit monthly inspection template
-- (lab_map_safety_form_templates: profile='chemical_spill_kit', version=1). The template row
-- itself already exists as an inactive scaffold from the monthly-inspection migration; this
-- only fills in its items so it can be reviewed and activated from the Monthly Form Versions
-- admin view. Stays inactive here on purpose — activation is a manual step after review.
WITH items(item_key, label_th, sort_order, expiry_required) AS (VALUES
  ('chemical-resistant-gloves', 'ถุงมือทนสารเคมี', 1, true),
  ('goggle', 'แว่นตานิรภัย (Goggle)', 2, true),
  ('face-shield', 'Face Shield', 3, true),
  ('chemical-apron', 'เสื้อกันเปื้อนสารเคมี (Apron)', 4, true),
  ('respirator-mask', 'หน้ากากป้องกันไอสารเคมี', 5, true),
  ('chemical-boots', 'รองเท้าบูท/Shoe cover ทนสารเคมี', 6, true),
  ('absorbent-pillow', 'แผ่น/หมอนดูดซับสารเคมี (Absorbent pillow)', 7, true),
  ('absorbent-powder', 'ผงดูดซับสารเคมี (Absorbent granules)', 8, true),
  ('acid-neutralizer', 'สารสะเทินกรด (Acid neutralizer)', 9, true),
  ('base-neutralizer', 'สารสะเทินด่าง (Base neutralizer)', 10, true),
  ('scoop-dustpan', 'พลั่ว/ที่ตักสำหรับเก็บสารเคมีที่หก', 11, true),
  ('chemical-waste-bag', 'ถุงขยะสารเคมีและเชือกมัด', 12, true),
  ('hazard-warning-sign', 'ป้าย/กรวยเตือนพื้นที่อันตราย', 13, true),
  ('chemical-waste-container', 'ภาชนะรองรับของเสียปนเปื้อนสารเคมี', 14, true),
  ('forceps', 'คีมคีบเศษแก้ว/วัสดุปนเปื้อน (Forceps)', 15, true),
  ('spill-procedure', 'วิธีปฏิบัติการทำความสะอาดบริเวณสารเคมีหก', 16, true)
)
INSERT INTO public.lab_map_safety_form_template_items(
  template_id, item_key, label_th, sort_order, date_mode, expiry_required
)
SELECT template.id, items.item_key, items.label_th, items.sort_order,
  'manufactured_or_packed', items.expiry_required
FROM items
JOIN public.lab_map_safety_form_templates template
  ON template.profile = 'chemical_spill_kit' AND template.version = 1
ON CONFLICT (template_id, item_key) DO UPDATE SET
  label_th = EXCLUDED.label_th,
  sort_order = EXCLUDED.sort_order,
  date_mode = EXCLUDED.date_mode,
  expiry_required = EXCLUDED.expiry_required;

NOTIFY pgrst, 'reload schema';
COMMIT;
