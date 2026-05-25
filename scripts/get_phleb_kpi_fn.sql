-- Phlebotomy KPI function — distinct HN count from phlebotomy_records
-- Run via Supabase Dashboard → SQL Editor

create or replace function get_phleb_kpi(
  p_year    int,
  p_month   int,
  p_labzone text default null
) returns jsonb language sql stable security definer as $$
  select jsonb_build_object(
    'phleb_hn_count',          count(distinct nullif(trim(hn), ''))::int,
    'avg_phleb_wait',          coalesce(round(avg(wait_minutes)::numeric, 1), 0),
    'pct_phleb_within_target', coalesce(round(
      100.0 * count(*) filter (where wait_minutes <= 30)::numeric /
      nullif(count(*) filter (where wait_minutes is not null), 0)
    , 2), 0)
  )
  from phlebotomy_records
  where year  = p_year
    and month = p_month
    and (p_labzone is null or labzone_name = p_labzone)
$$;
