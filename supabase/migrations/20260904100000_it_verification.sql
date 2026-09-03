-- IT Data Transfer Verification (Fm-QP-LAB-24/02)
-- Evidence is append-only: old sampling runs/samples are voided, never deleted.

create table if not exists public.it_verification_rounds (
  id uuid primary key default gen_random_uuid(),
  year integer not null check (year between 2000 and 2200),
  quarter integer not null check (quarter between 1 and 4),
  department_id integer not null references public.departments(id),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'reviewed')),
  submitted_at timestamptz,
  submitted_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  review_note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, quarter, department_id)
);

create table if not exists public.it_verification_sampling_runs (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.it_verification_rounds(id),
  -- Removing an upload must not remove verification evidence. The source link
  -- becomes null while the file metadata snapshot remains immutable evidence.
  upload_id uuid references public.tat_uploads(id) on delete set null,
  source_year integer,
  source_month integer check (source_month is null or source_month between 1 and 12),
  source_file_name text,
  source_uploaded_at timestamptz,
  source_row_count integer check (source_row_count is null or source_row_count >= 0),
  trigger text not null check (trigger in ('auto_upload', 'manual_generate', 'manual_resample', 'legacy_import')),
  sampling_method text not null default 'automatic' check (sampling_method in ('automatic', 'legacy_manual')),
  algorithm text not null default 'ln-hash-v1',
  seed uuid not null default gen_random_uuid(),
  quota integer not null default 0 check (quota >= 0),
  population_count integer not null default 0 check (population_count >= 0),
  sampled_count integer not null default 0 check (sampled_count >= 0),
  status text not null check (status in ('completed', 'skipped_existing', 'no_population', 'failed', 'void')),
  warning text,
  error_detail text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  attempt integer not null default 1 check (attempt >= 1),
  constraint it_verification_run_period_check check (
    sampling_method = 'legacy_manual' or source_month is not null
  ),
  unique (round_id, upload_id, sampling_method, attempt)
);

create table if not exists public.it_verification_samples (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.it_verification_rounds(id),
  sampling_run_id uuid not null references public.it_verification_sampling_runs(id),
  department_id integer not null references public.departments(id),
  ln text not null check (length(btrim(ln)) > 0 and ln = btrim(ln)),
  source_month integer check (source_month is null or source_month between 1 and 12),
  source_lab_section text,
  test_name text,
  first_spcm_at timestamptz,
  last_result_at timestamptz,
  source_record_count integer not null default 0 check (source_record_count >= 0),
  sampling_method text not null default 'automatic' check (sampling_method in ('automatic', 'legacy_manual')),
  lis_to_his text check (lis_to_his in ('pass', 'fail', 'na') or lis_to_his is null),
  source_to_lis text check (source_to_lis in ('pass', 'fail', 'na') or source_to_lis is null),
  remark text not null default '',
  sample_state text not null default 'active' check (sample_state in ('active', 'void')),
  voided_at timestamptz,
  voided_by uuid references public.profiles(id),
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint it_verification_sample_period_check check (
    sampling_method = 'legacy_manual' or source_month is not null
  )
);

create table if not exists public.it_verification_findings (
  id uuid primary key default gen_random_uuid(),
  sample_id uuid not null references public.it_verification_samples(id),
  round_id uuid not null references public.it_verification_rounds(id),
  transfer_point text not null check (transfer_point in ('lis_to_his', 'source_to_lis')),
  description text not null check (length(btrim(description)) > 0),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'closed')),
  opened_by uuid references public.profiles(id),
  opened_at timestamptz not null default now(),
  resolution_note text,
  closed_by uuid references public.profiles(id),
  closed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.it_verification_assignees (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.it_verification_rounds(id),
  department_id integer not null references public.departments(id),
  profile_id uuid not null references public.profiles(id),
  assigned_by uuid references public.profiles(id),
  assigned_at timestamptz not null default now(),
  unique (round_id, department_id)
);

create table if not exists public.it_verification_section_map (
  id uuid primary key default gen_random_uuid(),
  source_lab_section text not null check (length(btrim(source_lab_section)) > 0),
  department_id integer not null references public.departments(id),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_lab_section)
);

create unique index if not exists it_verification_active_ln_unique
  on public.it_verification_samples (round_id, department_id, ln)
  where sample_state = 'active';

