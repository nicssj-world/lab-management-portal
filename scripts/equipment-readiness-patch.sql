-- Equipment module readiness patch
-- Run via Supabase Dashboard -> SQL Editor before first production use.
-- Safe to re-run.

alter table equipment
  add column if not exists updated_at timestamptz default now(),
  add column if not exists cbh_code_pending boolean not null default false,
  add column if not exists hospital_asset_no_pending boolean not null default false,
  add column if not exists purpose text default null,
  add column if not exists photo_url text default null,
  add column if not exists method_validation_url text default null,
  add column if not exists method_correlation_url text default null,
  add column if not exists manual_url text default null,
  add column if not exists responsible_user_id uuid references profiles(id) on delete set null,
  add column if not exists pm_cal_data jsonb default null;

update equipment
set updated_at = created_at
where updated_at is null;

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists equipment_set_updated_at on equipment;
create trigger equipment_set_updated_at
  before update on equipment
  for each row execute function set_updated_at();

update equipment
set needs_calibration = false
where status = 'Inactive'
  and needs_calibration = true;

create table if not exists calibration_plans (
  id          uuid        default gen_random_uuid() primary key,
  group_name  text        not null,
  name        text        not null,
  plan        integer     not null default 0,
  actual      integer,
  price       integer,
  budget      integer     not null default 0,
  sort_order  integer     not null default 0,
  created_at  timestamptz default now(),
  created_by  uuid,
  updated_at  timestamptz default now()
);

create table if not exists equipment_editors (
  user_id    uuid primary key references profiles(id) on delete cascade,
  updated_by uuid references profiles(id),
  updated_at timestamptz default now()
);

alter table equipment_editors enable row level security;

delete from role_permissions
where role in ('Manager', 'Medical Technologist', 'Medical Science Technician', 'Assistant')
  and resource in (
    'ทะเบียนเครื่องมือ',
    'ทะเบียนเครื่องมือ:none',
    'ทะเบียนเครื่องมือ:view',
    'ทะเบียนเครื่องมือ:edit'
  );

insert into role_permissions (role, resource, granted) values
  ('Manager', 'ทะเบียนเครื่องมือ:edit', true),
  ('Medical Technologist', 'ทะเบียนเครื่องมือ:view', true),
  ('Medical Science Technician', 'ทะเบียนเครื่องมือ:view', true),
  ('Assistant', 'ทะเบียนเครื่องมือ:view', true);

notify pgrst, 'reload schema';
