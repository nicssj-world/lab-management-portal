-- TAT Summary function — all aggregation in PostgreSQL, bypasses PostgREST row limit
-- Run via Supabase Dashboard → SQL Editor

create or replace function get_tat_summary(
  p_year        int,
  p_month       int,
  p_lab_section text default null,
  p_ward        text default null,
  p_priority    text default null,
  p_test_name   text default null,
  p_labzone     text default null
) returns jsonb language sql stable security definer as $$
  with
  -- ── filtered base for the selected month ──────────────────────────────────
  base as (
    select *
    from tat_records
    where year  = p_year
      and month = p_month
      and (p_lab_section is null or lab_section = p_lab_section)
      and (p_ward        is null or ward        = p_ward)
      and (p_priority    is null or priority    = p_priority)
      and (p_test_name   is null or test_name   = p_test_name)
      and (p_labzone     is null or labzone_name = p_labzone)
  ),
  -- ── base without labzone filter — match rate denominator must include unmatched
  -- records (which have labzone_name = null and would be excluded if p_labzone set)
  base_match as (
    select match_confidence
    from tat_records
    where year  = p_year
      and month = p_month
      and (p_lab_section is null or lab_section = p_lab_section)
      and (p_ward        is null or ward        = p_ward)
      and (p_priority    is null or priority    = p_priority)
      and (p_test_name   is null or test_name   = p_test_name)
  ),
  -- ── single-pass core KPIs ─────────────────────────────────────────────────
  core as (
    select
      count(*)::int                                                                as total_count,
      count(distinct nullif(ln, ''))::int                                         as sample_count,
      coalesce(round(avg(tat_minutes)::numeric, 1), 0)                            as avg_tat,
      coalesce(round(
        percentile_cont(0.5) within group (order by tat_minutes)::numeric, 1), 0) as median_tat,
      coalesce(round(
        100.0 * count(*) filter (where within_target = true)::numeric /
        nullif(count(*) filter (where within_target is not null), 0)
      , 1), 0)                                                                    as pct_within_target,
      -- phlebotomy KPIs (0 when no phleb data)
      coalesce(round(avg(phleb_wait_minutes) filter (
        where is_blood_draw = true
          and match_confidence not in ('no_match')
          and phleb_wait_minutes is not null
      )::numeric, 1), 0)                                                          as avg_phleb_wait,
      coalesce(round(avg(transport_minutes) filter (
        where match_confidence not in ('no_match')
          and transport_minutes is not null
      )::numeric, 1), 0)                                                          as avg_transport,
      coalesce(round(avg(total_tat_minutes) filter (
        where is_blood_draw = true
          and match_confidence not in ('no_match')
          and total_tat_minutes is not null
      )::numeric, 1), 0)                                                          as avg_total_tat,
      coalesce(round(
        percentile_cont(0.5) within group (order by total_tat_minutes) filter (
          where is_blood_draw = true
            and match_confidence not in ('no_match')
            and total_tat_minutes is not null
        )::numeric, 1), 0)                                                        as median_total_tat,
      coalesce(round(
        100.0 * count(*) filter (
          where is_blood_draw = true
            and match_confidence not in ('no_match')
            and total_tat_minutes <= 120
        )::numeric /
        nullif(count(*) filter (
          where is_blood_draw = true
            and match_confidence not in ('no_match')
            and total_tat_minutes is not null
        ), 0)
      , 1), 0)                                                                    as pct_total_within_target,
      coalesce(round(
        100.0 * count(*) filter (where is_blood_draw = true and phleb_wait_minutes <= 30)::numeric /
        nullif(count(*) filter (where is_blood_draw = true and phleb_wait_minutes is not null), 0)
      , 1), 0)                                                                    as pct_phleb_within_target,
      -- match rate uses base_match (no labzone filter) — unmatched records have
      -- labzone_name = null and would vanish from base when p_labzone is set,
      -- producing a spurious 100% rate
      (select coalesce(round(
        100.0 * count(*) filter (where match_confidence not in ('no_match'))::numeric /
        nullif(count(*), 0)
      , 1), 0) from base_match)                                                   as phleb_match_rate,
      count(*) filter (where hn is null or hn = '')::int                         as hn_null_count,
      (select count(*) filter (where match_confidence = 'exact')::int
       from base_match)                                                           as exact_count,
      (select count(*) filter (where match_confidence = 'ambiguous')::int
       from base_match)                                                           as ambiguous_count,
      (select count(*) filter (
        where match_confidence is null or match_confidence = 'no_match'
      )::int from base_match)                                                     as no_match_count
    from base
  ),
  -- ── busiest hour ──────────────────────────────────────────────────────────
  busiest as (
    select spcm_hour
    from base
    where spcm_hour is not null
    group by spcm_hour
    order by count(*) desc
    limit 1
  ),
  -- ── by lab section ────────────────────────────────────────────────────────
  by_section as (
    select
      coalesce(lab_section, 'ไม่ระบุ')          as lab_section,
      round(avg(tat_minutes)::numeric, 1)       as avg_tat,
      count(distinct nullif(ln, ''))::int       as count
    from base
    group by lab_section
    order by avg(tat_minutes) desc
  ),
  -- ── by labzone ────────────────────────────────────────────────────────────
  by_labzone as (
    select
      labzone_name,
      count(distinct nullif(ln, ''))::int                                    as count,
      coalesce(round(avg(phleb_wait_minutes) filter (
        where is_blood_draw = true and phleb_wait_minutes is not null
      )::numeric, 1), 0)                                                    as avg_wait
    from base
    where labzone_name is not null
    group by labzone_name
    order by count(*) desc
  ),
  -- ── TAT distribution (6 bins) ─────────────────────────────────────────────
  dist_raw as (
    select
      case
        when tat_minutes < 30  then 0
        when tat_minutes < 60  then 1
        when tat_minutes < 120 then 2
        when tat_minutes < 240 then 3
        when tat_minutes < 480 then 4
        else                        5
      end as bin_idx,
      count(*)::int as count
    from base
    group by bin_idx
  ),
  dist as (
    select
      bin_idx,
      case bin_idx
        when 0 then '<30นาที'
        when 1 then '30–60นาที'
        when 2 then '1–2ชม.'
        when 3 then '2–4ชม.'
        when 4 then '4–8ชม.'
        else        '>8ชม.'
      end as bin,
      coalesce(dr.count, 0) as count
    from generate_series(0, 5) as bin_idx
    left join dist_raw dr using (bin_idx)
    order by bin_idx
  ),
  -- ── TAT distribution with cumulative pct (pre-computed, 2 steps) ─────────
  dist_running as (
    select bin_idx, bin, count,
      sum(count) over (order by bin_idx rows unbounded preceding) as running_sum
    from dist
  ),
  dist_cum as (
    select dr.bin_idx, dr.bin, dr.count,
      round(100.0 * dr.running_sum::numeric / nullif(c.total_count, 0), 1) as cumulative_pct
    from dist_running dr
    cross join core c
  ),
  -- ── heatmap (spcm_at — specimen received at lab) ─────────────────────────
  hmap as (
    select spcm_dow as dow, spcm_hour as hour, count(*)::int as count
    from base
    where spcm_dow is not null and spcm_hour is not null
    group by spcm_dow, spcm_hour
  ),
  -- ── phlebotomy heatmap (all registrations, not just matched) ────────────
  -- Timestamps stored as Bangkok local time in UTC slot (parser bug, both files
  -- share the same offset so matching still works) — extract raw hour/dow, no TZ shift.
  phleb_hmap as (
    select
      extract(dow  from register_at)::int                as dow,
      extract(hour from register_at)::int                as hour,
      count(distinct nullif(hn, ''))::int                as count
    from phlebotomy_records
    where year  = p_year
      and month = p_month
      and (p_labzone is null or labzone_name = p_labzone)
      and register_at is not null
    group by dow, hour
  ),
  -- ── 12-month rolling trend ────────────────────────────────────────────────
  trend_months as (
    select
      extract(year  from gs)::int as yr,
      extract(month from gs)::int as mo
    from generate_series(
      (make_date(p_year, p_month, 1) - interval '11 months')::date,
      make_date(p_year, p_month, 1),
      interval '1 month'
    ) gs
  ),
  trend_agg as (
    select
      t.yr, t.mo,
      coalesce(round(avg(r.tat_minutes)::numeric, 1), 0) as avg_tat,
      coalesce(round(
        100.0 * count(r.id) filter (where r.within_target = true)::numeric /
        nullif(count(r.id) filter (where r.within_target is not null), 0)
      , 1), 0) as pct_within_target
    from trend_months t
    left join tat_records r on r.year = t.yr and r.month = t.mo
    group by t.yr, t.mo
    order by t.yr, t.mo
  ),
  -- ── phlebotomy KPIs from ALL visits (not just matched) ──────────────────
  -- Must query phlebotomy_records directly; tat_records.phleb_wait_minutes is
  -- only populated for matched records, causing a spuriously high pass rate.
  phleb_core as (
    select
      coalesce(round(avg(wait_minutes)::numeric, 1), 0)        as avg_phleb_wait,
      coalesce(round(
        100.0 * count(*) filter (where wait_minutes <= 30)::numeric /
        nullif(count(*), 0)
      , 1), 0)                                                  as pct_phleb_within_target
    from phlebotomy_records
    where year  = p_year
      and month = p_month
      and (p_labzone is null or labzone_name = p_labzone)
  ),
  -- ── by labzone from phlebotomy_records (all visits, not just matched) ───────
  by_labzone_phleb as (
    select
      labzone_name,
      count(distinct nullif(hn, ''))::int as count
    from phlebotomy_records
    where year  = p_year
      and month = p_month
      and (p_labzone is null or labzone_name = p_labzone)
      and labzone_name is not null
    group by labzone_name
    order by count(distinct nullif(hn, '')) desc
  ),
  -- ── distinct filter options ───────────────────────────────────────────────
  opts as (
    select
      array_remove(array_agg(distinct lab_section  order by lab_section),  null) as lab_sections,
      array_remove(array_agg(distinct ward          order by ward),          null) as wards,
      array_remove(array_agg(distinct test_name     order by test_name),     null) as test_names,
      array_remove(array_agg(distinct labzone_name  order by labzone_name),  null) as labzone_names
    from base
  ),
  -- ── labzone names from phlebotomy_records (for Tab 2 dropdown) ───────────
  phleb_labzone_opts as (
    select coalesce(
      array_remove(array_agg(distinct labzone_name order by labzone_name), null),
      '{}'::text[]
    ) as phleb_labzone_names
    from phlebotomy_records
    where year = p_year and month = p_month and labzone_name is not null
  )
  -- ── assemble JSON ─────────────────────────────────────────────────────────
  select jsonb_build_object(
    'kpi', jsonb_build_object(
      'total_count',       c.total_count,
      'sample_count',      c.sample_count,
      'avg_tat',           c.avg_tat,
      'median_tat',        c.median_tat,
      'pct_within_target', c.pct_within_target,
      'busiest_hour',      lpad(coalesce(b.spcm_hour, 0)::text, 2, '0')
                           || ':00–'
                           || lpad((coalesce(b.spcm_hour, 0) + 1)::text, 2, '0')
                           || ':00',
      'avg_phleb_wait',    pc.avg_phleb_wait,
      'avg_transport',     c.avg_transport,
      'avg_total_tat',           c.avg_total_tat,
      'median_total_tat',        c.median_total_tat,
      'phleb_match_rate',        c.phleb_match_rate,
      'pct_total_within_target', c.pct_total_within_target,
      'pct_phleb_within_target', pc.pct_phleb_within_target
    ),
    'hn_null_count',    c.hn_null_count,
    'match_breakdown',  jsonb_build_object(
      'exact',     c.exact_count,
      'ambiguous', c.ambiguous_count,
      'no_match',  c.no_match_count
    ),
    'stage_breakdown', jsonb_build_array(
      jsonb_build_object('stage', 'รอเจาะเลือด',   'avg_minutes', c.avg_phleb_wait),
      jsonb_build_object('stage', 'ขนส่งตัวอย่าง', 'avg_minutes', c.avg_transport),
      jsonb_build_object('stage', 'วิเคราะห์ในแลป','avg_minutes', c.avg_tat)
    ),
    'by_lab_section',  coalesce(
      (select jsonb_agg(jsonb_build_object(
          'lab_section', lab_section, 'avg_tat', avg_tat, 'count', count
       )) from by_section), '[]'::jsonb),
    'by_labzone',      coalesce(
      (select jsonb_agg(jsonb_build_object(
          'labzone_name', labzone_name, 'count', count, 'avg_wait', avg_wait
       )) from by_labzone), '[]'::jsonb),
    'by_labzone_phleb', coalesce(
      (select jsonb_agg(jsonb_build_object(
          'labzone_name', labzone_name, 'count', count
       )) from by_labzone_phleb), '[]'::jsonb),
    'tat_distribution', (
      select jsonb_agg(jsonb_build_object(
        'bin',            bin,
        'count',          count,
        'cumulative_pct', cumulative_pct
      ) order by bin_idx)
      from dist_cum
    ),
    'heatmap',         coalesce(
      (select jsonb_agg(jsonb_build_object('dow', dow, 'hour', hour, 'count', count))
       from hmap), '[]'::jsonb),
    'phleb_heatmap',   coalesce(
      (select jsonb_agg(jsonb_build_object('dow', dow, 'hour', hour, 'count', count))
       from phleb_hmap), '[]'::jsonb),
    'trend',           coalesce(
      (select jsonb_agg(jsonb_build_object(
          'year', yr, 'month', mo,
          'avg_tat', avg_tat,
          'pct_within_target', pct_within_target
       ) order by yr, mo) from trend_agg), '[]'::jsonb),
    'filter_options',  (
      select jsonb_build_object(
        'lab_sections',        to_jsonb(o.lab_sections),
        'wards',               to_jsonb(o.wards),
        'test_names',          to_jsonb(o.test_names),
        'labzone_names',       to_jsonb(o.labzone_names),
        'phleb_labzone_names', to_jsonb(p.phleb_labzone_names)
      ) from opts o cross join phleb_labzone_opts p
    )
  )
  from core c
  left join busiest b on true
  cross join phleb_core pc
$$;
