-- Lab Workload precomputed summary tables
-- Run via Supabase Dashboard -> SQL Editor
--
-- After uploading/rejoining TAT + Phlebotomy data, run the month you need:
--   select refresh_lab_workload_summary_month(2569, 4);
-- or with Gregorian fiscal year:
--   select refresh_lab_workload_summary_month(2026, 4);

create table if not exists lab_workload_department_monthly (
  fiscal_year int not null,
  year int not null,
  month int not null,
  lab_section text not null,
  ln_count int not null default 0,
  test_rows int not null default 0,
  test_count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (fiscal_year, year, month, lab_section)
);

create table if not exists lab_workload_overall_monthly (
  fiscal_year int not null,
  year int not null,
  month int not null,
  ln_count int not null default 0,
  test_rows int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (fiscal_year, year, month)
);

create table if not exists lab_workload_test_monthly (
  fiscal_year int not null,
  year int not null,
  month int not null,
  lab_section text not null,
  test_name text not null,
  code text,
  price numeric,
  ln_count int not null default 0,
  in_time_ln_count int not null default 0,
  test_rows int not null default 0,
  in_time_test_rows int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (fiscal_year, year, month, lab_section, test_name)
);

create table if not exists lab_workload_phleb_monthly (
  fiscal_year int not null,
  year int not null,
  month int not null,
  labzone_name text not null,
  service_count int not null default 0,
  hn_count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (fiscal_year, year, month, labzone_name)
);

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

create index if not exists idx_lw_dept_monthly_fy_month on lab_workload_department_monthly (fiscal_year, month);
create index if not exists idx_lw_overall_monthly_fy_month on lab_workload_overall_monthly (fiscal_year, month);
create index if not exists idx_lw_test_monthly_fy_section on lab_workload_test_monthly (fiscal_year, lab_section);
create index if not exists idx_lw_phleb_monthly_fy_month on lab_workload_phleb_monthly (fiscal_year, month);
create index if not exists idx_lw_heatmap_monthly_year_month on lab_workload_heatmap_monthly (year, month);
create index if not exists idx_lw_phleb_heatmap_monthly_year_month on lab_workload_phleb_heatmap_monthly (year, month);

create or replace function workload_fiscal_year(p_year int, p_month int)
returns int language sql immutable as $$
  select case when p_month >= 10 then p_year + 1 else p_year end
$$;

create or replace function workload_normalize_section(p_section text)
returns text language sql immutable as $$
  select case
    when coalesce(nullif(trim(p_section), ''), 'ไม่ระบุ') = 'ธนาคารเลือดหมวด 6' then 'ธนาคารเลือด'
    when coalesce(nullif(trim(p_section), ''), 'ไม่ระบุ') = 'อาชีวอนามัย' then 'เคมีคลินิก'
    else coalesce(nullif(trim(p_section), ''), 'ไม่ระบุ')
  end
$$;

create or replace function workload_effective_section(
  p_section text,
  p_ward text,
  p_name_1 text,
  p_test_name text
)
returns text language sql immutable as $$
  select case
    when lower(coalesce(p_ward, '')) like '%ศสม%'
      or lower(coalesce(p_ward, '')) like '%รพ.เมือง%'
      or lower(coalesce(p_ward, '')) like '%รพ เมือง%'
      or lower(coalesce(p_ward, '')) like '%green chanel%'
      or lower(coalesce(p_name_1, '')) like '%ศสม%'
      or lower(coalesce(p_test_name, '')) like '%ศสม%'
    then 'ศสม.'
    else workload_normalize_section(p_section)
  end
$$;

create or replace function workload_normalize_labzone(p_labzone text)
returns text language sql immutable as $$
  select case
    when p_labzone in ('ช่อง 10', 'ช่อง 11') then 'ช่องรถนั่ง-นอน'
    else p_labzone
  end
$$;

create or replace function refresh_lab_workload_summary(p_fiscal_year int)
returns void language plpgsql security definer as $$
declare
  v_fiscal_year int := case when p_fiscal_year > 2400 then p_fiscal_year - 543 else p_fiscal_year end;
