-- Rejoin TAT + Phlebotomy data for a given year/month
-- Run via Supabase Dashboard → SQL Editor after phlebotomy_tables.sql
--
-- Requires HNs in both tables to be pre-normalized (no leading zeros).
-- Run normalize_hn.sql once if migrating existing data.

create or replace function rejoin_tat(p_year int, p_month int)
returns void language plpgsql security definer as $$
begin
  set local statement_timeout = '0';

  -- 1. Reset phleb fields for the month (idempotent)
  update tat_records set
    queue_confirmed_at = null,
    phleb_done_at      = null,
    phleb_wait_minutes = null,
    phleb_draw_minutes = null,
    transport_minutes  = null,
    total_tat_minutes  = null,
    labzone_name       = null,
    phlebotomist       = null,
    match_confidence   = 'no_match'
  where year = p_year and month = p_month;

  -- 2. Pre-load phlebotomy slice into temp table + index on (hn, phleb_done_at)
  create temp table _phleb on commit drop as
    select hn, register_at, queue_confirmed_at, phleb_done_at, wait_minutes, draw_minutes, labzone_name, phlebotomist, phleb_date
    from phlebotomy_records
    where year = p_year and month = p_month;

  create index on _phleb (hn, phleb_done_at);

  -- 3. Count duplicate visits per hn+date (ambiguous flag)
  create temp table _dupcount on commit drop as
    select hn, phleb_date, count(*) as n
    from _phleb
    group by hn, phleb_date;

  create index on _dupcount (hn, phleb_date);

  -- 4. LATERAL join: for each blood-draw TAT row, index-seek the nearest phleb record.
  --    Much faster than DISTINCT ON over a full join because the planner uses
  --    an index scan + limit 1 per TAT row instead of sorting the whole result set.
  with nearest as (
    select
      t.id              as tat_id,
      t.register_at     as tat_register_at,
      t.spcm_at,
      t.rslt_at,
      t.is_blood_draw,
      p.register_at,
      coalesce(p.queue_confirmed_at, p.register_at) as queue_confirmed_at,
      p.phleb_done_at,
      p.wait_minutes,
      p.draw_minutes,
      p.labzone_name,
      p.phlebotomist,
      p.phleb_date,
      coalesce(d.n, 1)  as dup_n
    from tat_records t
    cross join lateral (
      select register_at, queue_confirmed_at, phleb_done_at, wait_minutes, draw_minutes, labzone_name, phlebotomist, phleb_date
      from _phleb
      where hn = t.hn
        and phleb_done_at <= t.spcm_at + interval '120 minutes'
        and phleb_done_at >= t.spcm_at - interval '480 minutes'
      order by abs(extract(epoch from (t.spcm_at - phleb_done_at)))
      limit 1
    ) p
    left join _dupcount d on d.hn = t.hn and d.phleb_date = p.phleb_date
    where t.year = p_year and t.month = p_month
      and t.is_blood_draw = true
      and t.hn is not null and t.hn <> ''
  )
  update tat_records t set
    register_at        = n.tat_register_at,
    queue_confirmed_at = n.queue_confirmed_at,
    phleb_done_at      = n.phleb_done_at,
    transport_minutes  = extract(epoch from (n.spcm_at - n.phleb_done_at)) / 60.0,
    labzone_name       = n.labzone_name,
    phlebotomist       = n.phlebotomist,
    phleb_wait_minutes = case when t.is_blood_draw and n.tat_register_at is not null and n.queue_confirmed_at is not null
                              then extract(epoch from (n.queue_confirmed_at - n.tat_register_at)) / 60.0
                              else null end,
    phleb_draw_minutes = case when t.is_blood_draw then coalesce(n.draw_minutes, n.wait_minutes) else null end,
    total_tat_minutes  = case when t.is_blood_draw
                              then extract(epoch from (n.rslt_at - n.tat_register_at)) / 60.0
                              else null end,
    match_confidence   = case when n.dup_n > 1 then 'ambiguous' else 'exact' end
  from nearest n
  where t.id = n.tat_id;
end $$;
