BEGIN;

ALTER TABLE public.quality_task_templates
  ADD COLUMN IF NOT EXISTS workstream text NOT NULL DEFAULT 'quality',
  ADD COLUMN IF NOT EXISTS approval_mode text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS integration_kind text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS approver_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES public.quality_task_templates(id);

ALTER TABLE public.quality_task_templates
  DROP CONSTRAINT IF EXISTS quality_task_templates_workstream_check,
  DROP CONSTRAINT IF EXISTS quality_task_templates_approval_mode_check,
  DROP CONSTRAINT IF EXISTS quality_task_templates_integration_kind_check;
ALTER TABLE public.quality_task_templates
  ADD CONSTRAINT quality_task_templates_workstream_check CHECK (workstream IN ('quality', 'safety')),
  ADD CONSTRAINT quality_task_templates_approval_mode_check CHECK (approval_mode IN ('none', 'required')),
  ADD CONSTRAINT quality_task_templates_integration_kind_check CHECK (integration_kind IN ('none', 'safety_inspection', 'equipment_reference'));

ALTER TABLE public.quality_task_schedules
  ADD COLUMN IF NOT EXISTS recurrence_mode text NOT NULL DEFAULT 'fixed_calendar';
ALTER TABLE public.quality_task_schedules
  DROP CONSTRAINT IF EXISTS quality_task_schedules_interval_unit_check,
  DROP CONSTRAINT IF EXISTS quality_task_schedules_recurrence_mode_check;
ALTER TABLE public.quality_task_schedules
  ADD CONSTRAINT quality_task_schedules_interval_unit_check CHECK (interval_unit IN ('day', 'week', 'month', 'year')),
  ADD CONSTRAINT quality_task_schedules_recurrence_mode_check CHECK (recurrence_mode IN ('fixed_calendar', 'rolling_completion'));

ALTER TABLE public.quality_task_instances
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text;
ALTER TABLE public.quality_task_instances
  DROP CONSTRAINT IF EXISTS quality_task_instances_status_check;
ALTER TABLE public.quality_task_instances
  ADD CONSTRAINT quality_task_instances_status_check CHECK (status IN ('open', 'in_progress', 'pending_review', 'completed'));

ALTER TABLE public.quality_task_action_items
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_id text;
ALTER TABLE public.quality_task_action_items
  DROP CONSTRAINT IF EXISTS quality_task_action_items_source_unique,
  ADD CONSTRAINT quality_task_action_items_source_unique UNIQUE (instance_id, source_type, source_id);

CREATE TABLE IF NOT EXISTS public.quality_task_evidence_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.quality_task_templates(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (NULLIF(btrim(label), '') IS NOT NULL),
  evidence_kind text NOT NULL DEFAULT 'other' CHECK (NULLIF(btrim(evidence_kind), '') IS NOT NULL),
  required boolean NOT NULL DEFAULT true,
  minimum_files integer NOT NULL DEFAULT 1 CHECK (minimum_files BETWEEN 1 AND 20),
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, evidence_kind, label)
);

ALTER TABLE public.quality_task_attachments
  ADD COLUMN IF NOT EXISTS requirement_id uuid REFERENCES public.quality_task_evidence_requirements(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS evidence_kind text NOT NULL DEFAULT 'other';
ALTER TABLE public.quality_task_attachments
  DROP CONSTRAINT IF EXISTS quality_task_attachments_content_type_check;
ALTER TABLE public.quality_task_attachments
  ADD CONSTRAINT quality_task_attachments_content_type_check CHECK (content_type IN (
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ));

CREATE TABLE IF NOT EXISTS public.quality_task_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.quality_task_instances(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('submitted', 'approved', 'rejected', 'reopened')),
  actor_id uuid NOT NULL REFERENCES public.profiles(id),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quality_task_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL REFERENCES public.quality_task_instances(id) ON DELETE CASCADE,
  integration_kind text NOT NULL CHECK (integration_kind IN ('safety_inspection', 'equipment_reference', 'risk_register', 'certificate_renewal')),
  source_type text NOT NULL CHECK (NULLIF(btrim(source_type), '') IS NOT NULL),
  source_id text NOT NULL CHECK (NULLIF(btrim(source_id), '') IS NOT NULL),
  sync_status text NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed')),
  sync_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (integration_kind, source_type, source_id)
);

