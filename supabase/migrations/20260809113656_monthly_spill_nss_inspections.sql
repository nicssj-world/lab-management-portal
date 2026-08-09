BEGIN;

ALTER TABLE public.quality_task_schedules
  ADD COLUMN IF NOT EXISTS due_day_of_month integer;
ALTER TABLE public.quality_task_schedules
  DROP CONSTRAINT IF EXISTS quality_task_schedules_due_day_of_month_check;
ALTER TABLE public.quality_task_schedules
  ADD CONSTRAINT quality_task_schedules_due_day_of_month_check
  CHECK (due_day_of_month IS NULL OR due_day_of_month BETWEEN 1 AND 28);

ALTER TABLE public.lab_map_safety_assets
  ADD COLUMN IF NOT EXISTS inspection_profile text,
  ADD COLUMN IF NOT EXISTS activated_on date NOT NULL DEFAULT current_date;
ALTER TABLE public.lab_map_safety_assets
  DROP CONSTRAINT IF EXISTS lab_map_safety_assets_inspection_profile_check,
  DROP CONSTRAINT IF EXISTS lab_map_safety_assets_kind_check;
ALTER TABLE public.lab_map_safety_assets
  ADD CONSTRAINT lab_map_safety_assets_inspection_profile_check CHECK (
    inspection_profile IS NULL OR inspection_profile IN (
      'biohazard_spill_kit', 'chemical_spill_kit', 'nss_eyewash'
    )
  ),
  ADD CONSTRAINT lab_map_safety_assets_kind_check CHECK (kind IN (
    'fire-extinguisher', 'fire-hose', 'manual-call-point', 'aed', 'first-aid-kit',
    'eyewash', 'emergency-shower', 'spill-kit', 'nss-eyewash', 'emergency-shutoff'
  ));

CREATE TABLE IF NOT EXISTS public.lab_map_safety_form_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile text NOT NULL CHECK (profile IN (
    'biohazard_spill_kit', 'chemical_spill_kit', 'nss_eyewash'
  )),
  version integer NOT NULL CHECK (version > 0),
  title_th text NOT NULL CHECK (NULLIF(btrim(title_th), '') IS NOT NULL),
  active boolean NOT NULL DEFAULT false,
  photo_required boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz,
  UNIQUE (profile, version)
);
CREATE UNIQUE INDEX IF NOT EXISTS lab_map_safety_form_templates_one_active
  ON public.lab_map_safety_form_templates(profile) WHERE active;

CREATE TABLE IF NOT EXISTS public.lab_map_safety_form_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.lab_map_safety_form_templates(id) ON DELETE RESTRICT,
  item_key text NOT NULL CHECK (NULLIF(btrim(item_key), '') IS NOT NULL),
  label_th text NOT NULL CHECK (NULLIF(btrim(label_th), '') IS NOT NULL),
  sort_order integer NOT NULL CHECK (sort_order > 0),
  date_mode text NOT NULL DEFAULT 'manufactured_or_packed'
    CHECK (date_mode IN ('none', 'manufactured_or_packed', 'purchased')),
  expiry_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, item_key),
  UNIQUE (template_id, sort_order)
);

CREATE TABLE IF NOT EXISTS public.lab_map_safety_asset_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.lab_map_safety_assets(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  assignment_role text NOT NULL CHECK (assignment_role IN ('primary', 'backup')),
  active_from date NOT NULL DEFAULT current_date,
  active_to date,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (active_to IS NULL OR active_to >= active_from),
  UNIQUE (asset_id, user_id, active_from)
);
CREATE INDEX IF NOT EXISTS lab_map_safety_asset_assignments_lookup
  ON public.lab_map_safety_asset_assignments(asset_id, active_from, active_to);
CREATE INDEX IF NOT EXISTS lab_map_safety_asset_assignments_user
  ON public.lab_map_safety_asset_assignments(user_id, active_from, active_to);

