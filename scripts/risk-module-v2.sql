-- ============================================================================
-- Risk module v2 — แยกตาราง `risks` ที่ถูกใช้ปนกัน 3 อย่างออกเป็น 3 ตาราง
--
--   smart_rm_events   ข้อมูลนำเข้าจาก HIS สำหรับวิเคราะห์อย่างเดียว (ไม่มี workflow)
--   incident_reports  รายงานอุบัติการณ์ IOR ที่แล็บจัดการเอง (ISO 15189 8.7)
--   risk_register     การประเมินความเสี่ยงเชิงรุก (ISO 15189 8.5)
--
-- รันมือใน Supabase Dashboard → SQL Editor (โปรเจกต์นี้ไม่มี migration runner)
-- ทั้งสคริปต์อยู่ใน transaction เดียว — ถ้ามีอะไรผิดจะ rollback ทั้งหมด
--
-- ตาราง `risks` เดิมไม่ถูกลบ แต่เปลี่ยนชื่อเป็น `risks_legacy` เพราะเป็นบันทึก QMS
-- ============================================================================

begin;

-- ── 0. กันรันซ้ำ ─────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.risks_legacy') is not null then
    raise exception 'risk-module-v2.sql เคยรันไปแล้ว (พบตาราง risks_legacy) — ยกเลิก';
  end if;
  if to_regclass('public.risks') is null then
    raise exception 'ไม่พบตาราง risks — ต้องรัน migration.sql และ risk-management-module.sql ก่อน';
  end if;
end $$;


