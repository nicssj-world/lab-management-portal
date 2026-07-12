-- Quality Task List module. Run in Supabase Dashboard -> SQL Editor.
-- Idempotent: schema uses IF NOT EXISTS and seed rows use stable source/schedule keys.

create table if not exists public.quality_task_templates (
  id uuid primary key default gen_random_uuid(),
  source_key text unique,
  category_code text not null check (category_code ~ '^[A-I]$'),
  category_name text not null,
  activity_no integer,
  title text not null check (nullif(trim(title), '') is not null),
  description text,
  reference_code text,
  frequency_text text not null default 'ตามที่กำหนด',
  owner_text text not null default '',
  task_kind text not null default 'activity' check (task_kind in ('activity', 'meeting')),
  reminder_days integer not null default 7 check (reminder_days between 0 and 365),
  evidence_required boolean not null default false,
  active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quality_task_schedules (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.quality_task_templates(id) on delete cascade,
  schedule_key text not null,
  interval_unit text not null check (interval_unit in ('week', 'month', 'year')),
  interval_count integer not null check (interval_count > 0),
  starts_on date not null,
  ends_on date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (template_id, schedule_key)
);

create table if not exists public.quality_task_default_assignees (
  template_id uuid not null references public.quality_task_templates(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  primary key (template_id, user_id)
);

create table if not exists public.quality_task_instances (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.quality_task_templates(id),
  schedule_id uuid references public.quality_task_schedules(id),
  period_start date not null,
  period_end date not null,
  period_label text not null,
  planned_date date,
  status text not null default 'open' check (status in ('open', 'completed')),
  note text,
  completion_note text,
  completed_by uuid references public.profiles(id),
  completed_at timestamptz,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schedule_id, period_start),
  check (period_end >= period_start),
  check ((status = 'completed') = (completed_at is not null))
);

create table if not exists public.quality_task_instance_assignees (
  instance_id uuid not null references public.quality_task_instances(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  primary key (instance_id, user_id)
);

create table if not exists public.quality_task_attachments (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.quality_task_instances(id) on delete cascade,
  r2_key text not null unique,
  file_name text not null,
  content_type text not null check (content_type = 'application/pdf'),
  size_bytes bigint not null check (size_bytes between 1 and 20971520),
  uploaded_by uuid not null references public.profiles(id),
  uploaded_at timestamptz not null default now()
);

create index if not exists quality_task_instances_period on public.quality_task_instances(period_start, period_end);
create index if not exists quality_task_instances_status on public.quality_task_instances(status);
create index if not exists quality_task_attachments_instance on public.quality_task_attachments(instance_id);

alter table public.quality_task_templates enable row level security;
alter table public.quality_task_schedules enable row level security;
alter table public.quality_task_default_assignees enable row level security;
alter table public.quality_task_instances enable row level security;
alter table public.quality_task_instance_assignees enable row level security;
alter table public.quality_task_attachments enable row level security;

-- Runtime access uses supabaseAdmin after server-side permission checks.

insert into public.role_permissions (role, resource, granted) values
  ('Manager', 'งานคุณภาพ:edit', true),
  ('Medical Technologist', 'งานคุณภาพ:view', true),
  ('Medical Science Technician', 'งานคุณภาพ:view', true),
  ('Assistant', 'งานคุณภาพ:view', true)
on conflict (role, resource) do update set granted = excluded.granted, updated_at = now();

with seed(source_key, category_code, category_name, activity_no, title, description, reference_code, frequency_text, owner_text, task_kind) as (values
('CBH-QT-01','A','การบริหารจัดการระบบคุณภาพ',1,'การควบคุมเอกสารและบันทึก','ออก แก้ไข ยกเลิก แจกจ่าย และจัดเก็บเอกสาร','QP-LAB-01','ต่อเนื่อง (ตามที่กำหนด)','ผู้ควบคุมเอกสาร (Document Controller)','activity'),
('CBH-QT-02','A','การบริหารจัดการระบบคุณภาพ',2,'การจัดทำและทบทวนข้อตกลงการให้บริการ','ทบทวน Request Form รายการทดสอบ และข้อกำหนดพิเศษ','QP-LAB-02','≥ 1 ครั้ง/ปี','ผู้จัดการคุณภาพ / หัวหน้ากลุ่มงาน','activity'),
('CBH-QT-03','A','การบริหารจัดการระบบคุณภาพ',3,'การปรับปรุงคุณภาพอย่างต่อเนื่อง – ตัวชี้วัดคุณภาพ/KPI','รวบรวม วิเคราะห์ และรายงาน KPI ประจำเดือน/ปี','QP-LAB-07','รายเดือน + รายปี','ผู้จัดการคุณภาพ / คณะทำงานด้านวิชาการ','activity'),
('CBH-QT-04','A','การบริหารจัดการระบบคุณภาพ',4,'การบริหารความเสี่ยงและ NC/CAPA','ประเมินความเสี่ยง จัดทำ Risk Register และติดตาม CAPA','QP-LAB-06','ต่อเนื่อง; ทบทวน ≥ 1 ครั้ง/ปี','คณะทำงานความเสี่ยง / ผู้จัดการคุณภาพ','activity'),
('CBH-QT-05','A','การบริหารจัดการระบบคุณภาพ',5,'การรายงานอุบัติการณ์ / Near Miss','บันทึก วิเคราะห์ รายงาน และติดตามผลอุบัติการณ์','WI-GOV-06','ทุกครั้งที่พบ','บุคลากรทุกคน / คณะทำงานความเสี่ยง','activity'),
('CBH-QT-06','A','การบริหารจัดการระบบคุณภาพ',6,'การตรวจติดตามภายใน (Internal Audit)','วางแผน ดำเนินการ รายงานผล และติดตามแก้ไข','QP-LAB-10','≥ 1 ครั้ง/ปี','คณะผู้ตรวจติดตามภายใน / ผู้จัดการคุณภาพ','activity'),
('CBH-QT-07','A','การบริหารจัดการระบบคุณภาพ',7,'การทบทวนบริหาร (Management Review)','จัดประชุมทบทวนระบบ QMS ทั้งด้านบริหารและวิชาการ','QP-LAB-11','≥ 1 ครั้ง/ปี','ผู้อำนวยการห้องปฏิบัติการ / ผู้จัดการคุณภาพ','meeting'),
('CBH-QT-08','A','การบริหารจัดการระบบคุณภาพ',8,'การประเมินผู้ส่งมอบและห้องปฏิบัติการอ้างอิง','ประเมินคุณสมบัติ คัดเลือก และทบทวนประจำปี','QP-LAB-03','≥ 1 ครั้ง/ปี','คณะทำงานด้านวิชาการ','activity'),
('CBH-QT-09','A','การบริหารจัดการระบบคุณภาพ',9,'การคัดเลือกและจัดซื้อสินค้า/บริการจากภายนอก','กำหนดคุณสมบัติ ออก TOR จัดซื้อ และติดตาม','QP-LAB-04','ตามที่กำหนด','คณะทำงานด้านวิชาการ / ฝ่ายพัสดุ','activity'),
('CBH-QT-10','A','การบริหารจัดการระบบคุณภาพ',10,'การไม่ไปเกี่ยวข้องกับกิจกรรมที่เป็นปัญหา (Impartiality)','ประกาศนโยบายและรับทราบผลประโยชน์ทับซ้อน','QP-LAB-27','1 ครั้ง/ปี','หัวหน้ากลุ่มงาน / บุคลากรทุกคน','activity'),
('CBH-QT-11','B','การบริหารบุคลากร',11,'การปฐมนิเทศและอบรมบุคลากรใหม่','ปฐมนิเทศ ความปลอดภัย ระบบคุณภาพ และระเบียบปฏิบัติ','QP-LAB-12','เมื่อรับบุคลากรใหม่','หัวหน้ากลุ่มงาน / ผู้จัดการคุณภาพ','activity'),
('CBH-QT-12','B','การบริหารบุคลากร',12,'การประเมินสมรรถนะบุคลากร','ทดสอบความรู้/ทักษะ ทบทวน Job Spec และประเมินผล','QP-LAB-12','≥ 1 ครั้ง/ปี','หัวหน้าห้องปฏิบัติการ / หัวหน้ากลุ่มงาน','activity'),
('CBH-QT-13','B','การบริหารบุคลากร',13,'การอบรมต่อเนื่อง / CPD','อบรมภายใน ภายนอก และประชุมวิชาการ','QP-LAB-12','ตลอดปี (ตามแผนอบรม)','หัวหน้ากลุ่มงาน / บุคลากรทุกคน','activity'),
('CBH-QT-14','C','การบริหารเครื่องมือและวัสดุ',14,'การคัดเลือก จัดซื้อ และบริหารเครื่องมือ','กำหนดคุณสมบัติ จัดซื้อ รับ และทดสอบก่อนใช้งาน','QP-LAB-13','ตามที่กำหนด','คณะทำงานเครื่องมือ','activity'),
('CBH-QT-15','C','การบริหารเครื่องมือและวัสดุ',15,'การสอบเทียบเครื่องมือ (Calibration)','จัดทำแผน ดำเนินการสอบเทียบ และติดป้ายสถานะ','QP-LAB-15','ตามกำหนดการสอบเทียบ (รายปี/รายเครื่อง)','คณะทำงานเครื่องมือ / ผู้รับผิดชอบ Calibration','activity'),
('CBH-QT-16','C','การบริหารเครื่องมือและวัสดุ',16,'การบำรุงรักษาเชิงป้องกัน (PM)','จัดทำแผน PM ดำเนินการ บันทึก และติดตามผล','QP-LAB-14','ตามกำหนดการ PM (รายวัน/สัปดาห์/เดือน/ปี)','คณะทำงานเครื่องมือ / นักเทคนิคการแพทย์','activity'),
('CBH-QT-17','C','การบริหารเครื่องมือและวัสดุ',17,'การรับ จัดเก็บ และบริหารคลังน้ำยาและวัสดุ','ตรวจรับ Lot/Exp จัดเก็บ FIFO และตรวจสต็อก','QP-LAB-16','ต่อเนื่อง; ตรวจสต็อก 1 ครั้ง/เดือน','ผู้จัดการคลังวัสดุ / นักเทคนิคการแพทย์','activity'),
('CBH-QT-18','C','การบริหารเครื่องมือและวัสดุ',18,'การทวนสอบน้ำยา/วัสดุ Lot ใหม่','ทดสอบ Lot ใหม่เปรียบเทียบกับ Lot เดิม',null,'ทุก Lot ใหม่','คณะทำงานด้านวิชาการ / นักเทคนิคการแพทย์','activity'),
('CBH-QT-19','D','กระบวนการทดสอบ',19,'การควบคุมคุณภาพภายใน (IQC)','วิ่ง QC ทุกรอบ วิเคราะห์ Westgard Rules และบันทึกผล','QP-LAB-28','ทุกวัน (ทุกรอบงาน)','นักเทคนิคการแพทย์ / นักวิทยาศาสตร์การแพทย์','activity'),
('CBH-QT-20','D','กระบวนการทดสอบ',20,'การเปรียบเทียบผลระหว่างห้องปฏิบัติการ – EQA/PT','สมัคร ส่งตัวอย่าง วิเคราะห์ผล รายงาน และ CAPA','QP-LAB-19','≥ 2 ครั้ง/ปี (ต่อรายการ)','คณะทำงานด้านวิชาการ / ผู้จัดการคุณภาพ','activity'),
('CBH-QT-21','D','กระบวนการทดสอบ',21,'การตรวจสอบความถูกต้องของวิธีทดสอบ','Accuracy Precision Linearity และ Interference','QP-LAB-28','เมื่อเริ่มใช้วิธีใหม่หรือเปลี่ยนแปลงสำคัญ','คณะทำงานด้านวิชาการ / ผู้จัดการคุณภาพ','activity'),
('CBH-QT-22','D','กระบวนการทดสอบ',22,'การรายงานผลการตรวจวิเคราะห์','ออกรายงาน ตรวจสอบ อนุมัติ และส่งผล','QP-LAB-21','ต่อเนื่อง (ทุกรอบงาน)','นักเทคนิคการแพทย์ / นักวิทยาศาสตร์การแพทย์','activity'),
('CBH-QT-23','D','กระบวนการทดสอบ',23,'การออกรายงานผลโดยระบบอัตโนมัติ (Autoverification)','กำหนด Rule ทบทวน และติดตามผลระบบ','QP-LAB-22','ทบทวน Rule ≥ 1 ครั้ง/ปี; ตรวจสอบต่อเนื่อง','คณะทำงานด้านวิชาการ / คณะทำงานระบบสารสนเทศ','activity'),
('CBH-QT-24','D','กระบวนการทดสอบ',24,'การรายงานผลค่าวิกฤต (Critical Values)','แจ้ง จดบันทึก ยืนยันผู้รับ และติดตาม',null,'ทุกครั้งที่พบ','นักเทคนิคการแพทย์ / ผู้รับผิดชอบ','activity'),
('CBH-QT-25','D','กระบวนการทดสอบ',25,'การจัดการตัวอย่างส่งตรวจหลังการตรวจ','เก็บรักษา ทำลาย หรือส่งคืน','QP-LAB-20','ต่อเนื่องตามระยะเวลาที่กำหนด','นักเทคนิคการแพทย์','activity'),
('CBH-QT-26','E','การบริการและความสัมพันธ์กับผู้รับบริการ',26,'การสำรวจความพึงพอใจผู้รับบริการ','จัดทำแบบสอบถาม เก็บข้อมูล วิเคราะห์ และรายงาน','QP-LAB-09','≥ 1 ครั้ง/ปี','คณะทำงานด้านวิชาการ','activity'),
('CBH-QT-27','E','การบริการและความสัมพันธ์กับผู้รับบริการ',27,'การให้บริการแนะนำ (Advisory Services)','ให้คำปรึกษา แนะนำการแปลผล และเลือกรายการทดสอบ','QP-LAB-05','ต่อเนื่อง','นักเทคนิคการแพทย์ / นักวิทยาศาสตร์การแพทย์','activity'),
('CBH-QT-28','E','การบริการและความสัมพันธ์กับผู้รับบริการ',28,'การสื่อสารกับผู้รับบริการและบุคลากรภายใน','ประชาสัมพันธ์ แจ้งข่าวสาร และช่องทางรับร้องเรียน','QP-LAB-25','ต่อเนื่อง','หัวหน้ากลุ่มงาน / บุคลากรทุกคน','activity'),
('CBH-QT-29','F','ความปลอดภัยและสิ่งแวดล้อม',29,'การบริหารความปลอดภัยในห้องปฏิบัติการ','ตรวจสอบ ทบทวนนโยบาย และฝึกซ้อมฉุกเฉิน','QP-LAB-26','ต่อเนื่อง; ทบทวน ≥ 1 ครั้ง/ปี','คณะทำงานความปลอดภัยและสิ่งแวดล้อม (LSO)','activity'),
('CBH-QT-30','F','ความปลอดภัยและสิ่งแวดล้อม',30,'การสำรวจความปลอดภัยอาคาร/พื้นที่','ตรวจสภาพแวดล้อม ระบบไฟ น้ำ ก๊าซ และพื้นที่ทำงาน','FmQPLAB26-01','≥ 1 ครั้ง/ปี','คณะทำงานความปลอดภัยและสิ่งแวดล้อม','activity'),
('CBH-QT-31','F','ความปลอดภัยและสิ่งแวดล้อม',31,'การจัดการสารเคมีอันตราย/วัตถุอันตราย','รับ จัดเก็บ ใช้ ทำลาย SDS และป้ายภาชนะ','PLFMSCBH001','ต่อเนื่อง','คณะทำงานความปลอดภัยและสิ่งแวดล้อม / นักเทคนิคการแพทย์','activity'),
('CBH-QT-32','F','ความปลอดภัยและสิ่งแวดล้อม',32,'การจัดการขยะในโรงพยาบาล','แยกประเภท บรรจุ จัดเก็บ และกำจัด','HPPCICBH011','ต่อเนื่อง','คณะทำงานความปลอดภัยและสิ่งแวดล้อม / บุคลากรทุกคน','activity'),
('CBH-QT-33','F','ความปลอดภัยและสิ่งแวดล้อม',33,'การฝึกซ้อมแผนฉุกเฉิน / Fire Drill','ทบทวนแผน ซ้อมอพยพ และซ้อมดับเพลิง',null,'≥ 1 ครั้ง/ปี','คณะทำงานความปลอดภัยและสิ่งแวดล้อม','activity'),
('CBH-QT-34','G','ระบบสารสนเทศ (LIS/IT)',34,'การบริหารข้อมูลและแผนปฏิบัติการฉุกเฉิน IT','ทบทวน Business Continuity Plan และสำรองข้อมูล','QP-LAB-24','ทบทวน ≥ 1 ครั้ง/ปี; สำรองข้อมูลต่อเนื่อง','คณะทำงานระบบสารสนเทศ','activity'),
('CBH-QT-35','G','ระบบสารสนเทศ (LIS/IT)',35,'การรักษาความลับข้อมูลผู้ป่วย','ควบคุมการเข้าถึงและทบทวนระดับสิทธิ์ผู้ใช้ระบบ','QP-LAB-23','ต่อเนื่อง; ทบทวนสิทธิ์ ≥ 1 ครั้ง/ปี','คณะทำงานระบบสารสนเทศ / หัวหน้ากลุ่มงาน','activity'),
('CBH-QT-36','G','ระบบสารสนเทศ (LIS/IT)',36,'การซ้อมแผนฉุกเฉิน Code IT','ทดสอบระบบสำรองและแผนการทำงานด้วย Manual','HPFMSCBH007','≥ 1 ครั้ง/ปี','คณะทำงานระบบสารสนเทศ','activity'),
('CBH-QT-37','H','POCT (Point-of-Care Testing)',37,'การบริหารจัดการ POCT','กำกับดูแล QC การอบรม และการบำรุงรักษาเครื่อง POCT',null,'ต่อเนื่อง; ทบทวน ≥ 1 ครั้ง/ปี','คณะทำงาน POCT','activity'),
('CBH-QT-38','H','POCT (Point-of-Care Testing)',38,'การเปรียบเทียบผล POCT กับห้องปฏิบัติการหลัก','ทดสอบเปรียบเทียบค่า Correlation',null,'≥ 2 ครั้ง/ปี','คณะทำงาน POCT / คณะทำงานด้านวิชาการ','activity'),
('CBH-QT-39','I','การประชุมและการสื่อสารภายใน',39,'การประชุมคณะกรรมการ/คณะทำงานด้านวิชาการ','ทบทวนผลงาน EQA, IQC และปัญหาวิชาการ',null,'≥ 1 ครั้ง/เดือน','คณะทำงานด้านวิชาการ','meeting'),
('CBH-QT-40','I','การประชุมและการสื่อสารภายใน',40,'การประชุมคณะทำงานความเสี่ยง','ทบทวน Risk Register, CAPA และอุบัติการณ์',null,'≥ 1 ครั้ง/เดือน','คณะทำงานความเสี่ยง','meeting'),
('CBH-QT-41','I','การประชุมและการสื่อสารภายใน',41,'การประชุมคณะทำงานเครื่องมือ','ทบทวนสถานะ PM, Calibration และปัญหาเครื่องมือ',null,'≥ 1 ครั้ง/เดือน','คณะทำงานเครื่องมือ','meeting'),
('CBH-QT-42','I','การประชุมและการสื่อสารภายใน',42,'การประชุมคณะทำงานความปลอดภัยและสิ่งแวดล้อม','ทบทวนอุบัติการณ์ความปลอดภัยและสภาพแวดล้อม',null,'≥ 1 ครั้ง/เดือน','คณะทำงานความปลอดภัยและสิ่งแวดล้อม','meeting'),
('CBH-QT-43','I','การประชุมและการสื่อสารภายใน',43,'การประชุมคณะทำงานระบบสารสนเทศ','ทบทวนปัญหา LIS/HIS และการพัฒนาระบบ',null,'≥ 1 ครั้ง/เดือน','คณะทำงานระบบสารสนเทศ','meeting'),
('CBH-QT-44','I','การประชุมและการสื่อสารภายใน',44,'การประชุมหัวหน้าห้องปฏิบัติการ/บุคลากรทั้งกลุ่มงาน','สื่อสารนโยบาย แจ้งข่าวสาร และรับทราบปัญหา',null,'≥ 1 ครั้ง/เดือน','หัวหน้ากลุ่มงาน / บุคลากรทุกคน','meeting')
)
insert into public.quality_task_templates
  (source_key, category_code, category_name, activity_no, title, description, reference_code, frequency_text, owner_text, task_kind, evidence_required)
select source_key, category_code, category_name, activity_no, title, description, reference_code, frequency_text, owner_text, task_kind, task_kind = 'meeting'
from seed
on conflict (source_key) do update set
  category_code=excluded.category_code, category_name=excluded.category_name, activity_no=excluded.activity_no,
  title=excluded.title, description=excluded.description, reference_code=excluded.reference_code,
  frequency_text=excluded.frequency_text, owner_text=excluded.owner_text, task_kind=excluded.task_kind,
  evidence_required=excluded.evidence_required, updated_at=now();

update public.quality_task_templates set evidence_required = true where task_kind = 'meeting';

with schedule_seed(source_key, schedule_key, interval_unit, interval_count) as (values
('CBH-QT-02','annual','year',1), ('CBH-QT-03','monthly','month',1), ('CBH-QT-03','annual','year',1),
('CBH-QT-04','annual','year',1), ('CBH-QT-06','annual','year',1), ('CBH-QT-07','annual','year',1),
('CBH-QT-08','annual','year',1), ('CBH-QT-10','annual','year',1), ('CBH-QT-12','annual','year',1),
('CBH-QT-17','monthly','month',1), ('CBH-QT-20','semiannual','month',6), ('CBH-QT-23','annual','year',1),
('CBH-QT-26','annual','year',1), ('CBH-QT-29','annual','year',1), ('CBH-QT-30','annual','year',1),
('CBH-QT-33','annual','year',1), ('CBH-QT-34','annual','year',1), ('CBH-QT-35','annual','year',1),
('CBH-QT-36','annual','year',1), ('CBH-QT-37','annual','year',1), ('CBH-QT-38','semiannual','month',6),
('CBH-QT-39', 'monthly','month',1), ('CBH-QT-40', 'monthly','month',1), ('CBH-QT-41', 'monthly','month',1),
('CBH-QT-42', 'monthly','month',1), ('CBH-QT-43', 'monthly','month',1), ('CBH-QT-44', 'monthly','month',1)
)
insert into public.quality_task_schedules (template_id, schedule_key, interval_unit, interval_count, starts_on)
select t.id, s.schedule_key, s.interval_unit, s.interval_count, date '2025-10-01'
from schedule_seed s join public.quality_task_templates t on t.source_key=s.source_key
on conflict (template_id, schedule_key) do update set interval_unit=excluded.interval_unit, interval_count=excluded.interval_count, active=true;
