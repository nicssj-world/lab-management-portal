-- PM/CAL plans and immutable per-attempt history.
-- The browser never accesses these tables directly; authenticated Route Handlers use service_role.

create table if not exists public.equipment_pm_cal_plans (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  fiscal_year integer not null check (fiscal_year between 2500 and 3000),
  calendar_month smallint not null check (calendar_month between 1 and 12),
  cal_type text not null check (cal_type in ('PM', 'CAL')),
  due_date date not null,
  provider text,
  planned_cost numeric(12,2) check (planned_cost is null or planned_cost >= 0),
  record_status text not null default 'active' check (record_status in ('active', 'cancelled')),
  source text not null default 'manual' check (source in ('manual', 'legacy_import')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create unique index if not exists equipment_pm_cal_active_plan_unique
  on public.equipment_pm_cal_plans (equipment_id, fiscal_year, calendar_month, cal_type)
  where record_status = 'active';
create index if not exists equipment_pm_cal_plans_due_idx
  on public.equipment_pm_cal_plans (fiscal_year, due_date, cal_type)
  where record_status = 'active';
create index if not exists equipment_pm_cal_plans_created_by_idx on public.equipment_pm_cal_plans (created_by);
create index if not exists equipment_pm_cal_plans_updated_by_idx on public.equipment_pm_cal_plans (updated_by);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'equipment_calibrations' and column_name = 'year'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'equipment_calibrations' and column_name = 'fiscal_year'
  ) then
    alter table public.equipment_calibrations rename column year to fiscal_year;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'equipment_calibrations' and column_name = 'month'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'equipment_calibrations' and column_name = 'calendar_month'
  ) then
    alter table public.equipment_calibrations rename column month to calendar_month;
  end if;
end $$;

alter table public.equipment_calibrations
  add column if not exists plan_id uuid references public.equipment_pm_cal_plans(id) on delete set null,
  add column if not exists result text,
  add column if not exists certificate_no text,
  add column if not exists error_value text,
  add column if not exists uncertainty text,
  add column if not exists certificate_file_url text,
  add column if not exists actual_cost numeric(12,2),
  add column if not exists source text not null default 'manual',
  add column if not exists legacy_key text,
  add column if not exists created_by uuid references public.profiles(id),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid references public.profiles(id);

-- Legacy evidence may have a Certificate but no valid completion date; keep it without guessing a period.
alter table public.equipment_calibrations
  alter column fiscal_year drop not null,
  alter column calendar_month drop not null;

-- The legacy table allowed only one row per equipment/month/type. History must
-- retain every attempt (for example CAL FAIL followed by a PASS retry).
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

create index if not exists equipment_calibrations_plan_identity_idx
  on public.equipment_calibrations (plan_id, equipment_id, cal_type);

create unique index if not exists equipment_calibrations_legacy_key_unique
  on public.equipment_calibrations (legacy_key)
  where legacy_key is not null;
create index if not exists equipment_calibrations_plan_idx
  on public.equipment_calibrations (plan_id, completed_date);