-- ── 1. risk_register — การประเมินความเสี่ยงเชิงรุก (ISO 15189 8.5) ───────────
-- สร้างก่อน incident_reports เพราะ escalated_register_id อ้างถึงตารางนี้
create table if not exists public.risk_register (
  id                    bigint generated always as identity primary key,
  risk_no               text,                       -- รหัสความเสี่ยง เช่น BIO-01
  assessed_date         date not null,
  department            text,
  hazard_category       text,                       -- หมวดอันตราย A–H
  process_step          text,                       -- กระบวนการ/จุดงาน
  risk_statement        text not null,              -- "ถ้า…จะทำให้…"
  affected_parties      text,                       -- เจ้าหน้าที่/ผู้ป่วย/ผู้มาเยี่ยม/สิ่งแวดล้อม
  causes                text,
  existing_controls     text,
  additional_controls   text,
  reference_docs        text,

  -- ทะเบียนใช้ L×S เท่านั้น ไม่ใช้ severity A–I (นั่นเป็นศัพท์ของ IOR/Smart-RM)
  likelihood            int check (likelihood between 1 and 5),
  impact                int check (impact between 1 and 5),
  -- generated column: score/level คำนวณจาก L×S เสมอ เขียนทับจาก application ไม่ได้
  -- ปิดจุดที่ระบบเดิมบังคับ level='low' เมื่อไม่มี L×S ทำให้ dashboard นับผิด
  score                 int generated always as (likelihood * impact) stored,
  level                 text generated always as (
                          case
                            when likelihood is null or impact is null then null
                            when likelihood * impact >= 15 then 'high'
                            when likelihood * impact >= 8  then 'medium'
                            else 'low'
                          end
                        ) stored,

  residual_likelihood   int check (residual_likelihood between 1 and 5),
  residual_impact       int check (residual_impact between 1 and 5),
  residual_score        int generated always as (residual_likelihood * residual_impact) stored,
  residual_level        text generated always as (
                          case
                            when residual_likelihood is null or residual_impact is null then null
                            when residual_likelihood * residual_impact >= 15 then 'high'
                            when residual_likelihood * residual_impact >= 8  then 'medium'
                            else 'low'
                          end
                        ) stored,
  residual_assessed_at  timestamptz,
  residual_assessed_by       uuid references public.profiles(id),
  residual_assessed_by_name  text,                  -- ชื่อ ณ เวลานั้น (รองรับข้อมูลเดิมที่เก็บเป็นข้อความ)

  risk_accepted_by      uuid references public.profiles(id),
  risk_accepted_by_name text,
  risk_accepted_at      timestamptz,

  owner                 text,
  status                text not null default 'open'
                          check (status in ('open','treating','monitoring','accepted','closed')),

  -- ทบทวนประจำปีตาม ISO 8.5 — ของใหม่ ระบบเดิมไม่มีรอบทบทวนเลย
  next_review_date      date,
  last_reviewed_at      timestamptz,
  last_reviewed_by      uuid references public.profiles(id),
  last_reviewed_by_name text,

  legacy_risk_id        bigint,                     -- id เดิมใน risks_legacy สำหรับสอบทาน
  created_by            uuid references public.profiles(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz
);

create unique index if not exists idx_risk_register_risk_no
  on public.risk_register (risk_no) where risk_no is not null and risk_no <> '';
create index if not exists idx_risk_register_active
  on public.risk_register (deleted_at) where deleted_at is null;
create index if not exists idx_risk_register_next_review on public.risk_register (next_review_date);
create index if not exists idx_risk_register_residual_level on public.risk_register (residual_level);
create index if not exists idx_risk_register_status on public.risk_register (status);
create index if not exists idx_risk_register_department on public.risk_register (department);


-- ── 2. incident_reports — IOR (ISO 15189 8.7) ────────────────────────────────
create table if not exists public.incident_reports (
  id                    bigint generated always as identity primary key,
  report_no             text,
  event_date            date not null,
  event_time            time,

  reported_by           uuid references public.profiles(id),
  reporter_name         text,
  reporter_position     text,
  department_found      text,
  department_target     text,

  event_category        text,
  event_detail          text not null,
  immediate_correction  text,
  impact_summary        text,

  -- IOR ใช้ severity A–I เท่านั้น ไม่ใช้ L×S (นั่นเป็นศัพท์ของทะเบียนความเสี่ยง)
  severity_level        text check (severity_level ~ '^[A-I]$'),
  requires_rca          boolean not null default false,

  status                text not null default 'reported'
                          check (status in ('reported','reviewing','action','monitoring','closed')),

  reviewed_by           uuid references public.profiles(id),
  reviewed_by_name      text,
  reviewed_at           timestamptz,
  review_note           text,

  rca_method            text,
  root_cause            text,
  rca_factors           jsonb not null default '{}'::jsonb,

  effectiveness_result  text,
  evidence_note         text,

  -- IOR ที่พบว่าเป็นความเสี่ยงเชิงระบบ → ยกระดับเข้าทะเบียนความเสี่ยง
  escalated_register_id bigint references public.risk_register(id) on delete set null,

  closed_by             uuid references public.profiles(id),
  closed_by_name        text,
  closed_at             timestamptz,

  legacy_risk_id        bigint,
  created_by            uuid references public.profiles(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz
);

create unique index if not exists idx_incident_reports_report_no
  on public.incident_reports (report_no) where report_no is not null and report_no <> '';
create index if not exists idx_incident_reports_active
  on public.incident_reports (deleted_at) where deleted_at is null;
create index if not exists idx_incident_reports_status on public.incident_reports (status);
create index if not exists idx_incident_reports_event_date on public.incident_reports (event_date desc);
create index if not exists idx_incident_reports_severity on public.incident_reports (severity_level);
create index if not exists idx_incident_reports_department on public.incident_reports (department_found);
create index if not exists idx_incident_reports_reported_by on public.incident_reports (reported_by);


-- ── 3. smart_rm_events — ข้อมูลนำเข้าจาก HIS อ่านอย่างเดียว ──────────────────
-- ไม่มี status enum / likelihood / impact / residual / owner / closed_*
-- นี่คือประเด็นทั้งหมดของการแยก: ข้อมูลชุดนี้ไม่มี workflow จึงต้องไม่ถูกนับใน KPI งาน
create table if not exists public.smart_rm_events (
  id                    bigint generated always as identity primary key,
  external_no           text not null unique,       -- คอลัมน์ 'หมายเลข' = คีย์ upsert
  event_date            date,
  recorded_date         date,
  department_found      text,                       -- สถานที่เกิดเหตุ
  department_target     text,                       -- หน่วยงานที่ต้องการส่งถึง
  risk_type             text,                       -- Clinic / Non-Clinic
  event_main_category   text,
  event_sub_category    text,
  severity_level        text check (severity_level ~ '^[A-I]$'),
  event_detail          text,
  ior_status            text,                       -- ข้อความสถานะจาก HIS ตามจริง ไม่แปลงเป็น enum
  legacy_risk_id        bigint,
  imported_at           timestamptz not null default now(),
  imported_by           uuid references public.profiles(id)
);

create index if not exists idx_smart_rm_event_date on public.smart_rm_events (event_date desc);
create index if not exists idx_smart_rm_severity on public.smart_rm_events (severity_level);
create index if not exists idx_smart_rm_department on public.smart_rm_events (department_found);
create index if not exists idx_smart_rm_risk_type on public.smart_rm_events (risk_type);


-- ── 4. ย้ายข้อมูลจาก risks ───────────────────────────────────────────────────
-- แยกด้วยเงื่อนไขเดียวกับที่โค้ดเดิมใช้เดา แล้วจากนี้ไปใช้ตารางเป็นตัวแยกแทน

-- 4a. Smart-RM = แถวที่มีหมายเลขจากระบบ HIS
insert into public.smart_rm_events (
  external_no, event_date, recorded_date, department_found, department_target,
  risk_type, event_main_category, event_sub_category, severity_level,
  event_detail, ior_status, legacy_risk_id, imported_at, imported_by
)
select
  trim(r.external_no),
  r.event_date,
  r.recorded_date,
  r.department_found,
  r.department_target,
  r.risk_type,
  r.event_main_category,
  r.event_sub_category,
  -- ข้อมูลเดิมอาจมีตัวพิมพ์เล็กหรือค่าที่ไม่ใช่ A–I ปนมา — normalize แล้วทิ้งค่าที่ใช้ไม่ได้
  case when upper(trim(coalesce(r.severity_level,''))) ~ '^[A-I]$'
       then upper(trim(r.severity_level)) end,
  r.event_detail,
  r.ior_status,
  r.id,
  coalesce(r.created_at, now()),
  r.created_by
from public.risks r
where coalesce(trim(r.external_no), '') <> ''
  -- external_no ซ้ำในข้อมูลเดิมเป็นไปไม่ได้ (มี unique index อยู่แล้ว) แต่กันไว้
on conflict (external_no) do nothing;

-- 4b. Risk Register = แถวประเมินความเสี่ยงเชิงรุก
insert into public.risk_register (
  risk_no, assessed_date, department, hazard_category, process_step,
  risk_statement, affected_parties, causes, existing_controls, additional_controls,
  reference_docs, likelihood, impact,
  residual_likelihood, residual_impact, residual_assessed_at, residual_assessed_by_name,
  risk_accepted_by_name, risk_accepted_at, owner, status,
  legacy_risk_id, created_by, created_at, updated_at
)
select
  nullif(trim(coalesce(r.risk_no, '')), ''),
  coalesce(r.event_date, r.recorded_date, r.created_at::date),
  r.department_found,
  r.risk_type,                                       -- หมวดอันตราย A–H เก็บใน risk_type เดิม
  r.event_sub_category,
  -- risk_statement เป็น not null: ไล่หาค่าที่พอใช้เป็นข้อความความเสี่ยงได้
  coalesce(nullif(trim(coalesce(r.event_detail, '')), ''),
           nullif(trim(coalesce(r.event_category, '')), ''),
           nullif(trim(coalesce(r.name, '')), ''),
           'ไม่ระบุ'),
  r.impact_summary,
  r.root_cause,
  r.immediate_correction,                            -- Existing controls
  r.review_note,                                     -- Additional controls
  r.evidence_note,
  r.likelihood,
  r.impact,
  r.residual_likelihood,
  r.residual_impact,
  r.residual_assessed_at,
  r.residual_assessed_by,                            -- เดิมเป็น text (ชื่อ) → เก็บลงช่อง _name
  r.risk_accepted_by,
  r.risk_accepted_at,
  r.owner,
  case r.status
    when 'closed'     then 'closed'
    when 'monitoring' then 'monitoring'
    when 'mitigating' then 'treating'
    else 'open'
  end,
  r.id,
  r.created_by,
  coalesce(r.created_at, now()),
  coalesce(r.updated_at, r.created_at, now())
from public.risks r
where coalesce(trim(r.external_no), '') = ''
  and r.event_type = 'risk_assessment';

-- 4c. IOR = ที่เหลือทั้งหมด
insert into public.incident_reports (
  report_no, event_date, event_time, reporter_name, reporter_position,
  department_found, department_target, event_category, event_detail,
  immediate_correction, impact_summary, severity_level, requires_rca,
  status, reviewed_by_name, reviewed_at, review_note,
  rca_method, root_cause, rca_factors, effectiveness_result, evidence_note,
  closed_by_name, closed_at, legacy_risk_id, created_by, created_at, updated_at
)
select
  nullif(trim(coalesce(r.risk_no, '')), ''),
  coalesce(r.event_date, r.recorded_date, r.created_at::date),
  r.event_time,
  r.reporter_name,
  r.reporter_position,
  r.department_found,
  r.department_target,
  coalesce(nullif(trim(coalesce(r.event_category, '')), ''),
           nullif(trim(coalesce(r.event_sub_category, '')), '')),
  coalesce(nullif(trim(coalesce(r.event_detail, '')), ''),
           nullif(trim(coalesce(r.name, '')), ''),
           'ไม่ระบุ'),
  r.immediate_correction,
  r.impact_summary,
  case when upper(trim(coalesce(r.severity_level,''))) ~ '^[A-I]$'
       then upper(trim(r.severity_level)) end,
  coalesce(r.requires_rca, false),
  -- สถานะเดิม 4 ค่า → 5 ค่าใหม่ที่ตรงกับวงจรจริง
  -- 'open' เดิมแปลว่า "ยังไม่มีใครแตะ" จึงตรงกับ 'reported'
  case r.status
    when 'closed'     then 'closed'
    when 'monitoring' then 'monitoring'
    when 'mitigating' then 'action'
    else case when r.review_status in ('reviewed','rca_required') then 'reviewing' else 'reported' end
  end,
  r.reviewed_by,                                     -- เดิมเป็น text (ชื่อ) → ช่อง _name
  r.reviewed_at,
  r.review_note,
  r.rca_method,
  r.root_cause,
  coalesce(r.rca_factors, '{}'::jsonb),
  r.effectiveness_result,
  r.evidence_note,
  r.closed_by,
  r.closed_at,
  r.id,
  r.created_by,
  coalesce(r.created_at, now()),
  coalesce(r.updated_at, r.created_at, now())
from public.risks r
where coalesce(trim(r.external_no), '') = ''
  and coalesce(r.event_type, '') <> 'risk_assessment';


-- ── 5. risk_actions — เปลี่ยนจาก FK เดียวเป็น FK สองตัวแบบ exclusive ─────────
-- ใช้รูปแบบเดียวกับ eqa_attachments (scripts/external-quality-module.sql)
alter table public.risk_actions
  add column if not exists incident_id bigint references public.incident_reports(id) on delete cascade,
  add column if not exists register_id bigint references public.risk_register(id) on delete cascade;

update public.risk_actions a
   set incident_id = i.id
  from public.incident_reports i
 where i.legacy_risk_id = a.risk_id;

update public.risk_actions a
   set register_id = g.id
  from public.risk_register g
 where g.legacy_risk_id = a.risk_id;

-- Smart-RM ไม่มี workflow จึงไม่ควรมี action ผูกอยู่
-- ถ้ามี แปลว่าข้อมูลเดิมผิดปกติ — หยุดให้คนตัดสินใจ ไม่ลบเงียบ ๆ
do $$
declare orphan_count int;
begin
  select count(*) into orphan_count
    from public.risk_actions
   where incident_id is null and register_id is null;
  if orphan_count > 0 then
    raise exception 'พบ risk_actions % แถวที่ผูกกับแถว Smart-RM (ไม่มี workflow) — ตรวจสอบก่อนแล้วรันใหม่', orphan_count;
  end if;
end $$;

alter table public.risk_actions drop column if exists risk_id;

alter table public.risk_actions drop constraint if exists risk_actions_one_parent;
alter table public.risk_actions add constraint risk_actions_one_parent
  check ((incident_id is not null)::int + (register_id is not null)::int = 1);

create index if not exists idx_risk_actions_incident on public.risk_actions (incident_id);
create index if not exists idx_risk_actions_register on public.risk_actions (register_id);


-- ── 6. risk_attachments — ไฟล์หลักฐานใน R2 ───────────────────────────────────
create table if not exists public.risk_attachments (
  id            uuid primary key default gen_random_uuid(),
  incident_id   bigint references public.incident_reports(id) on delete cascade,
  register_id   bigint references public.risk_register(id) on delete cascade,
  action_id     bigint references public.risk_actions(id) on delete cascade,
  r2_key        text not null unique,
  file_name     text not null,
  content_type  text not null,
  size_bytes    bigint not null check (size_bytes > 0 and size_bytes <= 20971520),
  uploaded_at   timestamptz not null default now(),
  uploaded_by   uuid not null references public.profiles(id),
  constraint risk_attachments_one_parent
    check ((incident_id is not null)::int + (register_id is not null)::int = 1)
);

create index if not exists idx_risk_attachments_incident on public.risk_attachments (incident_id);
create index if not exists idx_risk_attachments_register on public.risk_attachments (register_id);
create index if not exists idx_risk_attachments_action on public.risk_attachments (action_id);


-- ── 7. RLS — รูปแบบเดียวกับ risk_actions เดิม ────────────────────────────────
-- อ่านได้เมื่อล็อกอิน / เขียนได้เฉพาะ Admin กับ Manager
-- (การเขียนจริงทั้งหมดไปผ่าน API route ที่ใช้ service role อยู่แล้ว นี่คือชั้นกันพลาด)
do $$
declare t text;
begin
  foreach t in array array['smart_rm_events','incident_reports','risk_register','risk_attachments']
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I', t || '_auth_read', t);
    execute format(
      'create policy %I on public.%I for select using (auth.role() <> ''anon'')',
      t || '_auth_read', t);

    execute format('drop policy if exists %I on public.%I', t || '_admin_manager_write', t);
    execute format(
      'create policy %I on public.%I for all
         using (exists (select 1 from public.profiles p
                         where p.id = auth.uid() and p.role in (''Admin'',''Manager'')))
         with check (exists (select 1 from public.profiles p
                              where p.id = auth.uid() and p.role in (''Admin'',''Manager'')))',
      t || '_admin_manager_write', t);
  end loop;
end $$;


-- ── 8. เก็บตารางเดิมไว้เป็นบันทึก QMS ────────────────────────────────────────
alter table public.risks rename to risks_legacy;


-- ── 9. รายงานผลให้ตรวจก่อน commit ────────────────────────────────────────────
do $$
declare
  legacy_total   int;
  smart_total    int;
  incident_total int;
  register_total int;
  ior_with_ls    int;
  reg_thai_sev   int;
begin
  select count(*) into legacy_total   from public.risks_legacy;
  select count(*) into smart_total    from public.smart_rm_events;
  select count(*) into incident_total from public.incident_reports;
  select count(*) into register_total from public.risk_register;

  -- IOR เดิมที่มี L×S หรือ residual ติดมา: ศัพท์ชุดนั้นย้ายไปอยู่ที่ทะเบียนแล้ว
  -- ค่าเหล่านี้ไม่ถูกย้ายตาม ยังอยู่ครบใน risks_legacy — ถ้าจำเป็นให้ยกระดับเป็นรายการทะเบียนทีหลัง
  select count(*) into ior_with_ls
    from public.risks_legacy r
   where coalesce(trim(r.external_no), '') = ''
     and coalesce(r.event_type, '') <> 'risk_assessment'
     and (r.likelihood is not null or r.impact is not null
          or r.residual_likelihood is not null or r.residual_impact is not null);

  -- ทะเบียนเดิมที่ severity_level เป็นคำไทย: ตอนนี้ level มาจาก L×S แล้วจึงไม่ต้องย้าย
  select count(*) into reg_thai_sev
    from public.risks_legacy r
   where coalesce(trim(r.external_no), '') = ''
     and r.event_type = 'risk_assessment'
     and coalesce(trim(r.severity_level), '') <> ''
     and not (upper(trim(r.severity_level)) ~ '^[A-I]$');

  raise notice '─────────────────────────────────────────────';
  raise notice 'risks_legacy      : % แถว', legacy_total;
  raise notice 'smart_rm_events   : % แถว', smart_total;
  raise notice 'incident_reports  : % แถว', incident_total;
  raise notice 'risk_register     : % แถว', register_total;
  raise notice 'รวม 3 ตารางใหม่   : % แถว', smart_total + incident_total + register_total;
  raise notice '─────────────────────────────────────────────';
  raise notice 'IOR เดิมที่มี L×S/residual ติดมา (ไม่ถูกย้าย) : % แถว', ior_with_ls;
  raise notice 'ทะเบียนเดิมที่ severity เป็นคำไทย (ใช้ L×S แทน) : % แถว', reg_thai_sev;

  if smart_total + incident_total + register_total <> legacy_total then
    raise exception 'จำนวนแถวไม่ตรง: legacy=% แต่รวมใหม่=% — ยกเลิก',
      legacy_total, smart_total + incident_total + register_total;
  end if;
end $$;

commit;
