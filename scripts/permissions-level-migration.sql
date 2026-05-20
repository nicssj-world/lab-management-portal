-- Permissions Level Migration
-- Upgrades role_permissions to use level ('none'|'view'|'edit') instead of boolean granted
-- Safe to run on fresh DB or existing DB with old schema

-- 0. Grant schema permissions (required on Postgres 15+)
grant usage  on schema public to postgres, anon, authenticated, service_role;
grant create on schema public to postgres, service_role;

-- 1. Create table if not exists (new schema)
create table if not exists role_permissions (
  id         uuid primary key default gen_random_uuid(),
  role       text not null,
  resource   text not null,
  level      text not null default 'none' check (level in ('none', 'view', 'edit')),
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id),
  unique (role, resource)
);

-- 2. If upgrading from old schema (granted boolean), migrate to level
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'role_permissions' and column_name = 'granted'
  ) then
    alter table role_permissions
      add column if not exists level text not null default 'none';
    alter table role_permissions
      drop constraint if exists role_permissions_level_check;
    alter table role_permissions
      add constraint role_permissions_level_check
      check (level in ('none', 'view', 'edit'));
    update role_permissions set level = case when granted then 'edit' else 'none' end;
    alter table role_permissions drop column granted;
  end if;
end $$;

-- 3. RLS
alter table role_permissions enable row level security;

drop policy if exists "role_permissions_read"        on role_permissions;
drop policy if exists "role_permissions_admin_write" on role_permissions;

create policy "role_permissions_read" on role_permissions
  for select using (true);

create policy "role_permissions_admin_write" on role_permissions
  for all using (
    (select role from profiles where id = auth.uid()) ilike 'admin'
  );

-- 4. Remove old fine-grained resource rows and seed fresh
delete from role_permissions where resource in (
  'รายการตรวจ (อ่าน)', 'รายการตรวจ (แก้ไข)',
  'Workload (บันทึก)', 'KPI (บันทึก)'
);

insert into role_permissions (role, resource, level) values
  -- Admin (all edit — locked in UI)
  ('Admin', 'รายการตรวจ',              'edit'),
  ('Admin', 'เอกสารคุณภาพ',           'edit'),
  ('Admin', 'ข่าวสาร',                'edit'),
  ('Admin', 'ความเสี่ยง / Rejection', 'edit'),
  ('Admin', 'สัญญา',                  'edit'),
  ('Admin', 'Workload',               'edit'),
  ('Admin', 'KPI',                    'edit'),
  ('Admin', 'TAT (นำเข้า)',           'edit'),
  ('Admin', 'User Management',        'edit'),
  -- Manager
  ('Manager', 'รายการตรวจ',              'edit'),
  ('Manager', 'เอกสารคุณภาพ',           'edit'),
  ('Manager', 'ข่าวสาร',                'edit'),
  ('Manager', 'ความเสี่ยง / Rejection', 'edit'),
  ('Manager', 'สัญญา',                  'edit'),
  ('Manager', 'Workload',               'view'),
  ('Manager', 'KPI',                    'edit'),
  ('Manager', 'TAT (นำเข้า)',           'edit'),
  ('Manager', 'User Management',        'none'),
  -- Medical Technologist
  ('Medical Technologist', 'รายการตรวจ',              'view'),
  ('Medical Technologist', 'เอกสารคุณภาพ',           'view'),
  ('Medical Technologist', 'ข่าวสาร',                'view'),
  ('Medical Technologist', 'ความเสี่ยง / Rejection', 'view'),
  ('Medical Technologist', 'สัญญา',                  'none'),
  ('Medical Technologist', 'Workload',               'edit'),
  ('Medical Technologist', 'KPI',                    'view'),
  ('Medical Technologist', 'TAT (นำเข้า)',           'none'),
  ('Medical Technologist', 'User Management',        'none'),
  -- Assistant
  ('Assistant', 'รายการตรวจ',              'view'),
  ('Assistant', 'เอกสารคุณภาพ',           'none'),
  ('Assistant', 'ข่าวสาร',                'view'),
  ('Assistant', 'ความเสี่ยง / Rejection', 'none'),
  ('Assistant', 'สัญญา',                  'none'),
  ('Assistant', 'Workload',               'none'),
  ('Assistant', 'KPI',                    'none'),
  ('Assistant', 'TAT (นำเข้า)',           'none'),
  ('Assistant', 'User Management',        'none')
on conflict (role, resource) do update set level = excluded.level;
