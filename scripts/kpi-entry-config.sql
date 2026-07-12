-- ══════════════════════════════════════════════════════════════════
-- KPI Entry Config — ผู้ได้รับมอบหมายกรอกรายแผนก + ตัวชี้วัดที่ยกเว้น
-- รันด้วยมือใน Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════════

-- ผู้ได้รับมอบหมายให้กรอก KPI รายแผนก
-- (นอกเหนือจากผู้มีสิทธิ์ KPI:edit ตาม permission matrix ซึ่งกรอกได้ทุกแผนก)
create table if not exists kpi_dept_assignees (
  id       bigint generated always as identity primary key,
  dept_id  bigint not null references departments(id) on delete cascade,
  user_id  uuid   not null references profiles(id) on delete cascade,
  unique (dept_id, user_id)
);

create index if not exists idx_kpi_dept_assignees_user on kpi_dept_assignees (user_id);

-- ตัวชี้วัดที่แผนก "ไม่ต้องกรอก" (default = ไม่มีแถว = ทุกแผนกกรอกทุกข้อ)
create table if not exists kpi_dept_exclusions (
  id       bigint generated always as identity primary key,
  dept_id  bigint not null references departments(id) on delete cascade,
  kpi_id   bigint not null references kpi_definitions(id) on delete cascade,
  unique (dept_id, kpi_id)
);

create index if not exists idx_kpi_dept_exclusions_dept on kpi_dept_exclusions (dept_id);