create index if not exists it_verification_rounds_period_idx
  on public.it_verification_rounds (year, quarter, department_id);

create index if not exists it_verification_runs_upload_idx
  on public.it_verification_sampling_runs (upload_id, round_id);

create index if not exists it_verification_samples_round_state_idx
  on public.it_verification_samples (round_id, sample_state, department_id);

create index if not exists it_verification_findings_sample_status_idx
  on public.it_verification_findings (sample_id, status);

create index if not exists idx_tat_records_verification_population
  on public.tat_records (upload_id, lab_section, ln)
  include (spcm_at, rslt_at, test_name);

create index if not exists idx_tat_records_verification_trimmed_population
  on public.tat_records (upload_id, (btrim(lab_section)), (btrim(ln)))
  include (spcm_at, rslt_at, test_name);

create or replace function public.prevent_it_verification_evidence_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'IT verification evidence is append-only; void or reopen the record instead of deleting it';
end;
$$;

drop trigger if exists it_verification_sampling_runs_no_delete on public.it_verification_sampling_runs;
create trigger it_verification_sampling_runs_no_delete
  before delete on public.it_verification_sampling_runs
  for each row execute function public.prevent_it_verification_evidence_delete();
drop trigger if exists it_verification_samples_no_delete on public.it_verification_samples;
create trigger it_verification_samples_no_delete
  before delete on public.it_verification_samples
  for each row execute function public.prevent_it_verification_evidence_delete();
drop trigger if exists it_verification_findings_no_delete on public.it_verification_findings;
create trigger it_verification_findings_no_delete
  before delete on public.it_verification_findings
  for each row execute function public.prevent_it_verification_evidence_delete();
drop trigger if exists it_verification_rounds_no_delete on public.it_verification_rounds;
create trigger it_verification_rounds_no_delete
  before delete on public.it_verification_rounds
  for each row execute function public.prevent_it_verification_evidence_delete();

insert into public.it_verification_section_map (source_lab_section, department_id)
select seed.source_lab_section, d.id
from (values
  ('เคมีคลินิก', 'CHE'),
  ('ภูมิคุ้มกันวิทยา', 'IMM'),
  ('โลหิตวิทยา', 'HEM'),
  ('จุลทรรศน์วิทยาคลินิก', 'MIS'),
  ('จุลชีววิทยา', 'MIC'),
  ('อณูพันธุศาสตร์', 'MOL'),
  ('ธนาคารเลือด', 'BLB')
) as seed(source_lab_section, department_code)
join public.departments d on d.code = seed.department_code
on conflict (source_lab_section) do update
set department_id = excluded.department_id, is_active = true, updated_at = now();

-- Role permissions are stored as resource:level strings in this project.
insert into public.role_permissions (role, resource, granted) values
  ('Manager', 'ทวนสอบการส่งผ่านข้อมูล HIS & LIS:view', true),
  ('Medical Technologist', 'ทวนสอบการส่งผ่านข้อมูล HIS & LIS:view', true),
  ('Medical Science Technician', 'ทวนสอบการส่งผ่านข้อมูล HIS & LIS:view', true)
on conflict (role, resource) do update set granted = excluded.granted;

alter table public.it_verification_rounds enable row level security;
alter table public.it_verification_sampling_runs enable row level security;
alter table public.it_verification_samples enable row level security;
alter table public.it_verification_findings enable row level security;
alter table public.it_verification_assignees enable row level security;
alter table public.it_verification_section_map enable row level security;

drop policy if exists it_verification_rounds_authenticated_read on public.it_verification_rounds;
create policy it_verification_rounds_authenticated_read
  on public.it_verification_rounds for select to authenticated using (true);
drop policy if exists it_verification_runs_authenticated_read on public.it_verification_sampling_runs;
create policy it_verification_runs_authenticated_read
  on public.it_verification_sampling_runs for select to authenticated using (true);
drop policy if exists it_verification_samples_authenticated_read on public.it_verification_samples;
create policy it_verification_samples_authenticated_read
  on public.it_verification_samples for select to authenticated using (true);
drop policy if exists it_verification_findings_authenticated_read on public.it_verification_findings;
create policy it_verification_findings_authenticated_read
  on public.it_verification_findings for select to authenticated using (true);