begin
  delete from lab_workload_department_monthly where fiscal_year = v_fiscal_year;
  delete from lab_workload_overall_monthly where fiscal_year = v_fiscal_year;
  delete from lab_workload_test_monthly where fiscal_year = v_fiscal_year;
  delete from lab_workload_phleb_monthly where fiscal_year = v_fiscal_year;
  delete from lab_workload_heatmap_monthly where fiscal_year = v_fiscal_year;
  delete from lab_workload_phleb_heatmap_monthly where fiscal_year = v_fiscal_year;

  insert into lab_workload_overall_monthly (
    fiscal_year, year, month, ln_count, test_rows, updated_at
  )
  select
    workload_fiscal_year(year, month) as fiscal_year,
    year,
    month,
    count(distinct nullif(ln, ''))::int as ln_count,
    count(*)::int as test_rows,
    now()
  from tat_records
  where workload_fiscal_year(year, month) = v_fiscal_year
  group by year, month;

  insert into lab_workload_department_monthly (
    fiscal_year, year, month, lab_section, ln_count, test_rows, test_count, updated_at
  )
  select
    workload_fiscal_year(year, month) as fiscal_year,
    year,
    month,
    workload_effective_section(lab_section, ward, name_1, test_name) as lab_section,
    count(distinct nullif(ln, ''))::int as ln_count,
    count(*)::int as test_rows,
    count(distinct nullif(test_name, ''))::int as test_count,
    now()
  from tat_records
  where workload_fiscal_year(year, month) = v_fiscal_year
  group by year, month, workload_effective_section(lab_section, ward, name_1, test_name);

  insert into lab_workload_test_monthly (
    fiscal_year, year, month, lab_section, test_name, code, price,
    ln_count, in_time_ln_count, test_rows, in_time_test_rows, updated_at
  )
  select
    workload_fiscal_year(r.year, r.month) as fiscal_year,
    r.year,
    r.month,
    workload_effective_section(r.lab_section, r.ward, r.name_1, r.test_name) as lab_section,
    coalesce(nullif(trim(r.test_name), ''), 'ไม่ระบุ') as test_name,
    max(coalesce(t.code, t.lis_code)) as code,
    max(t.price) as price,
    count(distinct nullif(r.ln, ''))::int as ln_count,
    count(distinct nullif(r.ln, '')) filter (where r.within_target = true)::int as in_time_ln_count,
    count(*)::int as test_rows,
    count(*) filter (where r.within_target = true)::int as in_time_test_rows,
    now()
  from tat_records r
  left join tests t
    on trim(r.test_name) in (trim(t.th), trim(coalesce(t.en, '')), trim(t.code), trim(coalesce(t.lis_code, '')))
  where workload_fiscal_year(r.year, r.month) = v_fiscal_year
  group by r.year, r.month, workload_effective_section(r.lab_section, r.ward, r.name_1, r.test_name), coalesce(nullif(trim(r.test_name), ''), 'ไม่ระบุ');

  insert into lab_workload_phleb_monthly (
    fiscal_year, year, month, labzone_name, service_count, hn_count, updated_at
  )
  select
    workload_fiscal_year(year, month) as fiscal_year,
    year,
    month,
    workload_normalize_labzone(labzone_name) as labzone_name,
    count(*)::int as service_count,
    count(distinct nullif(trim(hn), ''))::int as hn_count,
    now()
  from phlebotomy_records
  where workload_fiscal_year(year, month) = v_fiscal_year
    and workload_normalize_labzone(labzone_name) in (
      'ห้องปฏิบัติการ ชั้น G',
      'ห้องปฏิบัติการ เมือง',
      'ห้องปฏิบัติการ นอกรพ.Central',
      'ห้องปฏิบัติการ สูติ-นรีเวชกรรม',
      'ห้องเจาะเลือด ชั้น 3',
      'ช่องรถนั่ง-นอน'
    )
  group by year, month, workload_normalize_labzone(labzone_name);

  insert into lab_workload_heatmap_monthly (
    fiscal_year, year, month, dow, hour, count, updated_at
  )
  select
    workload_fiscal_year(year, month),
    year,
    month,
    spcm_dow,
    spcm_hour,
    count(distinct nullif(ln, ''))::int,
    now()
  from tat_records
  where workload_fiscal_year(year, month) = v_fiscal_year
    and spcm_dow is not null
    and spcm_hour is not null
  group by year, month, spcm_dow, spcm_hour;

  insert into lab_workload_phleb_heatmap_monthly (
    fiscal_year, year, month, dow, hour, count, updated_at
  )
  select
    workload_fiscal_year(year, month),
    year,
    month,
    extract(dow from register_at)::int,
    extract(hour from register_at)::int,
    count(distinct nullif(trim(hn), ''))::int,
    now()
  from phlebotomy_records
  where workload_fiscal_year(year, month) = v_fiscal_year
    and register_at is not null
    and workload_normalize_labzone(labzone_name) in (
      'ห้องปฏิบัติการ ชั้น G',
      'ห้องปฏิบัติการ เมือง',
      'ห้องปฏิบัติการ นอกรพ.Central',
      'ห้องปฏิบัติการ สูติ-นรีเวชกรรม',
      'ห้องเจาะเลือด ชั้น 3',
      'ช่องรถนั่ง-นอน'
    )
  group by year, month, extract(dow from register_at)::int, extract(hour from register_at)::int;
