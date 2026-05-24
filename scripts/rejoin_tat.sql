-- Rejoin TAT + Phlebotomy data for a given year/month
-- Run via Supabase Dashboard → SQL Editor after phlebotomy_tables.sql

create or replace function rejoin_tat(p_year int, p_month int)
returns void language plpgsql as $$
begin
  -- 1. Reset phleb fields for the month (idempotent)
  update tat_records set
    register_at        = null,
    phleb_done_at      = null,
    phleb_wait_minutes = null,
    transport_minutes  = null,
    total_tat_minutes  = null,
    labzone_name       = null,
    phlebotomist       = null,
    match_confidence   = 'no_match'
  where year = p_year and month = p_month;

  -- 2. Count duplicate visits per hn+date to flag ambiguous matches
  with dupcount as (
    select hn, phleb_date, count(*) as n
    from phlebotomy_records
    where year = p_year and month = p_month
    group by hn, phleb_date
  ),
  -- 3. Nearest phlebotomy record before spcm_at (within 120-minute window)
  nearest as (
    select distinct on (t.id)
      t.id              as tat_id,
      t.spcm_at,
      t.rslt_at,
      t.is_blood_draw,
      p.register_at,
      p.phleb_done_at,
      p.wait_minutes,
      p.labzone_name,
      p.phlebotomist,
      coalesce(d.n, 1)  as dup_n
    from tat_records t
    join phlebotomy_records p
      on  p.hn = t.hn
      -- allow up to 120 min clock skew (phleb_done can appear after spcm_at due to HIS/LIS lag)
      and p.phleb_done_at <= t.spcm_at + interval '120 minutes'
      -- blood draw at most 8 hours before specimen arrived at lab
      and p.phleb_done_at >= t.spcm_at - interval '480 minutes'
    left join dupcount d
      on  d.hn = p.hn
      and d.phleb_date = p.phleb_date
    where t.year = p_year and t.month = p_month
      and t.hn is not null and t.hn <> ''
    order by t.id, abs(extract(epoch from (t.spcm_at - p.phleb_done_at)))
  )
  update tat_records t set
    register_at        = n.register_at,
    phleb_done_at      = n.phleb_done_at,
    transport_minutes  = extract(epoch from (n.spcm_at - n.phleb_done_at)) / 60.0,
    labzone_name       = n.labzone_name,
    phlebotomist       = n.phlebotomist,
    phleb_wait_minutes = case when t.is_blood_draw
                              then n.wait_minutes else null end,
    total_tat_minutes  = case when t.is_blood_draw
                              then extract(epoch from (n.rslt_at - n.register_at)) / 60.0
                              else null end,
    match_confidence   = case when n.dup_n > 1 then 'ambiguous' else 'exact' end
  from nearest n
  where t.id = n.tat_id;
end $$;
