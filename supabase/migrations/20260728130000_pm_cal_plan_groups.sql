-- Annual grouped PM/CAL plans with per-equipment members.
create table if not exists public.equipment_pm_cal_plan_groups (
  id uuid primary key default gen_random_uuid(),
  fiscal_year integer not null check (fiscal_year between 2500 and 3000),
  group_name text not null check (length(btrim(group_name)) between 1 and 200),
  plan_name text not null check (length(btrim(plan_name)) between 1 and 500),
  cal_type text not null check (cal_type in ('PM', 'CAL')),
  calendar_month smallint not null check (calendar_month between 1 and 12),
  due_date date not null,
  provider text,
  price_mode text not null check (price_mode in ('per_unit', 'lump_sum')),
  unit_price numeric(12,2),
  planned_amount numeric(12,2) not null check (planned_amount >= 0),
  actual_amount numeric(12,2) check (actual_amount is null or actual_amount >= 0),
  record_status text not null default 'active' check (record_status in ('active', 'cancelled')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  check ((price_mode = 'per_unit' and unit_price is not null)
      or (price_mode = 'lump_sum' and unit_price is null))
);

create index if not exists equipment_pm_cal_plan_groups_year_idx
  on public.equipment_pm_cal_plan_groups (fiscal_year, record_status);

alter table public.equipment_pm_cal_plans
  add column if not exists plan_group_id uuid references public.equipment_pm_cal_plan_groups(id) on delete set null;
create index if not exists equipment_pm_cal_plans_group_idx
  on public.equipment_pm_cal_plans (plan_group_id) where plan_group_id is not null;

alter table public.equipment_pm_cal_plan_groups enable row level security;
revoke all on public.equipment_pm_cal_plan_groups from anon, authenticated;
grant select, insert, update, delete on public.equipment_pm_cal_plan_groups to service_role;

create or replace function public.replace_equipment_pm_cal_plan_group(
  p_group jsonb, p_members jsonb, p_expected_versions jsonb, p_actor uuid
) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  group_id uuid := coalesce(nullif(p_group->>'id', '')::uuid, gen_random_uuid());
  existing_group public.equipment_pm_cal_plan_groups%rowtype;
  member jsonb;
  member_id uuid;
  member_count integer;
  expected_version integer := nullif(p_group->>'version', '')::integer;
  price_mode_value text := p_group->>'price_mode';
  unit_price_value numeric := nullif(p_group->>'unit_price', '')::numeric;
  planned_amount_value numeric;
begin
  if jsonb_typeof(p_members) <> 'array' or jsonb_array_length(p_members) = 0 then
    raise exception 'At least one equipment member is required' using errcode = '22023';
  end if;
  select count(distinct value::text) into member_count from jsonb_array_elements_text(p_members);
  if member_count <> jsonb_array_length(p_members) then
    raise exception 'Duplicate equipment member' using errcode = '22023';
  end if;
  if extract(month from (p_group->>'due_date')::date) <> (p_group->>'calendar_month')::integer
     or extract(year from (p_group->>'due_date')::date) <>
       (p_group->>'fiscal_year')::integer - case when (p_group->>'calendar_month')::integer >= 10 then 544 else 543 end then
    raise exception 'Due date does not match fiscal year and month' using errcode = '22023';
  end if;
  planned_amount_value := case when price_mode_value = 'per_unit'
    then unit_price_value * member_count
    else (p_group->>'planned_amount')::numeric end;

  select * into existing_group from public.equipment_pm_cal_plan_groups where id = group_id for update;
  if found then
    if existing_group.version <> expected_version then
      raise exception 'PM/CAL group was changed by another user' using errcode = '40001';
    end if;
    update public.equipment_pm_cal_plan_groups set
      fiscal_year = (p_group->>'fiscal_year')::integer, group_name = btrim(p_group->>'group_name'),
      plan_name = btrim(p_group->>'plan_name'), cal_type = p_group->>'cal_type',
      calendar_month = (p_group->>'calendar_month')::integer, due_date = (p_group->>'due_date')::date,
      provider = nullif(btrim(p_group->>'provider'), ''), price_mode = price_mode_value,
      unit_price = case when price_mode_value = 'per_unit' then unit_price_value else null end,
      planned_amount = planned_amount_value,
      actual_amount = nullif(p_group->>'actual_amount', '')::numeric,
      version = version + 1, updated_at = now(), updated_by = p_actor
    where id = group_id;
  else
    insert into public.equipment_pm_cal_plan_groups (
      id, fiscal_year, group_name, plan_name, cal_type, calendar_month, due_date, provider,
      price_mode, unit_price, planned_amount, actual_amount, created_by, updated_by
    ) values (
      group_id, (p_group->>'fiscal_year')::integer, btrim(p_group->>'group_name'), btrim(p_group->>'plan_name'),
      p_group->>'cal_type', (p_group->>'calendar_month')::integer, (p_group->>'due_date')::date,
      nullif(btrim(p_group->>'provider'), ''), price_mode_value,
      case when price_mode_value = 'per_unit' then unit_price_value else null end,
      planned_amount_value, nullif(p_group->>'actual_amount', '')::numeric, p_actor, p_actor
    );
  end if;

  if exists (
    select 1 from public.equipment_pm_cal_plans plan
    join public.equipment_calibrations result on result.plan_id = plan.id
    where plan.plan_group_id = group_id and plan.record_status = 'active'
      and not (plan.equipment_id::text in (select value from jsonb_array_elements_text(p_members)))
  ) then
    raise exception 'group has member results' using errcode = '23503';
  end if;

  update public.equipment_pm_cal_plans set record_status = 'cancelled', version = version + 1,
    updated_at = now(), updated_by = p_actor
  where plan_group_id = group_id and record_status = 'active'
    and not (equipment_id::text in (select value from jsonb_array_elements_text(p_members)));

  for member in select value from jsonb_array_elements(p_members) loop
    member_id := (member #>> '{}')::uuid;
    perform 1 from public.equipment where id = member_id for update;
    if not found then raise exception 'Equipment not found' using errcode = '23503'; end if;
    if exists (select 1 from public.equipment_pm_cal_plans where equipment_id = member_id
      and fiscal_year = (p_group->>'fiscal_year')::integer
      and calendar_month = (p_group->>'calendar_month')::integer and cal_type = p_group->>'cal_type'
      and record_status = 'active' and plan_group_id is distinct from group_id) then
      raise exception 'Equipment already has an active PM/CAL plan' using errcode = '23505';
    end if;
    update public.equipment_pm_cal_plans set due_date = (p_group->>'due_date')::date,
      provider = nullif(btrim(p_group->>'provider'), ''),
      planned_cost = case when price_mode_value = 'per_unit' then unit_price_value else null end,
      version = version + 1, updated_at = now(), updated_by = p_actor
    where equipment_id = member_id and fiscal_year = (p_group->>'fiscal_year')::integer
      and calendar_month = (p_group->>'calendar_month')::integer and cal_type = p_group->>'cal_type'
      and record_status = 'active' and plan_group_id = group_id;
    if not found then
      insert into public.equipment_pm_cal_plans (
        equipment_id, fiscal_year, calendar_month, cal_type, due_date, provider, planned_cost,
        plan_group_id, created_by, updated_by
      ) values (
        member_id, (p_group->>'fiscal_year')::integer, (p_group->>'calendar_month')::integer,
        p_group->>'cal_type', (p_group->>'due_date')::date, nullif(btrim(p_group->>'provider'), ''),
        case when price_mode_value = 'per_unit' then unit_price_value else null end,
        group_id, p_actor, p_actor
      );
    end if;
  end loop;
  return jsonb_build_object('id', group_id);
end $$;

create or replace function public.cancel_equipment_pm_cal_plan_group(
  p_group_id uuid, p_version integer, p_actor uuid
) returns void language plpgsql security invoker set search_path = public as $$
begin
  perform 1 from public.equipment_pm_cal_plan_groups
    where id = p_group_id and record_status = 'active' and version = p_version for update;
  if not found then raise exception 'PM/CAL group was changed by another user' using errcode = '40001'; end if;
  if exists (select 1 from public.equipment_pm_cal_plans plan
    join public.equipment_calibrations result on result.plan_id = plan.id
    where plan.plan_group_id = p_group_id) then
    raise exception 'group has member results' using errcode = '23503';
  end if;
  update public.equipment_pm_cal_plans set record_status = 'cancelled', version = version + 1,
    updated_at = now(), updated_by = p_actor where plan_group_id = p_group_id and record_status = 'active';
  update public.equipment_pm_cal_plan_groups set record_status = 'cancelled', version = version + 1,
    updated_at = now(), updated_by = p_actor where id = p_group_id;
end $$;

revoke all on function public.replace_equipment_pm_cal_plan_group(jsonb, jsonb, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.cancel_equipment_pm_cal_plan_group(uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.replace_equipment_pm_cal_plan_group(jsonb, jsonb, jsonb, uuid) to service_role;
grant execute on function public.cancel_equipment_pm_cal_plan_group(uuid, integer, uuid) to service_role;
