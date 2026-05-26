create table if not exists system_settings (
  id smallint primary key default 1 check (id = 1),
  site_name text not null,
  system_code text not null,
  org_name text not null,
  standards text not null,
  version text not null,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into system_settings (id, site_name, system_code, org_name, standards, version)
values (
  1,
  'Lab Management Portal',
  'MN-LAB-01',
  'กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี',
  'ISO 15189 · ISO 15190',
  'v1.0.0'
)
on conflict (id) do nothing;

alter table system_settings enable row level security;

drop policy if exists "system_settings_public_read" on system_settings;
create policy "system_settings_public_read"
  on system_settings for select
  using (true);
