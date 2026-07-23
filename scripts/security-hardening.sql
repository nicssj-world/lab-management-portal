-- Security hardening for deployments created from the historical SQL scripts.
-- Safe to run repeatedly in the Supabase SQL editor.
-- Application reads/writes for these tables use the server-side service role.

begin;

-- Self-service profile fields are updated by /api/me with an explicit allowlist.
-- Direct REST writes would otherwise allow a user to change role/doc_role/status.
drop policy if exists "profiles_self_update" on public.profiles;
revoke insert, update, delete on table public.profiles from anon, authenticated;

-- Permission rows disclose the complete authorization map and are only consumed
-- by server-side code.
do $$
begin
  if to_regclass('public.role_permissions') is not null then
    execute 'revoke select on table public.role_permissions from anon, authenticated';
    execute 'drop policy if exists role_permissions_select on public.role_permissions';
  end if;
end $$;

-- Health and confidentiality records contain sensitive personnel information.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'staff_health_records',
    'staff_confidentiality_agreements'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('drop policy if exists %I on public.%I', table_name || '_select', table_name);
      execute format('revoke select on table public.%I from anon, authenticated', table_name);
    end if;
  end loop;
end $$;

-- EQA/OUTLAB pages and APIs already authorize the actor on the server and use
-- service_role. Remove the historical "every authenticated account can read"
-- policies so a stolen/externally-created account cannot bypass that layer.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'outlab_editors','outlab_laboratories','outlab_laboratory_owners','outlab_services',
    'outlab_certificates','outlab_certificate_files','eqa_editors','eqa_providers','eqa_programs',
    'eqa_program_owners','eqa_coverage_requirements','eqa_program_tests','eqa_rounds',
    'eqa_round_results','eqa_capas','eqa_capa_results','eqa_attachments'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('drop policy if exists %I on public.%I', table_name || '_select', table_name);
      execute format('revoke select on table public.%I from anon, authenticated', table_name);
    end if;
  end loop;
end $$;

commit;

