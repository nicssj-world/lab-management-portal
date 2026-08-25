-- Roll analyzed "อื่นๆ" rows into an existing main Reject label when the
-- server-side classifier has found a conservative direct match.
-- The raw rejection_logs.reject value is never overwritten.

alter table public.rejection_logs
  add column if not exists reason_rollup_reject text;

create index if not exists rejection_logs_reason_rollup_reject_idx
  on public.rejection_logs (reason_rollup_reject);

create or replace function public.get_rejection_main_labels()
returns table(reject text)
language sql
security invoker
set search_path = public
as $$
  select distinct rl.reject
  from public.rejection_logs rl
  where rl.reject is not null
    and rl.reject <> 'อื่นๆ'
  order by rl.reject;
$$;

revoke all on function public.get_rejection_main_labels() from public, anon, authenticated;
grant execute on function public.get_rejection_main_labels() to service_role;

create or replace function public.apply_rejection_analysis(p_rows jsonb)
returns integer
language sql
security invoker
set search_path = public
as $$
  with updates as (
    select *
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as x(
      id uuid,
      reason_normalized text,
      reason_category text,
      reason_confidence numeric,
      reason_analysis_source text,
      reason_analysis_rule text,
      reason_analyzed_at timestamptz,
      reason_rollup_reject text
    )
  ), updated as (
    update public.rejection_logs as target
    set reason_normalized = source.reason_normalized,
        reason_category = source.reason_category,
        reason_confidence = source.reason_confidence,
        reason_analysis_source = source.reason_analysis_source,
        reason_analysis_rule = source.reason_analysis_rule,
        reason_analyzed_at = source.reason_analyzed_at,
        reason_rollup_reject = source.reason_rollup_reject
    from updates as source
    where target.id = source.id
    returning target.id
  )
  select count(*)::integer from updated;
$$;

revoke all on function public.apply_rejection_analysis(jsonb) from public, anon, authenticated;
grant execute on function public.apply_rejection_analysis(jsonb) to service_role;