drop policy if exists it_verification_assignees_authenticated_read on public.it_verification_assignees;
create policy it_verification_assignees_authenticated_read
  on public.it_verification_assignees for select to authenticated using (true);
drop policy if exists it_verification_section_map_authenticated_read on public.it_verification_section_map;
create policy it_verification_section_map_authenticated_read
  on public.it_verification_section_map for select to authenticated using (true);

revoke all on table public.it_verification_rounds,
             public.it_verification_sampling_runs,
             public.it_verification_samples,
             public.it_verification_findings,
             public.it_verification_assignees,
             public.it_verification_section_map
  from anon, authenticated;

-- Verification data is served through guarded server routes only. Keep RLS
-- enabled as a second boundary and do not expose LN/evidence rows to the
-- browser's authenticated role.
revoke select, insert, update, delete, truncate, references, trigger
  on table public.it_verification_rounds,
             public.it_verification_sampling_runs,
             public.it_verification_samples,
             public.it_verification_findings,
             public.it_verification_assignees,
             public.it_verification_section_map
  from anon, authenticated;
revoke delete, truncate
  on table public.it_verification_rounds,
             public.it_verification_sampling_runs,
             public.it_verification_samples,
             public.it_verification_findings
  from service_role;

create or replace function public.generate_it_verification_samples_from_tat(
  p_upload_id uuid,
  p_actor_id uuid,
  p_trigger text,
  p_department_id integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_upload record;
  v_department record;
  v_round_id uuid;
  v_run_id uuid;
  v_seed uuid;
  v_quarter integer;
  v_quota integer;
  v_population integer;
  v_sampled integer;
  v_active integer;
  v_attempt integer;
  v_existing_run record;
  v_unmapped_sections jsonb;
  v_warning text;
  v_run_status text;
  v_sample record;
  v_result jsonb := '[]'::jsonb;
begin
  if p_trigger not in ('auto_upload', 'manual_generate', 'manual_resample', 'legacy_import') then
    raise exception 'invalid verification sampling trigger';
  end if;

  select id, year, month, file_name, uploaded_at, row_count into v_upload
  from public.tat_uploads
  where id = p_upload_id;
  if not found then raise exception 'TAT upload not found'; end if;

  v_quarter := ceil(v_upload.month / 3.0)::integer;
  if p_department_id is not null and not exists (
    select 1 from public.departments d
    where d.id = p_department_id and d.code in ('CHE', 'IMM', 'HEM', 'MIS', 'MIC', 'MOL', 'BLB')
  ) then
    raise exception 'department is outside the IT verification scope';
  end if;

  -- Automatic all-department runs and manual single-department runs share the
  -- same period lock, so they cannot race while checking the active-LN set.
  perform pg_advisory_xact_lock(hashtextextended(
    format('it-verification:%s:%s', v_upload.year, v_quarter), 0
  ));

  for v_department in
    select d.id, d.code
    from public.departments d
    where d.code in ('CHE', 'IMM', 'HEM', 'MIS', 'MIC', 'MOL', 'BLB')
      and (p_department_id is null or d.id = p_department_id)
    order by case d.code when 'CHE' then 1 when 'IMM' then 2 when 'HEM' then 3
      when 'MIS' then 4 when 'MIC' then 5 when 'MOL' then 6 when 'BLB' then 7 else 99 end
  loop
    insert into public.it_verification_rounds (year, quarter, department_id, created_by)
    values (v_upload.year, v_quarter, v_department.id, p_actor_id)
    on conflict (year, quarter, department_id) do update set updated_at = now()
    returning id into v_round_id;

    if exists (select 1 from public.it_verification_rounds r where r.id = v_round_id and r.status = 'reviewed') then
      raise exception 'verification round is locked for department %', v_department.code;
    end if;

    select coalesce(max(sr.attempt), 0) + 1 into v_attempt
    from public.it_verification_sampling_runs sr
    where sr.round_id = v_round_id and sr.upload_id = p_upload_id and sr.sampling_method = 'automatic';

    if p_trigger <> 'manual_resample' then
      select sr.id, sr.status, sr.sampled_count, sr.warning into v_existing_run
      from public.it_verification_sampling_runs sr
      where sr.round_id = v_round_id and sr.upload_id = p_upload_id and sr.sampling_method = 'automatic'
      order by sr.attempt desc
      limit 1;
      -- A completed set is idempotent. Empty/failed runs stay retryable so a
      -- newly-added mapping or a transient sampler error can be recovered.
      if found and v_existing_run.status in ('completed', 'skipped_existing') then
        v_result := v_result || jsonb_build_array(jsonb_build_object(
          'departmentCode', v_department.code, 'runId', v_existing_run.id,
          'status', 'skipped_existing', 'sampled', coalesce(v_existing_run.sampled_count, 0),
          'warning', v_existing_run.warning
        ));
        continue;
      end if;
    end if;

    select count(*) into v_active
    from public.it_verification_samples s
    where s.round_id = v_round_id and s.department_id = v_department.id and s.sample_state = 'active';

    if v_active >= 10 then
      v_seed := gen_random_uuid();
      insert into public.it_verification_sampling_runs (
        round_id, upload_id, source_year, source_month, source_file_name, source_uploaded_at, source_row_count,
        trigger, seed, quota, population_count,
        attempt,
        sampled_count, status, warning, created_by
      ) values (
        v_round_id, p_upload_id, v_upload.year, v_upload.month, v_upload.file_name, v_upload.uploaded_at, v_upload.row_count,
        p_trigger, v_seed, 0, 0,
        v_attempt, 0,
        'skipped_existing', 'ครบจำนวนตัวอย่างของไตรมาสแล้ว', p_actor_id
      ) returning id into v_run_id;
      v_result := v_result || jsonb_build_array(jsonb_build_object(
        'departmentCode', v_department.code, 'runId', v_run_id, 'status', 'skipped_existing', 'sampled', 0,
        'warning', 'ครบจำนวนตัวอย่างของไตรมาสแล้ว'
      ));
      continue;
    end if;

    v_quota := least(10 - v_active, case when v_upload.month % 3 = 0 then 4 else 3 end);
    select count(*) into v_population
    from (
      select btrim(tr.ln) as ln
      from public.tat_records tr
      join public.it_verification_section_map sm
        on sm.is_active and sm.department_id = v_department.id
       and btrim(sm.source_lab_section) = btrim(tr.lab_section)
      where tr.upload_id = p_upload_id and nullif(btrim(tr.ln), '') is not null
      group by btrim(tr.ln)
    ) population;

    select coalesce(jsonb_agg(section_name order by section_name), '[]'::jsonb)
    into v_unmapped_sections
    from (
      select distinct btrim(tr.lab_section) as section_name
      from public.tat_records tr
      left join public.it_verification_section_map sm
        on sm.is_active and btrim(sm.source_lab_section) = btrim(tr.lab_section)
      where tr.upload_id = p_upload_id
        and nullif(btrim(tr.lab_section), '') is not null
        and sm.id is null
    ) sections;

    v_warning := case
      when v_population = 0 then 'ไม่พบประชากร LN ที่มี mapping สำหรับหน่วยงานนี้'
      when v_population < v_quota then format('ประชากรมีเพียง %s LN จึงสุ่มได้เท่าที่มี', v_population)
      else null
    end;
    if jsonb_array_length(v_unmapped_sections) > 0 then
      v_warning := concat_ws(' · ', v_warning, 'มี lab section ที่ยังไม่ map: ' || (
        select string_agg(value, ', ' order by value)
        from jsonb_array_elements_text(v_unmapped_sections)
      ));
    end if;

    v_run_status := case when v_population = 0 then 'no_population' else 'completed' end;

    v_seed := gen_random_uuid();
    insert into public.it_verification_sampling_runs (
      round_id, upload_id, source_year, source_month, source_file_name, source_uploaded_at, source_row_count,
      trigger, seed, quota, population_count,
      attempt,
      sampled_count, status, warning, created_by
    ) values (
      v_round_id, p_upload_id, v_upload.year, v_upload.month, v_upload.file_name, v_upload.uploaded_at, v_upload.row_count,
      p_trigger, v_seed, v_quota,
      v_population, v_attempt, 0, v_run_status,
      v_warning, p_actor_id
    ) returning id into v_run_id;

    v_sampled := 0;
    for v_sample in
      with population as (
        select
          btrim(tr.ln) as ln,
          min(tr.spcm_at) as first_spcm_at,
          max(tr.rslt_at) as last_result_at,
          string_agg(distinct nullif(btrim(tr.lab_section), ''), ', ' order by nullif(btrim(tr.lab_section), '')) as source_lab_section,
          string_agg(distinct nullif(btrim(tr.test_name), ''), ', ' order by nullif(btrim(tr.test_name), '')) as test_name,
          count(*)::integer as source_record_count
        from public.tat_records tr
        join public.it_verification_section_map sm
          on sm.is_active and sm.department_id = v_department.id
         and btrim(sm.source_lab_section) = btrim(tr.lab_section)
        where tr.upload_id = p_upload_id and nullif(btrim(tr.ln), '') is not null
        group by btrim(tr.ln)
      )
      select p.*
      from population p
      where not exists (
        select 1 from public.it_verification_samples prior
        where prior.round_id = v_round_id and prior.department_id = v_department.id
          and prior.sample_state = 'active' and prior.ln = p.ln
      )
      order by md5(v_seed::text || '|' || p.ln)
      limit v_quota
    loop
      insert into public.it_verification_samples (
        round_id, sampling_run_id, department_id, ln, source_month, source_lab_section,
        test_name, first_spcm_at, last_result_at, source_record_count, sampling_method
      ) values (
        v_round_id, v_run_id, v_department.id, v_sample.ln, v_upload.month,
        v_sample.source_lab_section, v_sample.test_name, v_sample.first_spcm_at,
        v_sample.last_result_at, v_sample.source_record_count, 'automatic'
      );
      v_sampled := v_sampled + 1;
    end loop;

    update public.it_verification_sampling_runs
    set sampled_count = v_sampled,
        -- A populated upload may contain only LN values already active in the
        -- quarter. That is a valid deduplication outcome, not a sampler error.
        status = case when v_sampled = 0 and v_population > 0 then 'completed' else status end,
        warning = case when v_population > 0 and v_sampled < v_quota then concat_ws(' · ', v_warning, 'ไม่สามารถเติม quota ได้ครบจาก LN ที่เหลือ') else v_warning end
    where id = v_run_id;

    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'departmentCode', v_department.code,
      'runId', v_run_id,
      'status', case when v_sampled = 0 and v_population > 0 then 'completed' else v_run_status end,
      'population', v_population,
      'quota', v_quota,
      'sampled', v_sampled,
      'unmappedSections', v_unmapped_sections,
      'warning', case when v_population > 0 and v_sampled < v_quota then concat_ws(' · ', v_warning, 'ไม่สามารถเติม quota ได้ครบจาก LN ที่เหลือ') else v_warning end
    ));
  end loop;

  return v_result;
