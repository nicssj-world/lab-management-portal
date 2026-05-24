-- Phlebotomy Stage Extension for TAT Module
-- Run via Supabase Dashboard → SQL Editor

-- ===== Phlebotomy upload + records =====
create table if not exists phleb_uploads (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  month int not null,
  uploaded_by uuid references profiles(id),
  uploaded_at timestamptz default now(),
  row_count int not null default 0,
  file_name text not null,
  constraint phleb_uploads_year_month_unique unique (year, month)
);

create table if not exists phlebotomy_records (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid references phleb_uploads(id) on delete cascade,
  year int not null,
  month int not null,
  hn text not null,
  register_at timestamptz,       -- confdatee (ลงทะเบียน/ยืนยันคิว)
  phleb_done_at timestamptz,     -- attaindatee (เจาะเลือดสำเร็จ)
  wait_minutes numeric,          -- phleb_done_at − register_at
  labzone_name text,             -- หน่วยเจาะเลือด
  phlebotomist text,             -- sucessstf (คนเจาะ)
  phleb_date date                -- DATE(register_at) — index สำหรับ join
);

create index if not exists idx_phleb_records_hn_date on phlebotomy_records (hn, phleb_date);
create index if not exists idx_phleb_records_year_month on phlebotomy_records (year, month);
create index if not exists idx_phleb_records_upload_id on phlebotomy_records (upload_id);

-- ===== ขยาย tat_records เดิม =====
alter table tat_records add column if not exists hn text;
alter table tat_records add column if not exists is_blood_draw bool;
alter table tat_records add column if not exists register_at timestamptz;
alter table tat_records add column if not exists phleb_done_at timestamptz;
alter table tat_records add column if not exists phleb_wait_minutes numeric;
alter table tat_records add column if not exists transport_minutes numeric;
alter table tat_records add column if not exists total_tat_minutes numeric;
alter table tat_records add column if not exists labzone_name text;
alter table tat_records add column if not exists phlebotomist text;
alter table tat_records add column if not exists match_confidence text;  -- exact|ambiguous|no_match

create index if not exists idx_tat_records_hn on tat_records (hn);

-- RLS for new tables (read = authenticated, write = via service role only)
alter table phleb_uploads enable row level security;
alter table phlebotomy_records enable row level security;

drop policy if exists "phleb_uploads_read" on phleb_uploads;
create policy "phleb_uploads_read" on phleb_uploads for select using (auth.role() = 'authenticated');

drop policy if exists "phleb_records_read" on phlebotomy_records;
create policy "phleb_records_read" on phlebotomy_records for select using (auth.role() = 'authenticated');