create or replace function public.get_rejection_summary(
  p_year integer default null,
  p_month integer default null,
  p_filter_year text default null,
  p_work text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_start date;
  v_end date;
  v_ps date;
  v_pe date;
  v_ts date;
begin
  if p_year is not null and p_month is not null then
    v_start := make_date(p_year, p_month, 1);
    v_end := (v_start + interval '1 month' - interval '1 day')::date;
    v_ps := (v_start - interval '1 month')::date;
    v_pe := v_start - 1;
    v_ts := (v_start - interval '11 months')::date;
  elsif p_filter_year is not null then
    v_start := make_date(p_filter_year::int, 1, 1);
    v_end := make_date(p_filter_year::int, 12, 31);
    v_ps := make_date(p_filter_year::int - 1, 1, 1);
    v_pe := make_date(p_filter_year::int - 1, 12, 31);
    v_ts := v_start;
  else
    v_start := '2000-01-01'::date;
    v_end := current_date;
    v_ps := v_start;
    v_pe := v_start;
    v_ts := (current_date - interval '11 months')::date;
  end if;

  return (
    with normalized_logs as (
      select
        rl.spcmdate,
        rl.reject,
        rl.reason,
        rl.reason_rollup_reject,
        rl.work,
        rl.labspcmnm,
        rl.ward,
        case
          when rl.reject = 'อื่นๆ'
            and nullif(trim(rl.reason_rollup_reject), '') is not null
            then rl.reason_rollup_reject
          else rl.reject
        end as normalized_reject
      from public.rejection_logs rl
    )
    select json_build_object(
      'current_total', (
        select count(*) from normalized_logs
        where spcmdate between v_start and v_end
          and (p_work is null or work = p_work)
      ),
      'prev_total', (
        select count(*) from normalized_logs
        where spcmdate between v_ps and v_pe
          and (p_work is null or work = p_work)
      ),
      'by_reason', (
        select coalesce(json_agg(r order by r.total desc), '[]')
        from (
          select normalized_reject as reason, count(*)::int as total
          from normalized_logs
          where spcmdate between v_start and v_end
            and (p_work is null or work = p_work)
          group by normalized_reject
        ) r
      ),
      'by_reason_prev', (
        select coalesce(json_agg(r order by r.total desc), '[]')
        from (
          select normalized_reject as reason, count(*)::int as total
          from normalized_logs
          where spcmdate between v_ps and v_pe
            and (p_work is null or work = p_work)
          group by normalized_reject
        ) r
      ),
      'by_reason_detail', (
        select coalesce(json_agg(r), '[]')
        from (
          select coalesce(nullif(trim(reason), ''), 'ไม่ระบุเหตุผล') as label,
                 count(*)::int as total
          from normalized_logs
          where spcmdate between v_start and v_end
            and (p_work is null or work = p_work)
            and reject = 'อื่นๆ'
          group by label
          order by total desc
          limit 30
        ) r
      ),
      'by_section', (
        select coalesce(json_agg(r order by r.total desc), '[]')
        from (
          select work as section, count(*)::int as total
          from normalized_logs
          where spcmdate between v_start and v_end
            and (p_work is null or work = p_work)
          group by work
        ) r
      ),
      'by_specimen', (
        select coalesce(json_agg(r), '[]')
        from (
          select labspcmnm as specimen, count(*)::int as total
          from normalized_logs
          where spcmdate between v_start and v_end
            and (p_work is null or work = p_work)
          group by labspcmnm
          order by total desc
          limit 10
        ) r
      ),
      'by_ward', (
        select coalesce(json_agg(r), '[]')
        from (
          select ward, count(*)::int as total
          from normalized_logs
          where spcmdate between v_start and v_end
            and (p_work is null or work = p_work)
          group by ward
          order by total desc
          limit 20
        ) r
      ),
      'monthly_trend', (
        select coalesce(json_agg(r order by r.month), '[]')
        from (
          select to_char(spcmdate, 'YYYY-MM') as month, count(*)::int as total
          from normalized_logs
          where spcmdate between v_ts and v_end
            and (p_work is null or work = p_work)
          group by to_char(spcmdate, 'YYYY-MM')
        ) r
      ),
      'yearly_trend', (
        select coalesce(json_agg(r order by r.yr), '[]')
        from (
          select extract(year from spcmdate)::int as yr, count(*)::int as total
          from normalized_logs
          where (p_work is null or work = p_work)
          group by yr
        ) r
      ),
      'yearly_by_reason', (
        select coalesce(json_agg(r order by r.yr, r.total desc), '[]')
        from (
          select extract(year from n.spcmdate)::int as yr,
                 n.normalized_reject as reason,
                 count(*)::int as total
          from normalized_logs n
          where (p_work is null or n.work = p_work)
            and n.normalized_reject in (
              select top_reasons.reason
              from (
                select normalized_reject as reason, count(*)::int as total
                from normalized_logs
                where (p_work is null or work = p_work)
                group by normalized_reject
                order by total desc
                limit 6
              ) top_reasons
            )
          group by yr, n.normalized_reject
        ) r
      ),
      'yearly_by_section', (
        select coalesce(json_agg(r order by r.yr, r.total desc), '[]')
        from (
          select extract(year from spcmdate)::int as yr,
                 work as section,
                 count(*)::int as total
          from normalized_logs
          where (p_work is null or work = p_work)
          group by yr, work
        ) r
      ),
      'monthly_by_year', (
        select coalesce(json_agg(r order by r.yr, r.mo), '[]')
        from (
          select extract(year from spcmdate)::int as yr,
                 extract(month from spcmdate)::int as mo,
                 count(*)::int as total
          from normalized_logs
          where (p_work is null or work = p_work)
          group by yr, mo
        ) r
      )
    )
  );
end;
$function$;
