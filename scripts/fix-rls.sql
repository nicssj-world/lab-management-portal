create or replace function get_my_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from profiles where id = auth.uid()
$$;

drop policy if exists "profiles_read" on profiles;
drop policy if exists "profiles_admin_read" on profiles;

create policy "profiles_read" on profiles
  for select using (id = auth.uid());

create policy "profiles_admin_read" on profiles
  for select using (get_my_role() = 'admin');

drop policy if exists "categories_admin_write" on categories;
create policy "categories_admin_write" on categories for all
  using (get_my_role() = 'admin');

drop policy if exists "tests_staff_write" on tests;
create policy "tests_staff_write" on tests for all
  using (get_my_role() in ('staff','admin'));

drop policy if exists "documents_staff_write" on documents;
create policy "documents_staff_write" on documents for all
  using (get_my_role() in ('staff','admin'));

drop policy if exists "news_staff_write" on news;
create policy "news_staff_write" on news for all
  using (get_my_role() in ('staff','admin'));

drop policy if exists "risks_staff_write" on risks;
create policy "risks_staff_write" on risks for all
  using (get_my_role() in ('staff','admin'));

drop policy if exists "contracts_staff_write" on contracts;
create policy "contracts_staff_write" on contracts for all
  using (get_my_role() in ('staff','admin'));

drop policy if exists "contract_usage_staff_write" on contract_usage;
create policy "contract_usage_staff_write" on contract_usage for all
  using (get_my_role() in ('staff','admin'));

drop policy if exists "rejection_log_staff_write" on rejection_log;
create policy "rejection_log_staff_write" on rejection_log for all
  using (get_my_role() in ('staff','admin'));

drop policy if exists "audit_log_admin_read" on audit_log;
create policy "audit_log_admin_read" on audit_log for select
  using (get_my_role() = 'admin');

drop policy if exists "workload_depts_admin_write" on workload_departments;
create policy "workload_depts_admin_write" on workload_departments for all
  using (get_my_role() = 'admin');

drop policy if exists "workload_tests_admin_write" on workload_tests;
create policy "workload_tests_admin_write" on workload_tests for all
  using (get_my_role() = 'admin');

drop policy if exists "workload_entries_editor_write" on workload_entries;
create policy "workload_entries_editor_write" on workload_entries for all
  using (get_my_role() in ('editor','admin'));

drop policy if exists "departments_admin_write" on departments;
create policy "departments_admin_write" on departments for all
  using (get_my_role() = 'admin');

drop policy if exists "kpi_definitions_admin_write" on kpi_definitions;
create policy "kpi_definitions_admin_write" on kpi_definitions for all
  using (get_my_role() = 'admin');

drop policy if exists "kpi_entries_staff_write" on kpi_entries;
create policy "kpi_entries_staff_write" on kpi_entries for all
  using (get_my_role() in ('staff','admin'));

drop policy if exists "satisfaction_entries_staff_write" on satisfaction_entries;
create policy "satisfaction_entries_staff_write" on satisfaction_entries for all
  using (get_my_role() in ('staff','admin'));

drop policy if exists "tat_batches_staff_write" on tat_import_batches;
create policy "tat_batches_staff_write" on tat_import_batches for all
  using (get_my_role() in ('staff','admin'));

drop policy if exists "tat_entries_staff_write" on tat_entries;
create policy "tat_entries_staff_write" on tat_entries for all
  using (get_my_role() in ('staff','admin'));

drop policy if exists "profiles_self_update" on profiles;
create policy "profiles_self_update" on profiles for update
  using (id = auth.uid());

drop policy if exists "profiles_admin_write" on profiles;
create policy "profiles_admin_write" on profiles for insert
  with check (get_my_role() = 'admin');
