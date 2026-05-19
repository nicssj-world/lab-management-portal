-- ============================================================
-- Lab Management Portal — Supabase SQL Migration
-- Run this entire file in Supabase SQL Editor (once)
-- ============================================================

-- ── Profiles ──────────────────────────────────────────────────────────────
create table profiles (
  id         uuid primary key references auth.users on delete cascade,
  name       text not null,
  role       text not null default 'viewer' check (role in ('admin','staff','viewer','editor')),
  dept       text,
  status     text not null default 'active' check (status in ('active','inactive','pending')),
  created_at timestamptz default now()
);

-- ── Lab content ───────────────────────────────────────────────────────────
create table categories (
  id         text primary key,
  th         text not null,
  en         text not null,
  color      text not null,
  icon       text not null,
  sort_order int  not null default 0,
  active     boolean not null default true,
  created_at timestamptz default now()
);

create table tests (
  id           bigint generated always as identity primary key,
  code         text unique not null,
  cgd          text,
  loinc        text,
  th           text not null,
  en           text not null,
  category_id  text references categories(id),
  tube         text,
  volume       text,
  method       text,
  tat          text,
  tat_hours    int,
  service      text,
  price        numeric(10,2),
  ref          text,
  stability    text,
  reject       text,
  priority     text default 'Routine',
  popular      boolean default false,
  active       boolean default true,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create table documents (
  id           bigint generated always as identity primary key,
  cat          text not null,
  name         text not null,
  code         text unique not null,
  rev          text,
  date         date,
  size_mb      numeric(6,2),
  public       boolean default false,
  owner        text,
  storage_path text,
  created_at   timestamptz default now()
);

create table news (
  id          bigint generated always as identity primary key,
  title       text not null,
  excerpt     text,
  body        text,
  category    text,
  cat         text,
  author      text,
  published   boolean default false,
  is_new      boolean default false,
  new_until   date,
  image_path  text,
  pdf_path    text,
  views       int default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table risks (
  id          bigint generated always as identity primary key,
  name        text not null,
  likelihood  int check (likelihood between 1 and 5),
  impact      int check (impact between 1 and 5),
  level       text check (level in ('low','medium','high')),
  owner       text,
  status      text check (status in ('open','mitigating','monitoring','closed')),
  created_at  timestamptz default now()
);

create table contracts (
  id          bigint generated always as identity primary key,
  vendor      text not null,
  product     text not null,
  total       numeric(15,2),
  start_date  date,
  end_date    date,
  unit        text,
  status      text default 'active' check (status in ('active','expired','cancelled','pending')),
  created_at  timestamptz default now()
);

create table contract_usage (
  id           bigint generated always as identity primary key,
  contract_id  bigint references contracts(id) on delete cascade,
  amount       numeric(15,2) not null,
  note         text,
  recorded_by  text,
  usage_date   date,
  created_at   timestamptz default now()
);

create table rejection_log (
  id          bigint generated always as identity primary key,
  ref_no      text unique not null,
  test_code   text,
  reason      text,
  dept        text,
  logged_by   text,
  severity    text check (severity in ('low','medium','high')),
  logged_at   timestamptz default now()
);

create table audit_log (
  id          bigint generated always as identity primary key,
  action      text not null,
  user_id     uuid references auth.users,
  target      text,
  detail      text,
  created_at  timestamptz default now()
);

-- ── TAT ───────────────────────────────────────────────────────────────────
create table tat_import_batches (
  id           bigint generated always as identity primary key,
  filename     text not null,
  row_count    int not null default 0,
  fiscal_year  int not null,
  month        int not null check (month between 1 and 12),
  imported_by  uuid references auth.users,
  created_at   timestamptz default now()
);

create table tat_entries (
  id              bigint generated always as identity primary key,
  batch_id        bigint references tat_import_batches(id) on delete cascade,
  lab_number      text,
  test_code       text,
  test_name       text,
  dept_code       text,
  received_at     timestamptz not null,
  resulted_at     timestamptz not null check (resulted_at >= received_at),
  tat_minutes     int generated always as
                    (extract(epoch from (resulted_at - received_at)) / 60)::int stored,
  fiscal_year     int not null,
  month           int not null check (month between 1 and 12)
);

create index idx_tat_year_month on tat_entries(fiscal_year, month);
create index idx_tat_dept      on tat_entries(dept_code);
create index idx_tat_received  on tat_entries(received_at);

-- ── Workload ──────────────────────────────────────────────────────────────
create table workload_departments (
  id      bigint generated always as identity primary key,
  name    text not null,
  code    text unique not null,
  color   text not null default '#1E5FAD'
);

create table workload_tests (
  id          bigint generated always as identity primary key,
  dept_id     bigint references workload_departments(id) on delete cascade,
  ephis_code  text not null,
  test_name   text not null,
  price       numeric(12,2)
);

create table workload_entries (
  id            bigint generated always as identity primary key,
  test_id       bigint references workload_tests(id) on delete cascade,
  fiscal_year   int not null,
  month         int not null check (month between 1 and 12),
  in_time_count int not null default 0 check (in_time_count >= 0),
  total_count   int not null default 0 check (total_count >= 0),
  constraint chk_in_time check (in_time_count <= total_count),
  unique (test_id, fiscal_year, month)
);

-- ── KPI ───────────────────────────────────────────────────────────────────
create table departments (
  id          bigint generated always as identity primary key,
  code        text unique not null,
  name_th     text not null,
  is_active   boolean default true
);

create table kpi_definitions (
  id          bigint generated always as identity primary key,
  code        text unique not null,
  category    text not null,
  sub_code    text,
  name_th     text not null,
  unit        text,
  target_type text check (target_type in ('gte','lte','eq')),
  target_val  numeric(10,2),
  sort_order  int default 0
);

create table kpi_entries (
  id           bigint generated always as identity primary key,
  dept_id      bigint references departments(id),
  kpi_id       bigint references kpi_definitions(id),
  fiscal_year  int not null,
  month        int not null check (month between 1 and 12),
  numerator    numeric(12,4),
  denominator  numeric(12,4),
  result_pct   numeric(8,2),
  unique (dept_id, kpi_id, fiscal_year, month)
);

create table satisfaction_entries (
  id           bigint generated always as identity primary key,
  dept_code    text not null,
  name_th      text not null,
  fiscal_year  int not null,
  result_pct   numeric(8,2),
  target_val   numeric(8,2)
);

-- ── KPI View ──────────────────────────────────────────────────────────────
create or replace view vw_kpi_dashboard as
select d.code as dept_code, d.name_th as dept_name,
       k.code as kpi_code, k.category, k.sub_code, k.name_th as kpi_name,
       k.target_type, k.target_val, k.unit,
       e.fiscal_year, e.month, e.numerator, e.denominator, e.result_pct,
       case
         when k.target_type = 'eq'  then case when e.numerator is null then null::boolean else (e.numerator = 0) end
         when e.result_pct is null  then null
         when k.target_type = 'gte' then e.result_pct >= k.target_val
         when k.target_type = 'lte' then e.result_pct <= k.target_val
         else false
       end as is_pass
from kpi_entries e
join departments d on d.id = e.dept_id
join kpi_definitions k on k.id = e.kpi_id;

-- ============================================================
-- RLS
-- ============================================================

alter table profiles          enable row level security;
alter table categories        enable row level security;
alter table tests             enable row level security;
alter table documents         enable row level security;
alter table news              enable row level security;
alter table risks             enable row level security;
alter table contracts         enable row level security;
alter table contract_usage    enable row level security;
alter table rejection_log     enable row level security;
alter table audit_log         enable row level security;
alter table tat_import_batches enable row level security;
alter table tat_entries       enable row level security;
alter table workload_departments enable row level security;
alter table workload_tests    enable row level security;
alter table workload_entries  enable row level security;
alter table departments       enable row level security;
alter table kpi_definitions   enable row level security;
alter table kpi_entries       enable row level security;
alter table satisfaction_entries enable row level security;

-- categories
create policy "categories_public_read" on categories for select using (true);
create policy "categories_admin_write" on categories for all using (
  (select role from profiles where id = auth.uid()) = 'admin'
);

-- tests
create policy "tests_public_read" on tests for select using (true);
create policy "tests_staff_write" on tests for all using (
  (select role from profiles where id = auth.uid()) in ('staff','admin')
);

-- documents
create policy "documents_public_read" on documents
  for select using (public = true or auth.role() != 'anon');
create policy "documents_staff_write" on documents for all using (
  (select role from profiles where id = auth.uid()) in ('staff','admin')
);

-- news
create policy "news_public_read" on news
  for select using (published = true or auth.role() != 'anon');
create policy "news_staff_write" on news for all using (
  (select role from profiles where id = auth.uid()) in ('staff','admin')
);

-- risks
create policy "risks_auth_read" on risks for select using (auth.role() != 'anon');
create policy "risks_staff_write" on risks for all using (
  (select role from profiles where id = auth.uid()) in ('staff','admin')
);

-- contracts
create policy "contracts_auth_read" on contracts for select using (auth.role() != 'anon');
create policy "contracts_staff_write" on contracts for all using (
  (select role from profiles where id = auth.uid()) in ('staff','admin')
);

-- contract_usage
create policy "contract_usage_auth_read" on contract_usage for select using (auth.role() != 'anon');
create policy "contract_usage_staff_write" on contract_usage for all using (
  (select role from profiles where id = auth.uid()) in ('staff','admin')
);

-- rejection_log
create policy "rejection_log_auth_read" on rejection_log for select using (auth.role() != 'anon');
create policy "rejection_log_staff_write" on rejection_log for all using (
  (select role from profiles where id = auth.uid()) in ('staff','admin')
);

-- profiles
create policy "profiles_read" on profiles for select using (
  id = auth.uid() or (select role from profiles where id = auth.uid()) = 'admin'
);
create policy "profiles_self_update" on profiles for update using (id = auth.uid());
create policy "profiles_admin_write" on profiles for insert with check (
  (select role from profiles where id = auth.uid()) = 'admin'
);

-- audit_log
create policy "audit_log_admin_read" on audit_log for select using (
  (select role from profiles where id = auth.uid()) = 'admin'
);

-- workload
create policy "workload_depts_auth_read" on workload_departments for select using (auth.role() != 'anon');
create policy "workload_depts_admin_write" on workload_departments for all using (
  (select role from profiles where id = auth.uid()) = 'admin'
);
create policy "workload_tests_auth_read" on workload_tests for select using (auth.role() != 'anon');
create policy "workload_tests_admin_write" on workload_tests for all using (
  (select role from profiles where id = auth.uid()) = 'admin'
);
create policy "workload_entries_auth_read" on workload_entries for select using (auth.role() != 'anon');
create policy "workload_entries_editor_write" on workload_entries for all using (
  (select role from profiles where id = auth.uid()) in ('editor','admin')
);

-- KPI
create policy "departments_auth_read" on departments for select using (auth.role() != 'anon');
create policy "departments_admin_write" on departments for all using (
  (select role from profiles where id = auth.uid()) = 'admin'
);
create policy "kpi_definitions_auth_read" on kpi_definitions for select using (auth.role() != 'anon');
create policy "kpi_definitions_admin_write" on kpi_definitions for all using (
  (select role from profiles where id = auth.uid()) = 'admin'
);
create policy "kpi_entries_auth_read" on kpi_entries for select using (auth.role() != 'anon');
create policy "kpi_entries_staff_write" on kpi_entries for all using (
  (select role from profiles where id = auth.uid()) in ('staff','admin')
);
create policy "satisfaction_entries_auth_read" on satisfaction_entries for select using (auth.role() != 'anon');
create policy "satisfaction_entries_staff_write" on satisfaction_entries for all using (
  (select role from profiles where id = auth.uid()) in ('staff','admin')
);

-- TAT
create policy "tat_batches_auth_read" on tat_import_batches for select using (auth.role() != 'anon');
create policy "tat_batches_staff_write" on tat_import_batches for all using (
  (select role from profiles where id = auth.uid()) in ('staff','admin')
);
create policy "tat_entries_auth_read" on tat_entries for select using (auth.role() != 'anon');
create policy "tat_entries_staff_write" on tat_entries for all using (
  (select role from profiles where id = auth.uid()) in ('staff','admin')
);

-- ============================================================
-- Enable Realtime (run in Supabase dashboard → Replication)
-- workload_entries and tat_entries
-- ============================================================
