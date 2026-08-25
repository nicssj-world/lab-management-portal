-- Batch updater for derived rejection-analysis fields.
-- SECURITY INVOKER keeps the function subject to the caller's privileges;
-- only the server's service role is granted EXECUTE.

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
      reason_analyzed_at timestamptz
    )
  ), updated as (
    update public.rejection_logs as target
    set reason_normalized = source.reason_normalized,
        reason_category = source.reason_category,
        reason_confidence = source.reason_confidence,
        reason_analysis_source = source.reason_analysis_source,
        reason_analysis_rule = source.reason_analysis_rule,
        reason_analyzed_at = source.reason_analyzed_at
    from updates as source
    where target.id = source.id
    returning target.id
  )
  select count(*)::integer from updated;
$$;

revoke all on function public.apply_rejection_analysis(jsonb) from public, anon, authenticated;
grant execute on function public.apply_rejection_analysis(jsonb) to service_role;