CREATE TABLE IF NOT EXISTS public.safety_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_type text NOT NULL CHECK (NULLIF(btrim(certificate_type), '') IS NOT NULL),
  document_no text,
  holder_name text NOT NULL CHECK (NULLIF(btrim(holder_name), '') IS NOT NULL),
  department text,
  issued_on date,
  expires_on date,
  no_expiry boolean NOT NULL DEFAULT false,
  owner_id uuid REFERENCES public.profiles(id),
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  updated_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((no_expiry AND expires_on IS NULL) OR (NOT no_expiry AND expires_on IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS public.safety_certificate_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id uuid NOT NULL REFERENCES public.safety_certificates(id) ON DELETE RESTRICT,
  certificate_type text NOT NULL,
  document_no text,
  holder_name text NOT NULL,
  department text,
  issued_on date,
  expires_on date,
  no_expiry boolean NOT NULL DEFAULT false,
  r2_key text NOT NULL UNIQUE,
  file_name text NOT NULL,
  content_type text NOT NULL CHECK (content_type IN (
    'application/pdf', 'image/jpeg', 'image/png',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )),
  size_bytes bigint NOT NULL CHECK (size_bytes BETWEEN 1 AND 20971520),
  uploaded_by uuid NOT NULL REFERENCES public.profiles(id),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((no_expiry AND expires_on IS NULL) OR (NOT no_expiry AND expires_on IS NOT NULL))
);

ALTER TABLE public.safety_certificates
  ADD COLUMN IF NOT EXISTS current_version_id uuid REFERENCES public.safety_certificate_versions(id);

CREATE TABLE IF NOT EXISTS public.safety_certificate_renewals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id uuid NOT NULL REFERENCES public.safety_certificates(id) ON DELETE CASCADE,
  expires_on date NOT NULL,
  instance_id uuid NOT NULL REFERENCES public.quality_task_instances(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (certificate_id, expires_on),
  UNIQUE (instance_id)
);

CREATE INDEX IF NOT EXISTS quality_task_templates_workstream_active
  ON public.quality_task_templates(workstream, active, activity_no);
CREATE INDEX IF NOT EXISTS quality_task_schedules_recurrence
  ON public.quality_task_schedules(recurrence_mode, active, starts_on);
CREATE INDEX IF NOT EXISTS quality_task_instances_review_status
  ON public.quality_task_instances(status, reviewed_at);
CREATE INDEX IF NOT EXISTS quality_task_evidence_requirements_template
  ON public.quality_task_evidence_requirements(template_id, active, sort_order);
CREATE INDEX IF NOT EXISTS quality_task_reviews_instance
  ON public.quality_task_reviews(instance_id, created_at DESC);
CREATE INDEX IF NOT EXISTS quality_task_links_instance
  ON public.quality_task_links(instance_id, integration_kind);
CREATE INDEX IF NOT EXISTS quality_task_action_items_source
  ON public.quality_task_action_items(instance_id, source_type, source_id);
CREATE INDEX IF NOT EXISTS safety_certificates_expiry
  ON public.safety_certificates(expires_on) WHERE active AND NOT no_expiry;
CREATE INDEX IF NOT EXISTS safety_certificate_versions_certificate
  ON public.safety_certificate_versions(certificate_id, uploaded_at DESC);

ALTER TABLE public.quality_task_evidence_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_task_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_task_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_certificate_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_certificate_renewals ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.quality_task_evidence_requirements,
  public.quality_task_reviews,
  public.quality_task_links,
  public.safety_certificates,
  public.safety_certificate_versions,
  public.safety_certificate_renewals FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_task_evidence_requirements,
  public.quality_task_reviews,
  public.quality_task_links,
  public.safety_certificates,
  public.safety_certificate_versions,
  public.safety_certificate_renewals TO service_role;

WITH seed(
  source_key, activity_no, title, description, reference_code, frequency_text,
  owner_text, task_kind, reminder_days, evidence_required, approval_mode, integration_kind
) AS (VALUES
  ('CBH-ST-01', 1, 'ตรวจ Eye wash และ Emergency shower', 'ตรวจความพร้อมใช้งานตามรายการอุปกรณ์บนแผนที่', 'MN-LAB-02', 'ทุกสัปดาห์', 'LSO / ผู้รับผิดชอบพื้นที่', 'activity', 1, false, 'none', 'safety_inspection'),
  ('CBH-ST-02', 2, 'ประเมินระบบอัคคีภัยประจำเดือน', 'ประเมินและส่งแบบประเมินระบบอัคคีภัยภายในวันที่ 20', 'QP-LAB-26 5.2.1.5.2', 'ทุกเดือน วันที่ 20', 'LSO / คณะทำงานความปลอดภัย', 'activity', 7, true, 'none', 'none'),
  ('CBH-ST-03', 3, 'ตรวจถังและสายดับเพลิง', 'ตรวจถังดับเพลิงและสายสูบน้ำดับเพลิงทุกจุด', 'MN-LAB-02', 'ทุกเดือน', 'LSO / ผู้รับผิดชอบพื้นที่', 'activity', 7, false, 'none', 'safety_inspection'),
  ('CBH-ST-04', 4, 'ตรวจความพร้อม Spill kit', 'ตรวจชุดสารชีวภาพและสารเคมีหกรั่วไหล', 'MN-LAB-02', 'ทุกเดือน', 'LSO / ผู้รับผิดชอบพื้นที่', 'activity', 7, false, 'none', 'safety_inspection'),
  ('CBH-ST-05', 5, 'ประชุมคณะทำงานความปลอดภัยและสิ่งแวดล้อม', 'ทบทวนอุบัติการณ์ ความเสี่ยง CAPA และสภาพแวดล้อม', 'QP-LAB-26 5.2.5', 'ทุกเดือน', 'คณะทำงานความปลอดภัยและสิ่งแวดล้อม', 'meeting', 7, true, 'none', 'none'),
  ('CBH-ST-06', 6, 'สรุปอุบัติการณ์ความปลอดภัย', 'รวบรวม Smart RM และรายงานหัวหน้ากลุ่มงาน', 'QP-LAB-26 5.2.4.2', 'ทุก 30 วัน', 'LSO', 'activity', 7, true, 'none', 'none'),
  ('CBH-ST-07', 7, 'ตรวจความปลอดภัยอาคารและพื้นที่', 'ตรวจอาคาร สถานที่ และอุปกรณ์ที่เกี่ยวข้อง', 'Fm-QP-LAB-26/01', 'ทุก 60 วัน', 'LSO / คณะทำงานความปลอดภัย', 'activity', 14, true, 'none', 'none'),
  ('CBH-ST-08', 8, 'ตรวจสารไวไฟและการจัดเก็บสารเคมี', 'ตรวจความปลอดภัยของสารไวไฟและการจัดเก็บ', 'MN-LAB-02', 'ทุก 60 วัน', 'ผู้ดูแลสารเคมี / LSO', 'activity', 14, true, 'none', 'none'),
  ('CBH-ST-09', 9, 'Laboratory Safety Round', 'ค้นหาความเสี่ยง รายงานผล และติดตามการแก้ไข', 'Fm-QP-LAB-26/02', 'ทุก 90 วัน', 'LSO / คณะทำงานความปลอดภัย', 'activity', 14, true, 'required', 'none'),
  ('CBH-ST-10', 10, 'รายงานแผนความปลอดภัยและ Safety KPI', 'สรุปผลแผน ปัญหา อุปสรรค และตัวชี้วัดเสนอหัวหน้ากลุ่มงาน', 'QP-LAB-26 5.1.3.7, 6.0', 'รายไตรมาส', 'LSO', 'activity', 14, true, 'required', 'none'),
  ('CBH-ST-11', 11, 'ติดตาม PM เครื่องกำเนิดไฟฟ้า', 'อ้างอิงผล PM จากทะเบียนเครื่องมือโดยไม่บันทึกซ้ำ', 'MN-LAB-02', 'ทุก 6 เดือน', 'คณะทำงานเครื่องมือ / LSO', 'activity', 30, true, 'none', 'equipment_reference'),
  ('CBH-ST-12', 12, 'ประเมิน Hazard Vulnerability Analysis (HVA)', 'ประเมินความเสี่ยงและจัดทำแผนความปลอดภัย', 'QP-LAB-26 5.2.1.4', 'ทุก 12 เดือน', 'LSO / คณะทำงานความปลอดภัย', 'activity', 30, true, 'required', 'none'),
  ('CBH-ST-13', 13, 'อบรมและประเมินความปลอดภัยบุคลากร', 'อบรมทบทวนและประเมินความเข้าใจของเจ้าหน้าที่', 'QP-LAB-26 5.2.1.2.2-2.4', 'ทุก 12 เดือน', 'คณะทำงานความปลอดภัย', 'activity', 30, true, 'required', 'none'),
  ('CBH-ST-14', 14, 'ทบทวนความปลอดภัยบุคคลภายนอกประจำ', 'ทบทวนผู้เข้าปฏิบัติกิจกรรมเป็นประจำและเก็บรายชื่อ', 'QP-LAB-26 5.2.2.2', 'ทุก 12 เดือน', 'LSO / ผู้ได้รับมอบหมาย', 'activity', 30, true, 'none', 'none'),
  ('CBH-ST-15', 15, 'ทบทวน QP-LAB-26 และ MN-LAB-02', 'ทบทวนเอกสารความปลอดภัยให้เป็นปัจจุบัน', 'QP-LAB-26 5.1.4.7', 'ทุก 12 เดือน', 'LSO / คณะทำงานความปลอดภัย', 'activity', 30, true, 'required', 'none'),
  ('CBH-ST-16', 16, 'ทบทวน Safety Data Sheet (SDS)', 'ทบทวน SDS ของสารเคมีในแต่ละหน่วยงาน', 'QP-LAB-26 5.4.1', 'ทุก 12 เดือน', 'ผู้ดูแลสารเคมี / LSO', 'activity', 30, true, 'none', 'none'),
  ('CBH-ST-17', 17, 'ซ้อมแผนฉุกเฉินประจำปี', 'ครอบคลุมอัคคีภัย สารเคมีหกรั่วไหล CPR และใน/นอกเวลาราชการ', 'QP-LAB-26 5.2.3', 'ทุก 12 เดือน', 'คณะทำงานความปลอดภัย', 'activity', 30, true, 'required', 'none'),
  ('CBH-ST-18', 18, 'ตรวจการจัดการของเสียประจำปี', 'ทบทวนการแยก จัดเก็บ และกำจัดของเสีย', 'HP-PCI-CBH-011', 'ทุก 12 เดือน', 'คณะทำงานความปลอดภัย', 'activity', 30, true, 'required', 'none'),
  ('CBH-ST-19', 19, 'ตรวจชุด Spill kit ทั้งระบบ', 'ตรวจนับ ทดแทนของหมดอายุ และปรับรายการประจำปี', 'MN-LAB-02', 'ทุก 12 เดือน', 'LSO / ผู้รับผิดชอบพื้นที่', 'activity', 30, true, 'none', 'none'),
  ('CBH-ST-20', 20, 'ทบทวนภูมิคุ้มกันตามความเสี่ยง', 'บันทึกเฉพาะสถานะสรุปและเลขอ้างอิงระบบต้นทาง', 'HP-PCI-CBH-022', 'ทุก 12 เดือน', 'คณะทำงานความปลอดภัย / OHS', 'activity', 30, true, 'none', 'none'),
  ('CBH-ST-21', 21, 'ทบทวนแผนฉุกเฉินงานคลังเลือด', 'ทบทวนเหตุภายนอก ผู้รับผิดชอบ และความพร้อมของแผน', 'QP-LAB-26 5.5', 'ทุก 12 เดือน', 'LSO / ผู้จัดการวิชาการงานคลังเลือด', 'activity', 30, true, 'required', 'none'),
  ('CBH-ST-22', 22, 'ปฐมนิเทศความปลอดภัยบุคลากรใหม่', 'ตรวจภูมิคุ้มกัน อบรม และประเมินก่อนเริ่มงาน', 'QP-LAB-26 5.2.1.1', 'เมื่อมีบุคลากรใหม่', 'หัวหน้างาน / LSO', 'activity', 7, true, 'none', 'none'),
  ('CBH-ST-23', 23, 'ตรวจสอบและให้คำปรึกษาความไม่ปลอดภัย', 'ตรวจสอบทันทีเมื่อได้รับแจ้งและบันทึกรายละเอียด', 'Fm-QP-LAB-26/03', 'เมื่อได้รับแจ้ง', 'LSO / คณะทำงานความปลอดภัย', 'activity', 0, true, 'none', 'none'),
  ('CBH-ST-24', 24, 'รายงานและสอบสวนอุบัติการณ์', 'รายงาน IOR ภายใน 24 ชั่วโมงและใช้ Fm-QP-LAB-26/04 เมื่อเกี่ยวข้อง', 'QP-LAB-26 5.2.4', 'เมื่อเกิดเหตุ', 'ผู้พบเหตุ / LSO', 'activity', 0, true, 'none', 'none'),
  ('CBH-ST-25', 25, 'ต่ออายุใบรับรองความปลอดภัย', 'งานที่ระบบสร้างจากทะเบียนใบรับรองก่อนหมดอายุ 90 วัน', 'ทะเบียนใบรับรองความปลอดภัย', 'ตามวันหมดอายุ', 'ผู้ถือใบรับรอง / LSO', 'activity', 90, true, 'none', 'none')
)
INSERT INTO public.quality_task_templates (
  source_key, workstream, category_code, category_name, activity_no, title, description,
  reference_code, frequency_text, owner_text, task_kind, reminder_days,
  evidence_required, approval_mode, integration_kind, active
)
SELECT source_key, 'safety', 'F', 'ความปลอดภัยและสิ่งแวดล้อม', activity_no, title,
  description, reference_code, frequency_text, owner_text, task_kind, reminder_days,
  evidence_required, approval_mode, integration_kind, true
FROM seed
ON CONFLICT (source_key) DO UPDATE SET
  workstream = EXCLUDED.workstream,
  category_code = EXCLUDED.category_code,
  category_name = EXCLUDED.category_name,
  activity_no = EXCLUDED.activity_no,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  reference_code = EXCLUDED.reference_code,
  frequency_text = EXCLUDED.frequency_text,
  owner_text = EXCLUDED.owner_text,
  task_kind = EXCLUDED.task_kind,
  reminder_days = EXCLUDED.reminder_days,
  evidence_required = EXCLUDED.evidence_required,
  approval_mode = EXCLUDED.approval_mode,
  integration_kind = EXCLUDED.integration_kind,
  active = true,
  updated_at = now();

WITH schedule_seed(source_key, schedule_key, interval_unit, interval_count, recurrence_mode, starts_on) AS (VALUES
  ('CBH-ST-01', 'weekly', 'week', 1, 'rolling_completion', date '2026-08-10'),
  -- The engine treats period_end as the due date. Starting on the 21st therefore
  -- creates fixed monthly periods that are due on the 20th of the following month.
  ('CBH-ST-02', 'monthly-day-20', 'month', 1, 'fixed_calendar', date '2026-07-21'),
  ('CBH-ST-03', 'monthly', 'month', 1, 'fixed_calendar', date '2026-08-01'),
  ('CBH-ST-04', 'monthly', 'month', 1, 'fixed_calendar', date '2026-08-01'),
  ('CBH-ST-05', 'monthly', 'month', 1, 'fixed_calendar', date '2026-08-01'),
  ('CBH-ST-06', '30-days', 'day', 30, 'rolling_completion', date '2026-08-09'),
  ('CBH-ST-07', '60-days', 'day', 60, 'rolling_completion', date '2026-08-09'),
  ('CBH-ST-08', '60-days', 'day', 60, 'rolling_completion', date '2026-08-09'),
  ('CBH-ST-09', '90-days', 'day', 90, 'rolling_completion', date '2026-08-09'),
  ('CBH-ST-10', 'quarterly', 'month', 3, 'fixed_calendar', date '2026-07-01'),
  ('CBH-ST-11', 'semiannual', 'month', 6, 'fixed_calendar', date '2026-04-01'),
  ('CBH-ST-12', 'annual', 'year', 1, 'rolling_completion', date '2025-10-01'),
  ('CBH-ST-13', 'annual', 'year', 1, 'rolling_completion', date '2025-10-01'),
  ('CBH-ST-14', 'annual', 'year', 1, 'rolling_completion', date '2025-10-01'),
  ('CBH-ST-15', 'annual', 'year', 1, 'rolling_completion', date '2025-10-01'),
  ('CBH-ST-16', 'annual', 'year', 1, 'rolling_completion', date '2025-10-01'),
  ('CBH-ST-17', 'annual', 'year', 1, 'rolling_completion', date '2025-10-01'),
  ('CBH-ST-18', 'annual', 'year', 1, 'rolling_completion', date '2025-10-01'),
  ('CBH-ST-19', 'annual', 'year', 1, 'rolling_completion', date '2025-10-01'),
  ('CBH-ST-20', 'annual', 'year', 1, 'rolling_completion', date '2025-10-01'),
  ('CBH-ST-21', 'annual', 'year', 1, 'rolling_completion', date '2025-10-01')
)
INSERT INTO public.quality_task_schedules (
  template_id, schedule_key, interval_unit, interval_count, recurrence_mode, starts_on, active
)
SELECT template.id, seed.schedule_key, seed.interval_unit, seed.interval_count,
  seed.recurrence_mode, seed.starts_on, true
FROM schedule_seed seed
JOIN public.quality_task_templates template ON template.source_key = seed.source_key
ON CONFLICT (template_id, schedule_key) DO UPDATE SET
  interval_unit = EXCLUDED.interval_unit,
  interval_count = EXCLUDED.interval_count,
  recurrence_mode = EXCLUDED.recurrence_mode,
  starts_on = EXCLUDED.starts_on,
  active = true;

WITH requirement_seed(source_key, evidence_kind, label, minimum_files, sort_order) AS (VALUES
  ('CBH-ST-02', 'form', 'แบบประเมินระบบอัคคีภัย', 1, 1),
  ('CBH-ST-05', 'minutes', 'รายงานการประชุม', 1, 1),
  ('CBH-ST-06', 'report', 'สรุปรายงานอุบัติการณ์จาก Smart RM', 1, 1),
  ('CBH-ST-07', 'form', 'Fm-QP-LAB-26/01', 1, 1),
  ('CBH-ST-08', 'form', 'ผลตรวจสารไวไฟและการจัดเก็บสารเคมี', 1, 1),
  ('CBH-ST-09', 'form', 'Fm-QP-LAB-26/02', 1, 1),
  ('CBH-ST-09', 'report', 'รายงานผล Laboratory Safety Round', 1, 2),
  ('CBH-ST-10', 'report', 'รายงานแผนความปลอดภัยและ Safety KPI', 1, 1),
  ('CBH-ST-11', 'equipment-reference', 'หลักฐานอ้างอิง PM เครื่องกำเนิดไฟฟ้า', 1, 1),
  ('CBH-ST-12', 'report', 'รายงาน HVA และแผนจัดการความเสี่ยง', 1, 1),
  ('CBH-ST-13', 'attendance', 'รายชื่อผู้เข้ารับการอบรม', 1, 1),
  ('CBH-ST-13', 'assessment', 'ผลทดสอบหรือผลสังเกตการปฏิบัติ', 1, 2),
  ('CBH-ST-14', 'attendance', 'บันทึกการทบทวนบุคคลภายนอก', 1, 1),
  ('CBH-ST-15', 'review', 'หลักฐานการทบทวน QP-LAB-26 และ MN-LAB-02', 1, 1),
  ('CBH-ST-16', 'review', 'บัญชี SDS และผลการทบทวน', 1, 1),
  ('CBH-ST-17', 'plan', 'แผนการซ้อมและรายชื่อผู้เข้าร่วม', 1, 1),
  ('CBH-ST-17', 'evaluation', 'ผลประเมินการซ้อมแผน', 1, 2),
  ('CBH-ST-17', 'photo', 'ภาพการซ้อมในและนอกเวลาราชการ', 2, 3),
  ('CBH-ST-18', 'report', 'รายงานตรวจการจัดการของเสีย', 1, 1),
  ('CBH-ST-19', 'inventory', 'ผลตรวจนับและรายการทดแทน Spill kit', 1, 1),
  ('CBH-ST-20', 'status', 'สถานะสรุปการทบทวนภูมิคุ้มกัน', 1, 1),
  ('CBH-ST-21', 'plan', 'ผลทบทวนแผนฉุกเฉินงานคลังเลือด', 1, 1),
  ('CBH-ST-22', 'attendance', 'บันทึกการปฐมนิเทศและผลประเมิน', 1, 1),
  ('CBH-ST-23', 'form', 'Fm-QP-LAB-26/03', 1, 1),
  ('CBH-ST-24', 'incident', 'หลักฐาน IOR และ/หรือ Fm-QP-LAB-26/04', 1, 1),
  ('CBH-ST-24', 'capa', 'RCA/CAPA และผลติดตามการแก้ไข', 1, 2),
  ('CBH-ST-25', 'certificate', 'ใบรับรองฉบับใหม่', 1, 1)
)
INSERT INTO public.quality_task_evidence_requirements (
  template_id, evidence_kind, label, required, minimum_files, sort_order
)
SELECT template.id, seed.evidence_kind, seed.label, true, seed.minimum_files, seed.sort_order
FROM requirement_seed seed
JOIN public.quality_task_templates template ON template.source_key = seed.source_key
ON CONFLICT (template_id, evidence_kind, label) DO UPDATE SET
  required = true,
  minimum_files = EXCLUDED.minimum_files,
  sort_order = EXCLUDED.sort_order,
  active = true,
  updated_at = now();

UPDATE public.quality_task_templates legacy
SET workstream = 'safety', active = false, superseded_by = replacement.id, updated_at = now()
FROM public.quality_task_templates replacement
WHERE (legacy.source_key, replacement.source_key) IN (
  ('CBH-QT-29', 'CBH-ST-12'),
  ('CBH-QT-30', 'CBH-ST-07'),
  ('CBH-QT-31', 'CBH-ST-08'),
  ('CBH-QT-32', 'CBH-ST-18'),
  ('CBH-QT-33', 'CBH-ST-17'),
  ('CBH-QT-42', 'CBH-ST-05')
);

NOTIFY pgrst, 'reload schema';
COMMIT;