end $$;

create or replace function refresh_lab_workload_summary_month(p_year int, p_month int)
returns void language plpgsql security definer as $$
declare
  v_year int := case when p_year > 2400 then p_year - 543 else p_year end;
  v_fiscal_year int := workload_fiscal_year(case when p_year > 2400 then p_year - 543 else p_year end, p_month);
begin
  delete from lab_workload_department_monthly
  where fiscal_year = v_fiscal_year and year = v_year and month = p_month;

  delete from lab_workload_overall_monthly
  where fiscal_year = v_fiscal_year and year = v_year and month = p_month;

  delete from lab_workload_test_monthly
  where fiscal_year = v_fiscal_year and year = v_year and month = p_month;

  delete from lab_workload_phleb_monthly
  where fiscal_year = v_fiscal_year and year = v_year and month = p_month;

  delete from lab_workload_heatmap_monthly
  where fiscal_year = v_fiscal_year and year = v_year and month = p_month;

  delete from lab_workload_phleb_heatmap_monthly
  where fiscal_year = v_fiscal_year and year = v_year and month = p_month;

  insert into lab_workload_overall_monthly (
    fiscal_year, year, month, ln_count, test_rows, updated_at
  )
  select
    v_fiscal_year,
    v_year,
    p_month,
    count(distinct nullif(ln, ''))::int,
    count(*)::int,
    now()
  from tat_records
  where year = v_year and month = p_month;

  insert into lab_workload_department_monthly (
    fiscal_year, year, month, lab_section, ln_count, test_rows, test_count, updated_at
  )
  select
    v_fiscal_year,
    v_year,
    p_month,
    workload_effective_section(lab_section, ward, name_1, test_name),
    count(distinct nullif(ln, ''))::int,
    count(*)::int,
    count(distinct nullif(test_name, ''))::int,
    now()
  from tat_records
  where year = v_year and month = p_month
  group by workload_effective_section(lab_section, ward, name_1, test_name);

  insert into lab_workload_test_monthly (
    fiscal_year, year, month, lab_section, test_name, code, price,
    ln_count, in_time_ln_count, test_rows, in_time_test_rows, updated_at
  )
  with test_catalog as (
    select distinct on (key)
      key,
      code,
      price
    from (
      select nullif(trim(th), '') as key, coalesce(code, lis_code) as code, price from tests
      union all
      select nullif(trim(en), '') as key, coalesce(code, lis_code) as code, price from tests
      union all
      select nullif(trim(code), '') as key, coalesce(code, lis_code) as code, price from tests
      union all
      select nullif(trim(lis_code), '') as key, coalesce(code, lis_code) as code, price from tests
    ) x
    where key is not null
    order by key, code nulls last
  )
  select
    v_fiscal_year,
    v_year,
    p_month,
    workload_effective_section(r.lab_section, r.ward, r.name_1, r.test_name),
    coalesce(nullif(trim(r.test_name), ''), 'ไม่ระบุ'),
    max(t.code),
    max(t.price),
    count(distinct nullif(r.ln, ''))::int,
    count(distinct nullif(r.ln, '')) filter (where r.within_target = true)::int,
    count(*)::int,
    count(*) filter (where r.within_target = true)::int,
    now()
  from tat_records r
  left join test_catalog t on t.key = trim(r.test_name)
  where r.year = v_year and r.month = p_month
  group by workload_effective_section(r.lab_section, r.ward, r.name_1, r.test_name), coalesce(nullif(trim(r.test_name), ''), 'ไม่ระบุ');

  insert into lab_workload_phleb_monthly (
    fiscal_year, year, month, labzone_name, service_count, hn_count, updated_at
  )
  select
    v_fiscal_year,
    v_year,
    p_month,
    workload_normalize_labzone(labzone_name),
    count(*)::int,
    count(distinct nullif(trim(hn), ''))::int,
    now()
  from phlebotomy_records
  where year = v_year
    and month = p_month
    and workload_normalize_labzone(labzone_name) in (
      'ห้องปฏิบัติการ ชั้น G',
      'ห้องปฏิบัติการ เมือง',
      'ห้องปฏิบัติการ นอกรพ.Central',
      'ห้องปฏิบัติการ สูติ-นรีเวชกรรม',
      'ห้องเจาะเลือด ชั้น 3',
      'ช่องรถนั่ง-นอน'
    )
  group by workload_normalize_labzone(labzone_name);

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