CREATE TABLE IF NOT EXISTS public.lab_map_safety_asset_supplies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.lab_map_safety_assets(id) ON DELETE RESTRICT,
  template_item_id uuid REFERENCES public.lab_map_safety_form_template_items(id) ON DELETE RESTRICT,
  supply_type text NOT NULL CHECK (supply_type IN ('spill_item', 'nss_bottle')),
  internal_code text NOT NULL CHECK (NULLIF(btrim(internal_code), '') IS NOT NULL),
  label_th text NOT NULL CHECK (NULLIF(btrim(label_th), '') IS NOT NULL),
  manufactured_or_packed_on date,
  purchased_on date,
  expires_on date,
  supplier text,
  activated_on date NOT NULL DEFAULT current_date,
  retired_on date,
  replacement_for_id uuid REFERENCES public.lab_map_safety_asset_supplies(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (retired_on IS NULL OR retired_on >= activated_on),
  UNIQUE (asset_id, internal_code, activated_on)
);
CREATE INDEX IF NOT EXISTS lab_map_safety_asset_supplies_active
  ON public.lab_map_safety_asset_supplies(asset_id, activated_on, retired_on);
CREATE INDEX IF NOT EXISTS lab_map_safety_asset_supplies_expiry
  ON public.lab_map_safety_asset_supplies(expires_on) WHERE retired_on IS NULL;

