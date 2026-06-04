-- Lab Workload heatmap patch
-- Run via Supabase Dashboard -> SQL Editor.
--
-- Why this exists:
--   The workload summary tables may already exist, while the heatmap tables are
--   still missing from PostgREST's schema cache. This patch creates only the
--   heatmap tables/functions and reloads the API schema.
--
-- After running the patch, refresh the month shown on the dashboard, for example:
--   select refresh_lab_workload_heatmap_month(2026, 4);
--   notify pgrst, 'reload schema';
--
-- Then verify:
--   select count(*) as tat_heatmap_cells
--   from lab_workload_heatmap_monthly
--   where year = 2026 and month = 4;
--
--   select count(*) as phleb_heatmap_cells
--   from lab_workload_phleb_heatmap_monthly
--   where year = 2026 and month = 4;

create table if not exists lab_workload_heatmap_monthly (
  fiscal_year int not null,
  year int not null,
  month int not null,
  dow int not null,
  hour int not null,
  count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (fiscal_year, year, month, dow, hour)
);

create table if not exists lab_workload_phleb_heatmap_monthly (
  fiscal_year int not null,
  year int not null,
  month int not null,
  dow int not null,
  hour int not null,
  count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (fiscal_year, year, month, dow, hour)
);

create index if not exists idx_lw_heatmap_monthly_year_month
  on lab_workload_heatmap_monthly (year, month);

create index if not exists idx_lw_phleb_heatmap_monthly_year_month
  on lab_workload_phleb_heatmap_monthly (year, month);

create or replace function workload_fiscal_year(p_year int, p_month int)
returns int
language sql
immutable
as $$
  select case when p_month >= 10 then p_year + 1 else p_year end
$$;

create or replace function workload_normalize_labzone(p_labzone text)
returns text
language sql
immutable
as $$
  select case
    when p_labzone in ('ช่อง 10', 'ช่อง 11') then 'ช่องรถนั่ง-นอน'
    else p_labzone
  end
$$;

create or replace function refresh_lab_workload_heatmap_month(p_year int, p_month int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := case when p_year > 2400 then p_year - 543 else p_year end;
  v_fiscal_year int := workload_fiscal_year(case when p_year > 2400 then p_year - 543 else p_year end, p_month);
begin
  delete from lab_workload_heatmap_monthly
  where fiscal_year = v_fiscal_year
    and year = v_year
    and month = p_month;

  delete from lab_workload_phleb_heatmap_monthly
  where fiscal_year = v_fiscal_year
    and year = v_year
    and month = p_month;

  insert into lab_workload_heatmap_monthly (
    fiscal_year, year, month, dow, hour, count, updated_at
  )
  select
    v_fiscal_year,
    v_year,
    p_month,
    spcm_dow,
    spcm_hour,
    count(distinct nullif(ln, ''))::int,
    now()
  from tat_records
  where year = v_year
    and month = p_month
    and spcm_dow is not null
    and spcm_hour is not null
  group by spcm_dow, spcm_hour;

  insert into lab_workload_phleb_heatmap_monthly (
    fiscal_year, year, month, dow, hour, count, updated_at
  )
  select
    v_fiscal_year,
    v_year,
    p_month,
    extract(dow from register_at)::int,
    extract(hour from register_at)::int,
    count(distinct nullif(trim(hn), ''))::int,
    now()
  from phlebotomy_records
  where year = v_year
    and month = p_month
    and register_at is not null
    and workload_normalize_labzone(labzone_name) in (
      'ห้องปฏิบัติการ ชั้น G',
      'ห้องปฏิบัติการ เมือง',
      'ห้องปฏิบัติการ นอกรพ.Central',
      'ห้องปฏิบัติการ สูติ-นรีเวชกรรม',
      'ห้องเจาะเลือด ชั้น 3',
      'ช่องรถนั่ง-นอน'
    )
  group by extract(dow from register_at)::int, extract(hour from register_at)::int;
end $$;

notify pgrst, 'reload schema';
