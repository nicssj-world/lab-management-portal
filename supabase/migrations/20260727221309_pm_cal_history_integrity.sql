-- Allow immutable per-attempt history and enforce plan/result ownership.
alter table public.equipment_calibrations
  drop constraint if exists equipment_calibrations_equipment_id_year_month_cal_type_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.equipment_pm_cal_plans'::regclass
      and conname = 'equipment_pm_cal_plans_result_identity_key'
  ) then
    alter table public.equipment_pm_cal_plans
      add constraint equipment_pm_cal_plans_result_identity_key
      unique (id, equipment_id, cal_type);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.equipment_calibrations'::regclass
      and conname = 'equipment_calibrations_plan_identity_fkey'
  ) then
    alter table public.equipment_calibrations
      add constraint equipment_calibrations_plan_identity_fkey
      foreign key (plan_id, equipment_id, cal_type)
      references public.equipment_pm_cal_plans (id, equipment_id, cal_type);
  end if;
end $$;

drop function if exists public.replace_equipment_pm_cal_plans(uuid, integer, jsonb, uuid);

create or replace function public.replace_equipment_pm_cal_plans(
  p_equipment_id uuid,
  p_fiscal_year integer,
  p_plans jsonb,
  p_expected_versions jsonb,
  p_actor uuid
)
returns setof public.equipment_pm_cal_plans
language plpgsql
security invoker
set search_path = public
as $$
declare
  item jsonb;
  current_row public.equipment_pm_cal_plans%rowtype;
  supplied_version integer;
begin
  if jsonb_typeof(p_expected_versions) <> 'object' then
    raise exception 'PM/CAL expected versions must be an object' using errcode = '22023';
  end if;

  perform 1
  from public.equipment_pm_cal_plans
  where equipment_id = p_equipment_id
    and fiscal_year = p_fiscal_year
    and record_status = 'active'
  for update;

  if (select count(*) from public.equipment_pm_cal_plans
      where equipment_id = p_equipment_id
        and fiscal_year = p_fiscal_year
        and record_status = 'active') <> (select count(*) from jsonb_object_keys(p_expected_versions))
     or exists (
       select 1
       from public.equipment_pm_cal_plans existing
       where existing.equipment_id = p_equipment_id
         and existing.fiscal_year = p_fiscal_year
         and existing.record_status = 'active'
         and coalesce((p_expected_versions->>existing.id::text)::integer, -1) <> existing.version
     ) then
    raise exception 'PM/CAL plan set was changed by another user' using errcode = '40001';
  end if;

  update public.equipment_pm_cal_plans existing
  set record_status = 'cancelled', version = existing.version + 1,
      updated_at = now(), updated_by = p_actor
  where existing.equipment_id = p_equipment_id
    and existing.fiscal_year = p_fiscal_year
    and existing.record_status = 'active'
    and not exists (
      select 1 from jsonb_array_elements(p_plans) requested
      where (requested->>'calendar_month')::integer = existing.calendar_month
        and requested->>'cal_type' = existing.cal_type
    );

  for item in select value from jsonb_array_elements(p_plans)
  loop
    select * into current_row
    from public.equipment_pm_cal_plans
    where equipment_id = p_equipment_id
      and fiscal_year = p_fiscal_year
      and calendar_month = (item->>'calendar_month')::integer
      and cal_type = item->>'cal_type'
      and record_status = 'active'
    for update;

    supplied_version := nullif(item->>'version', '')::integer;
    if found then
      if supplied_version is null or supplied_version <> current_row.version then
        raise exception 'PM/CAL plan was changed by another user' using errcode = '40001';
      end if;
      update public.equipment_pm_cal_plans
      set due_date = (item->>'due_date')::date,
          provider = nullif(item->>'provider', ''),
          planned_cost = nullif(item->>'planned_cost', '')::numeric,
          version = version + 1, updated_at = now(), updated_by = p_actor
      where id = current_row.id;
    else
      if supplied_version is not null then
        raise exception 'PM/CAL plan no longer exists' using errcode = '40001';
      end if;
      insert into public.equipment_pm_cal_plans (
        equipment_id, fiscal_year, calendar_month, cal_type, due_date,
        provider, planned_cost, created_by, updated_by
      ) values (
        p_equipment_id, p_fiscal_year, (item->>'calendar_month')::integer,
        item->>'cal_type', (item->>'due_date')::date,
        nullif(item->>'provider', ''), nullif(item->>'planned_cost', '')::numeric,
        p_actor, p_actor
      );
    end if;
  end loop;

  return query
    select * from public.equipment_pm_cal_plans
    where equipment_id = p_equipment_id
      and fiscal_year = p_fiscal_year
      and record_status = 'active'
    order by calendar_month, cal_type;
end;
$$;

revoke all on function public.replace_equipment_pm_cal_plans(uuid, integer, jsonb, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.replace_equipment_pm_cal_plans(uuid, integer, jsonb, jsonb, uuid) to service_role;