ALTER TABLE public.lab_map_safety_inspection_round_items
  ADD COLUMN IF NOT EXISTS task_instance_id uuid REFERENCES public.quality_task_instances(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.lab_map_safety_form_templates(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS due_on date,
  ADD COLUMN IF NOT EXISTS assignee_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS template_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS issue_count integer NOT NULL DEFAULT 0 CHECK (issue_count >= 0),
  ADD COLUMN IF NOT EXISTS skipped_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS skipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS skip_reason text;
CREATE INDEX IF NOT EXISTS lab_map_safety_round_items_monthly_task
  ON public.lab_map_safety_inspection_round_items(task_instance_id, due_on, status);

ALTER TABLE public.lab_map_safety_inspections
  ADD COLUMN IF NOT EXISTS inspection_profile text,
  ADD COLUMN IF NOT EXISTS form_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ALTER COLUMN photo_r2_key DROP NOT NULL,
  ALTER COLUMN photo_file_name DROP NOT NULL,
  ALTER COLUMN photo_content_type DROP NOT NULL,
  ALTER COLUMN photo_size_bytes DROP NOT NULL;
ALTER TABLE public.lab_map_safety_inspections
  DROP CONSTRAINT IF EXISTS lab_map_safety_inspections_inspection_profile_check;
ALTER TABLE public.lab_map_safety_inspections
  ADD CONSTRAINT lab_map_safety_inspections_inspection_profile_check CHECK (
    inspection_profile IS NULL OR inspection_profile IN (
      'biohazard_spill_kit', 'chemical_spill_kit', 'nss_eyewash'
    )
  );

ALTER TABLE public.lab_map_safety_form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_map_safety_form_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_map_safety_asset_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_map_safety_asset_supplies ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.lab_map_safety_form_templates FROM anon, authenticated;
REVOKE ALL ON public.lab_map_safety_form_template_items FROM anon, authenticated;
REVOKE ALL ON public.lab_map_safety_asset_assignments FROM anon, authenticated;
REVOKE ALL ON public.lab_map_safety_asset_supplies FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_map_safety_form_templates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_map_safety_form_template_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_map_safety_asset_assignments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_map_safety_asset_supplies TO service_role;

WITH templates(profile, version, title_th, active) AS (VALUES
  ('biohazard_spill_kit', 1, 'รายการตรวจ Biohazard Spill Kit', true),
  ('chemical_spill_kit', 1, 'รายการตรวจ Chemical Spill Kit', false),
  ('nss_eyewash', 1, 'แบบบันทึกการตรวจสอบน้ำยาล้างตา NSS', true)
)
INSERT INTO public.lab_map_safety_form_templates(profile, version, title_th, active, photo_required)
SELECT profile, version, title_th, active, false FROM templates
ON CONFLICT (profile, version) DO UPDATE SET
  title_th = EXCLUDED.title_th,
  active = EXCLUDED.active,
  photo_required = false;

WITH items(item_key, label_th, sort_order, expiry_required) AS (VALUES
  ('disposable-gloves', 'ถุงมือใช้แล้วทิ้ง', 1, true),
  ('housekeeping-gloves', 'ถุงมือ (แม่บ้าน)', 2, true),
  ('mask', 'หน้ากากอนามัย (Mask)', 3, true),
  ('waterproof-gown', 'เสื้อกาวน์กันน้ำ', 4, true),
  ('goggle', 'แว่นตานิรภัย (Goggle)', 5, true),
  ('face-shield', 'Face Shield', 6, true),
  ('hair-cover', 'หมวกคลุมผม/ยางรัดผม', 7, true),
  ('shoe-cover', 'Shoe cover', 8, true),
  ('virkon', 'ผงทำความสะอาด (Virkon)', 9, true),
  ('clean-water-1', 'น้ำสะอาดขวดที่ 1', 10, true),
  ('clean-water-2', 'น้ำสะอาดขวดที่ 2', 11, true),
  ('absorbent-paper', 'กระดาษซับ', 12, true),
  ('tissue-waste', 'กระดาษเยื่อ (สำหรับทิ้งขยะ)', 13, true),
  ('forceps', 'ปากคีบ (Forceps)', 14, true),
  ('sharps-container', 'กระป๋องพลาสติกใส่ของมีคม', 15, true),
  ('infectious-waste-bag', 'ถุงขยะติดเชื้อ (สีแดง) และเชือก', 16, true),
  ('spill-procedure', 'วิธีปฏิบัติการทำความสะอาดบริเวณพื้นที่ที่มีการหกเลอะของสิ่งติดเชื้อ', 17, true)
)
INSERT INTO public.lab_map_safety_form_template_items(
  template_id, item_key, label_th, sort_order, date_mode, expiry_required
)
SELECT template.id, items.item_key, items.label_th, items.sort_order,
  'manufactured_or_packed', items.expiry_required
FROM items
JOIN public.lab_map_safety_form_templates template
  ON template.profile = 'biohazard_spill_kit' AND template.version = 1
ON CONFLICT (template_id, item_key) DO UPDATE SET
  label_th = EXCLUDED.label_th,
  sort_order = EXCLUDED.sort_order,
  date_mode = EXCLUDED.date_mode,
  expiry_required = EXCLUDED.expiry_required;

INSERT INTO public.quality_task_templates (
  source_key, workstream, category_code, category_name, activity_no, title, description,
  reference_code, frequency_text, owner_text, task_kind, reminder_days,
  evidence_required, approval_mode, integration_kind, active
) VALUES (
  'CBH-ST-26', 'safety', 'F', 'ความปลอดภัยและสิ่งแวดล้อม', 26,
  'ตรวจน้ำยาล้างตา NSS ประจำเดือน',
  'ตรวจความใส สภาพขวด และวันหมดอายุของ NSS ทุกขวดในแต่ละจุด',
  'แบบบันทึกการตรวจสอบน้ำยาล้างตา NSS', 'ทุกเดือน ภายในวันที่ 15',
  'ผู้รับผิดชอบพื้นที่ / LSO', 'activity', 7, false, 'none', 'safety_inspection', true
)
ON CONFLICT (source_key) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  frequency_text = EXCLUDED.frequency_text,
  owner_text = EXCLUDED.owner_text,
  reminder_days = EXCLUDED.reminder_days,
  evidence_required = false,
  approval_mode = 'none',
  integration_kind = 'safety_inspection',
  active = true,
  updated_at = now();

WITH target AS (
  SELECT id FROM public.quality_task_templates WHERE source_key = 'CBH-ST-26'
)
INSERT INTO public.quality_task_schedules (
  template_id, schedule_key, interval_unit, interval_count, recurrence_mode,
  starts_on, due_day_of_month, active
)
SELECT id, 'monthly-day-15', 'month', 1, 'fixed_calendar', date '2026-08-01', 15, true
FROM target
ON CONFLICT (template_id, schedule_key) DO UPDATE SET
  interval_unit = 'month',
  interval_count = 1,
  recurrence_mode = 'fixed_calendar',
  due_day_of_month = 15,
  active = true;

UPDATE public.quality_task_schedules schedule
SET due_day_of_month = 15
FROM public.quality_task_templates template
WHERE schedule.template_id = template.id
  AND template.source_key = 'CBH-ST-04';

UPDATE public.quality_task_templates
SET frequency_text = 'ทุกเดือน ภายในวันที่ 15', reminder_days = 7,
  evidence_required = false, approval_mode = 'none', updated_at = now()
WHERE source_key = 'CBH-ST-04';

NOTIFY pgrst, 'reload schema';
COMMIT;
