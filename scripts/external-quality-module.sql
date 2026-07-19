-- EQA and OUTLAB modules. Safe to run repeatedly in Supabase SQL Editor.

create table if not exists public.outlab_editors (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

create table if not exists public.outlab_laboratories (
  id uuid primary key default gen_random_uuid(),
  sector text not null check (sector in ('gov','priv','other')),
  name text not null unique,
  brand text,
  address text,
  contact_name text,
  contact_phone text,
  contact_email text,
  public_accreditation_summary text,
  active boolean not null default true,
  publish_public boolean not null default false,
  remark text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create table if not exists public.outlab_laboratory_owners (
  laboratory_id uuid not null references public.outlab_laboratories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  owner_role text not null default 'collaborator' check (owner_role in ('primary','collaborator')),
  primary key (laboratory_id, user_id)
);
create unique index if not exists outlab_one_primary_owner
  on public.outlab_laboratory_owners(laboratory_id) where owner_role = 'primary';

create table if not exists public.outlab_services (
  id uuid primary key default gen_random_uuid(),
  laboratory_id uuid not null references public.outlab_laboratories(id) on delete cascade,
  test_id bigint references public.tests(id),
  manual_test_name text,
  test_name_snapshot text not null,
  external_code text,
  method text,
  specimen text,
  transport_condition text,
  tat_text text,
  price numeric(12,2) check (price is null or price >= 0),
  is_primary boolean not null default false,
  active boolean not null default true,
  remark text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  check ((test_id is not null and manual_test_name is null) or (test_id is null and manual_test_name is not null and nullif(btrim(manual_test_name), '') is not null))
);
create index if not exists outlab_services_laboratory on public.outlab_services(laboratory_id);
create index if not exists outlab_services_test on public.outlab_services(test_id);
create unique index if not exists outlab_one_primary_catalog_service
  on public.outlab_services(test_id) where active and is_primary and test_id is not null;

create table if not exists public.outlab_certificates (
  id uuid primary key default gen_random_uuid(),
  laboratory_id uuid not null references public.outlab_laboratories(id) on delete cascade,
  standard_name text not null,
  accreditation_body text,
  certificate_no text,
  scope text,
  valid_from date,
  expires_on date not null,
  lifecycle text not null default 'current' check (lifecycle in ('current','superseded','revoked')),
  supersedes_id uuid references public.outlab_certificates(id),
  remark text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  check (valid_from is null or expires_on >= valid_from)
);
create index if not exists outlab_certificates_laboratory on public.outlab_certificates(laboratory_id);
create index if not exists outlab_certificates_expiry on public.outlab_certificates(expires_on) where lifecycle = 'current';

create table if not exists public.outlab_certificate_files (
  id uuid primary key default gen_random_uuid(),
  certificate_id uuid not null references public.outlab_certificates(id) on delete cascade,
  r2_key text not null unique,
  file_name text not null,
  content_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 20971520),
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid not null references public.profiles(id)
);

create table if not exists public.eqa_editors (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

create table if not exists public.eqa_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  short_name text,
  contact_name text,
  contact_phone text,
  contact_email text,
  active boolean not null default true,
  remark text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create table if not exists public.eqa_programs (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.eqa_providers(id),
  fiscal_year_be integer not null check (fiscal_year_be between 2500 and 3000),
  program_code text,
  name text not null,
  discipline text,
  program_type text not null check (program_type in ('eqa_pt','interlaboratory_comparison','alternative_assessment')),
  active boolean not null default true,
  remark text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  unique(provider_id, fiscal_year_be, name)
);
create index if not exists eqa_programs_fiscal_year on public.eqa_programs(fiscal_year_be);

create table if not exists public.eqa_program_owners (
  program_id uuid not null references public.eqa_programs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  owner_role text not null default 'collaborator' check (owner_role in ('primary','collaborator')),
  primary key(program_id, user_id)
);
create unique index if not exists eqa_one_primary_owner
  on public.eqa_program_owners(program_id) where owner_role = 'primary';

create table if not exists public.eqa_coverage_requirements (
  id uuid primary key default gen_random_uuid(),
  test_id bigint not null references public.tests(id) on delete cascade,
  fiscal_year_be integer not null check (fiscal_year_be between 2500 and 3000),
  mode text not null check (mode in ('required_eqa','alternative','not_applicable')),
  reason text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  unique(test_id, fiscal_year_be),
  check (mode = 'required_eqa' or (mode <> 'required_eqa' and nullif(btrim(reason), '') is not null))
);

create table if not exists public.eqa_program_tests (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.eqa_programs(id) on delete cascade,
  test_id bigint references public.tests(id),
  manual_test_name text,
  test_name_snapshot text not null,
  analyte_code text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  check ((test_id is not null and manual_test_name is null) or (test_id is null and manual_test_name is not null and nullif(btrim(manual_test_name), '') is not null))
);
create index if not exists eqa_program_tests_program on public.eqa_program_tests(program_id);

create table if not exists public.eqa_rounds (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.eqa_programs(id) on delete cascade,
  round_code text not null,
  expected_receipt_on date,
  received_on date,
  submission_due_on date not null,
  submitted_on date,
  report_received_on date,
  status text not null default 'planned' check (status in ('planned','received','submitted','reviewed','capa_open','closed')),
  note text,
  closed_at timestamptz,
  closed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  unique(program_id, round_code)
);
create index if not exists eqa_rounds_due on public.eqa_rounds(submission_due_on) where status <> 'closed';

create table if not exists public.eqa_round_results (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.eqa_rounds(id) on delete cascade,
  program_test_id uuid not null references public.eqa_program_tests(id),
  sample_code text not null default '',
  reported_value text,
  target_value text,
  z_score numeric,
  sdi numeric,
  score numeric,
  outcome text not null check (outcome in ('acceptable','unacceptable','not_evaluated')),
  reason text,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  unique(round_id, program_test_id, sample_code),
  check (outcome <> 'not_evaluated' or nullif(btrim(reason), '') is not null)
);

create table if not exists public.eqa_capas (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.eqa_rounds(id) on delete cascade,
  title text not null,
  root_cause text not null,
  immediate_correction text,
  corrective_action text not null,
  owner_id uuid not null references public.profiles(id),
  due_on date not null,
  status text not null default 'open' check (status in ('open','completed','verified')),
  completed_at timestamptz,
  completed_by uuid references public.profiles(id),
  effectiveness_result text,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);
create index if not exists eqa_capas_due on public.eqa_capas(due_on) where status <> 'verified';

create table if not exists public.eqa_capa_results (
  capa_id uuid not null references public.eqa_capas(id) on delete cascade,
  result_id uuid not null references public.eqa_round_results(id) on delete cascade,
  primary key(capa_id, result_id)
);

create table if not exists public.eqa_attachments (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references public.eqa_rounds(id) on delete cascade,
  capa_id uuid references public.eqa_capas(id) on delete cascade,
  attachment_kind text not null check (attachment_kind in ('provider_report','raw_result','capa_evidence','other')),
  r2_key text not null unique,
  file_name text not null,
  content_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 20971520),
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid not null references public.profiles(id),
  check ((round_id is not null)::integer + (capa_id is not null)::integer = 1)
);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'outlab_editors','outlab_laboratories','outlab_laboratory_owners','outlab_services',
    'outlab_certificates','outlab_certificate_files','eqa_editors','eqa_providers','eqa_programs',
    'eqa_program_owners','eqa_coverage_requirements','eqa_program_tests','eqa_rounds',
    'eqa_round_results','eqa_capas','eqa_capa_results','eqa_attachments'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_select', table_name);
    execute format('create policy %I on public.%I for select to authenticated using (true)', table_name || '_select', table_name);
    execute format('grant select on public.%I to authenticated', table_name);
  end loop;
end $$;

-- Preserve the editable public-manual partner list. Certificate dates/files are intentionally not invented.
with fallback(rows) as (values (jsonb_build_array(
  jsonb_build_object('sector','gov','name','สำนักงานป้องกันควบคุมโรคที่ 6 ชลบุรี','brand','DDC Region 6','accred','กรมควบคุมโรค'),
  jsonb_build_object('sector','gov','name','ศูนย์วิทยาศาสตร์การแพทย์ที่ 6 ชลบุรี','brand','RMSc 6','accred','กรมวิทยาศาสตร์การแพทย์'),
  jsonb_build_object('sector','gov','name','สถาบันชีววิทยาศาสตร์ทางการแพทย์','brand','MBI','accred','กรมวิทยาศาสตร์การแพทย์'),
  jsonb_build_object('sector','gov','name','โรงพยาบาลจุฬาลงกรณ์ (TSH and IEM)','brand','KCMH','accred','ISO 15189'),
  jsonb_build_object('sector','priv','name','บริษัท เนชั่นแนลเฮลท์แคร์ซิสเต็มส์ จำกัด','brand','N Health','accred','ISO 15189')
))), source as (
  select coalesce(
    (select table_data -> 'outlabPartners' from public.manual_sections where id = 'outlab'),
    (select rows from fallback)
  ) as rows
)
insert into public.outlab_laboratories(sector, name, brand, public_accreditation_summary, active, publish_public)
select case when item ->> 'sector' in ('gov','priv','other') then item ->> 'sector' else 'other' end,
       item ->> 'name', nullif(item ->> 'brand',''), nullif(item ->> 'accred',''), true, true
from source, lateral jsonb_array_elements(source.rows) item
where nullif(btrim(item ->> 'name'),'') is not null
on conflict(name) do update set
  sector = excluded.sector,
  brand = coalesce(excluded.brand, public.outlab_laboratories.brand),
  public_accreditation_summary = coalesce(excluded.public_accreditation_summary, public.outlab_laboratories.public_accreditation_summary);
