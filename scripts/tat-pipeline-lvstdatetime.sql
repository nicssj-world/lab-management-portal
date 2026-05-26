-- TAT pipeline update:
-- 1) registration: lvstdatetime from TAT file
-- 2) queue confirmed: confdatee from phlebotomy file
-- 3) draw completed: attaindatee from phlebotomy file
-- Run once in Supabase SQL Editor before importing new TAT/phlebotomy files.

alter table phlebotomy_records add column if not exists queue_confirmed_at timestamptz;
alter table phlebotomy_records add column if not exists draw_minutes numeric;

update phlebotomy_records
set queue_confirmed_at = coalesce(queue_confirmed_at, register_at),
    draw_minutes = coalesce(draw_minutes, wait_minutes)
where queue_confirmed_at is null or draw_minutes is null;

create index if not exists idx_phleb_records_year_month_queue_confirmed_at
  on phlebotomy_records (year, month, queue_confirmed_at);

alter table tat_records add column if not exists register_at timestamptz;
alter table tat_records add column if not exists queue_confirmed_at timestamptz;
alter table tat_records add column if not exists phleb_draw_minutes numeric;

create index if not exists idx_tat_records_year_month_queue_confirmed_at
  on tat_records (year, month, queue_confirmed_at);
