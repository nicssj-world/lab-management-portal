-- Permissions Matrix Migration
-- Run in Supabase SQL Editor after user-management-migration.sql

-- 1. Create role_permissions table
create table if not exists role_permissions (
  id          uuid primary key default gen_random_uuid(),
  role        text not null,
  resource    text not null,
  granted     boolean not null default false,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references profiles(id),
  unique (role, resource)
);

-- 2. RLS
alter table role_permissions enable row level security;

drop policy if exists "role_permissions_read" on role_permissions;
create policy "role_permissions_read" on role_permissions
  for select using (true);

drop policy if exists "role_permissions_admin_write" on role_permissions;
create policy "role_permissions_admin_write" on role_permissions
  for all using (
    (select role from profiles where id = auth.uid()) ilike 'admin'
  );

-- 3. Seed with current matrix
insert into role_permissions (role, resource, granted) values
  -- Admin (all granted — cannot be revoked via UI)
  ('Admin', 'รายการตรวจ (อ่าน)',      true),
  ('Admin', 'รายการตรวจ (แก้ไข)',     true),
  ('Admin', 'เอกสารคุณภาพ',           true),
  ('Admin', 'ข่าวสาร',                true),
  ('Admin', 'ความเสี่ยง / Rejection', true),
  ('Admin', 'สัญญา',                  true),
  ('Admin', 'Workload (บันทึก)',       true),
  ('Admin', 'KPI (บันทึก)',           true),
  ('Admin', 'TAT (นำเข้า)',           true),
  ('Admin', 'User Management',        true),
  -- Manager
  ('Manager', 'รายการตรวจ (อ่าน)',      true),
  ('Manager', 'รายการตรวจ (แก้ไข)',     true),
  ('Manager', 'เอกสารคุณภาพ',           true),
  ('Manager', 'ข่าวสาร',                true),
  ('Manager', 'ความเสี่ยง / Rejection', true),
  ('Manager', 'สัญญา',                  true),
  ('Manager', 'Workload (บันทึก)',       false),
  ('Manager', 'KPI (บันทึก)',           true),
  ('Manager', 'TAT (นำเข้า)',           true),
  ('Manager', 'User Management',        false),
  -- Medical Technologist
  ('Medical Technologist', 'รายการตรวจ (อ่าน)',      true),
  ('Medical Technologist', 'รายการตรวจ (แก้ไข)',     false),
  ('Medical Technologist', 'เอกสารคุณภาพ',           false),
  ('Medical Technologist', 'ข่าวสาร',                false),
  ('Medical Technologist', 'ความเสี่ยง / Rejection', false),
  ('Medical Technologist', 'สัญญา',                  false),
  ('Medical Technologist', 'Workload (บันทึก)',       true),
  ('Medical Technologist', 'KPI (บันทึก)',           false),
  ('Medical Technologist', 'TAT (นำเข้า)',           false),
  ('Medical Technologist', 'User Management',        false),
  -- Assistant
  ('Assistant', 'รายการตรวจ (อ่าน)',      true),
  ('Assistant', 'รายการตรวจ (แก้ไข)',     false),
  ('Assistant', 'เอกสารคุณภาพ',           false),
  ('Assistant', 'ข่าวสาร',                false),
  ('Assistant', 'ความเสี่ยง / Rejection', false),
  ('Assistant', 'สัญญา',                  false),
  ('Assistant', 'Workload (บันทึก)',       false),
  ('Assistant', 'KPI (บันทึก)',           false),
  ('Assistant', 'TAT (นำเข้า)',           false),
  ('Assistant', 'User Management',        false)
on conflict (role, resource) do nothing;