create index if not exists equipment_calibrations_created_by_idx on public.equipment_calibrations (created_by);
create index if not exists equipment_calibrations_updated_by_idx on public.equipment_calibrations (updated_by);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'equipment_calibrations_month_check') then
    alter table public.equipment_calibrations
      add constraint equipment_calibrations_month_check check (calendar_month between 1 and 12);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'equipment_calibrations_type_check') then
    alter table public.equipment_calibrations
      add constraint equipment_calibrations_type_check check (cal_type in ('PM', 'CAL'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'equipment_calibrations_result_check') then
    alter table public.equipment_calibrations
      add constraint equipment_calibrations_result_check check (result is null or result in ('PASS', 'FAIL', 'NOT_PERFORMED'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'equipment_calibrations_source_check') then
    alter table public.equipment_calibrations
      add constraint equipment_calibrations_source_check check (source in ('manual', 'legacy_import'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.equipment_calibrations'::regclass
      and conname = 'equipment_calibrations_pm_result_check'
  ) then
    alter table public.equipment_calibrations
      add constraint equipment_calibrations_pm_result_check
      check (cal_type <> 'PM' or result is null or result = 'NOT_PERFORMED');
  end if;
end $$;

alter table public.equipment_pm_cal_plans enable row level security;
alter table public.equipment_calibrations enable row level security;
revoke all on public.equipment_pm_cal_plans from anon, authenticated;
revoke all on public.equipment_calibrations from anon, authenticated;
grant select, insert, update, delete on public.equipment_pm_cal_plans to service_role;
grant select, insert, update, delete on public.equipment_calibrations to service_role;

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
  perform 1
  from public.equipment
  where id = p_equipment_id
  for update;
  if not found then
    raise exception 'Equipment not found' using errcode = '23503';
  end if;

  if jsonb_typeof(p_expected_versions) <> 'object' then
    raise exception 'PM/CAL expected versions must be an object' using errcode = '22023';
  end if;

  -- Lock and compare the complete active set before cancelling anything. This
  -- also protects deletions represented by omission from a stale overwrite.
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

-- Apply supabase/migrations/20260728130000_pm_cal_plan_groups.sql after this
-- consolidated history script to enable annual grouped planning.

-- Import the legacy Jan-Dec checkboxes as active fiscal-year 2569 plans.
with month_map(month_key, calendar_month) as (
  values ('Jan',1),('Feb',2),('Mar',3),('Apr',4),('May',5),('Jun',6),
         ('Jul',7),('Aug',8),('Sep',9),('Oct',10),('Nov',11),('Dec',12)
), legacy_plans as (
  select e.id equipment_id, m.calendar_month, t.cal_type,
         nullif(e.pm_cal_data->>'tech_group', '') provider
  from public.equipment e
  cross join month_map m
  cross join (values ('PM'), ('CAL')) t(cal_type)
  where e.needs_calibration = true
    and coalesce(e.pm_cal_data->'plan'->m.month_key->>lower(t.cal_type), 'false') = 'true'
)
insert into public.equipment_pm_cal_plans (
  equipment_id, fiscal_year, calendar_month, cal_type, due_date, provider, source
)
select equipment_id, 2569, calendar_month, cal_type,
       (make_date(case when calendar_month >= 10 then 2025 else 2026 end, calendar_month, 1)
        + interval '1 month - 1 day')::date,
       provider, 'legacy_import'
from legacy_plans
on conflict (equipment_id, fiscal_year, calendar_month, cal_type)
  where record_status = 'active' do nothing;

-- Preserve each valid latest date as unlinked legacy evidence; never guess its planned month.
with legacy_results as (
  select e.id equipment_id, 'PM'::text cal_type,
         nullif(e.pm_cal_data->>'last_pm_date','') raw_date,
         null::text certificate_no, null::text error_value, null::text uncertainty,
         null::text result, null::text certificate_file_url,
         nullif(e.pm_cal_data->>'remark','') notes
  from public.equipment e
  where e.pm_cal_data is not null
  union all
  select e.id, 'CAL', nullif(e.pm_cal_data->>'last_cal_date',''),
         nullif(e.pm_cal_data->>'certificate_no',''),
         nullif(e.pm_cal_data->>'error_value',''),
         nullif(e.pm_cal_data->>'uncertainty',''),
         case
           when lower(coalesce(e.pm_cal_data->>'cal_result','')) = 'pass' then 'PASS'
           when lower(coalesce(e.pm_cal_data->>'cal_result','')) like '%fail%' then 'FAIL'
           when lower(coalesce(e.pm_cal_data->>'cal_result','')) in ('no cal','not performed','ไม่ได้สอบเทียบ') then 'NOT_PERFORMED'
           else null
         end,
         nullif(e.pm_cal_data->>'certificate_file_url',''),
         nullif(e.pm_cal_data->>'remark','')
  from public.equipment e
  where e.pm_cal_data is not null
), valid_results as (
  select *, raw_date::date completed_date
  from legacy_results
  where raw_date is not null and pg_input_is_valid(raw_date, 'date')
)
insert into public.equipment_calibrations (
  equipment_id, fiscal_year, calendar_month, cal_type, planned, completed_date,
  result, certificate_no, error_value, uncertainty, notes, certificate_file_url,
  source, legacy_key
)
select equipment_id,
       case when extract(month from completed_date) >= 10
            then extract(year from completed_date)::integer + 544
            else extract(year from completed_date)::integer + 543 end,
       extract(month from completed_date)::integer,
       cal_type, false, completed_date, result, certificate_no, error_value,
       uncertainty, notes, certificate_file_url, 'legacy_import',
       equipment_id::text || ':' || cal_type || ':' || raw_date
from valid_results
on conflict (legacy_key) where legacy_key is not null do nothing;

insert into public.equipment_calibrations (
  equipment_id, fiscal_year, calendar_month, cal_type, planned, completed_date,
  result, certificate_no, error_value, uncertainty, notes, certificate_file_url,
  source, legacy_key
)
select e.id, null, null, 'CAL', false, null,
       case
         when lower(coalesce(e.pm_cal_data->>'cal_result','')) = 'pass' then 'PASS'
         when lower(coalesce(e.pm_cal_data->>'cal_result','')) like '%fail%' then 'FAIL'
         when lower(coalesce(e.pm_cal_data->>'cal_result','')) in ('no cal','not performed','ไม่ได้สอบเทียบ') then 'NOT_PERFORMED'
         else null
       end,
       nullif(e.pm_cal_data->>'certificate_no',''),
       nullif(e.pm_cal_data->>'error_value',''),
       nullif(e.pm_cal_data->>'uncertainty',''),
       nullif(e.pm_cal_data->>'remark',''),
       nullif(e.pm_cal_data->>'certificate_file_url',''),
       'legacy_import', e.id::text || ':CAL:certificate-only'
from public.equipment e
where nullif(e.pm_cal_data->>'certificate_file_url','') is not null
  and not exists (
    select 1 from public.equipment_calibrations history
    where history.equipment_id = e.id
      and history.certificate_file_url = e.pm_cal_data->>'certificate_file_url'
  )
on conflict (legacy_key) where legacy_key is not null do nothing;
