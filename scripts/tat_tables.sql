-- TAT Module tables
-- Run via Supabase Dashboard → SQL Editor

create table tat_uploads (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  month int not null,
  uploaded_by uuid references profiles(id),
  uploaded_at timestamptz default now(),
  row_count int not null default 0,
  file_name text not null,
  constraint tat_uploads_year_month_unique unique (year, month)
);

create table tat_records (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid references tat_uploads(id) on delete cascade,
  year int not null,
  month int not null,
  ln text,
  spcm_at timestamptz,
  rslt_at timestamptz,
  tat_minutes numeric,
  target_minutes numeric,
  within_target bool,
  lab_section text,
  ward text,
  priority text,
  test_name text,
  spcm_hour int,
  spcm_dow int
);

create index if not exists idx_tat_records_year_month on tat_records (year, month);
create index if not exists idx_tat_records_upload_id on tat_records (upload_id);
create index if not exists idx_tat_records_lab_section on tat_records (lab_section);
create index if not exists idx_tat_records_year_month_lab_section on tat_records (year, month, lab_section);
create index if not exists idx_tat_records_year_month_ward on tat_records (year, month, ward);
create index if not exists idx_tat_records_year_month_priority on tat_records (year, month, priority);
create index if not exists idx_tat_records_year_month_test_name on tat_records (year, month, test_name);
create index if not exists idx_tat_records_year_month_spcm_hour on tat_records (year, month, spcm_hour);