end;
$$;

create or replace function public.resample_it_verification_samples_from_tat(
  p_upload_id uuid,
  p_actor_id uuid,
  p_department_id integer,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_upload record;
  v_round_id uuid;
  v_quarter integer;
begin
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'resample reason is required';
  end if;
  if not exists (
    select 1 from public.departments d
    where d.id = p_department_id and d.code in ('CHE', 'IMM', 'HEM', 'MIS', 'MIC', 'MOL', 'BLB')
  ) then
    raise exception 'department is outside the IT verification scope';
  end if;

  select id, year, month into v_upload
  from public.tat_uploads
  where id = p_upload_id;
  if not found then raise exception 'TAT upload not found'; end if;
  v_quarter := ceil(v_upload.month / 3.0)::integer;

  perform pg_advisory_xact_lock(hashtextextended(
    format('it-verification:%s:%s', v_upload.year, v_quarter), 0
  ));

  select r.id into v_round_id
  from public.it_verification_rounds r
  where r.year = v_upload.year and r.quarter = v_quarter and r.department_id = p_department_id;
  if not found then raise exception 'verification round not found'; end if;
  if exists (select 1 from public.it_verification_rounds r where r.id = v_round_id and r.status = 'reviewed') then
    raise exception 'verification round is locked';
  end if;

  update public.it_verification_samples s
  set sample_state = 'void', voided_at = now(), voided_by = p_actor_id,
      void_reason = btrim(p_reason), updated_at = now()
  where s.round_id = v_round_id and s.department_id = p_department_id and s.sample_state = 'active'
    and exists (
      select 1 from public.it_verification_sampling_runs sr
      where sr.id = s.sampling_run_id and sr.round_id = v_round_id
        and sr.upload_id = p_upload_id and sr.sampling_method = 'automatic' and sr.status <> 'void'
    );

  update public.it_verification_sampling_runs
  set status = 'void', error_detail = 'resampled: ' || btrim(p_reason)
  where round_id = v_round_id and upload_id = p_upload_id
    and sampling_method = 'automatic' and status <> 'void';

  return public.generate_it_verification_samples_from_tat(
    p_upload_id, p_actor_id, 'manual_resample', p_department_id
  );
end;
$$;

create or replace function public.update_it_verification_sample(
  p_sample_id uuid,
  p_actor_id uuid,
  p_lis_to_his text,
  p_source_to_lis text,
  p_remark text default '',
  p_findings jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sample record;
  v_finding jsonb;
  v_finding_id uuid;
  v_point text;
  v_description text;
  v_severity text;
begin
  if p_lis_to_his is not null and p_lis_to_his not in ('pass', 'fail', 'na') then
    raise exception 'invalid LIS to HIS result';
  end if;
  if p_source_to_lis is not null and p_source_to_lis not in ('pass', 'fail', 'na') then
    raise exception 'invalid source to LIS result';
  end if;
  if (p_lis_to_his = 'na' or p_source_to_lis = 'na') and nullif(btrim(coalesce(p_remark, '')), '') is null then
    raise exception 'N/A result requires a remark';
  end if;

  select s.*, r.status as round_status
  into v_sample
  from public.it_verification_samples s
  join public.it_verification_rounds r on r.id = s.round_id
  where s.id = p_sample_id and s.sample_state = 'active';
  if not found then raise exception 'verification sample not found'; end if;
  if v_sample.round_status = 'reviewed' then raise exception 'verification round is locked'; end if;

  update public.it_verification_samples
  set lis_to_his = p_lis_to_his,
      source_to_lis = p_source_to_lis,
      remark = coalesce(p_remark, ''),
      updated_at = now()
  where id = p_sample_id;

  for v_finding in select value from jsonb_array_elements(coalesce(p_findings, '[]'::jsonb))
  loop
    v_point := v_finding->>'transferPoint';
    v_description := nullif(btrim(v_finding->>'description'), '');
    v_severity := coalesce(v_finding->>'severity', 'medium');
    if v_point not in ('lis_to_his', 'source_to_lis') or v_description is null then
      raise exception 'finding requires a transfer point and description';
    end if;
    if v_severity not in ('low', 'medium', 'high') then
      raise exception 'invalid finding severity';
    end if;

    select f.id into v_finding_id
    from public.it_verification_findings f
    where f.sample_id = p_sample_id and f.transfer_point = v_point and f.status <> 'closed'
    order by f.opened_at desc
    limit 1;
    if v_finding_id is null then
      insert into public.it_verification_findings (
        sample_id, round_id, transfer_point, description, severity, opened_by
      ) values (
        p_sample_id, v_sample.round_id, v_point, v_description, v_severity, p_actor_id
      );
    else
      update public.it_verification_findings
      set description = v_description, severity = v_severity, updated_at = now()
      where id = v_finding_id;
    end if;
    v_finding_id := null;
  end loop;

  if p_lis_to_his = 'fail' and not exists (
    select 1 from public.it_verification_findings f
    where f.sample_id = p_sample_id and f.transfer_point = 'lis_to_his' and f.status <> 'closed'
  ) then raise exception 'LIS to HIS fail requires a finding'; end if;
  if p_source_to_lis = 'fail' and not exists (
    select 1 from public.it_verification_findings f
    where f.sample_id = p_sample_id and f.transfer_point = 'source_to_lis' and f.status <> 'closed'
  ) then raise exception 'source to LIS fail requires a finding'; end if;

  return jsonb_build_object('id', p_sample_id, 'updated', true);
end;
$$;

revoke all on function public.generate_it_verification_samples_from_tat(uuid, uuid, text, integer)
  from public, anon, authenticated;
revoke all on function public.resample_it_verification_samples_from_tat(uuid, uuid, integer, text)
  from public, anon, authenticated;
revoke all on function public.update_it_verification_sample(uuid, uuid, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.generate_it_verification_samples_from_tat(uuid, uuid, text, integer)
  to service_role;
grant execute on function public.resample_it_verification_samples_from_tat(uuid, uuid, integer, text)
  to service_role;
grant execute on function public.update_it_verification_sample(uuid, uuid, text, text, text, jsonb)
  to service_role;

notify pgrst, 'reload schema';
