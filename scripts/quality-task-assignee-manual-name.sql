-- Quality Task assignees: allow a manual (non-system) name alongside/instead of a linked
-- user, matching the equipment registry's "dropdown or type a name" pattern.
-- Run in Supabase Dashboard -> SQL Editor. Idempotent: safe to re-run.

alter table public.quality_task_default_assignees
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists manual_name text,
  alter column user_id drop not null;
update public.quality_task_default_assignees set id = gen_random_uuid() where id is null;
alter table public.quality_task_default_assignees alter column id set not null;
alter table public.quality_task_default_assignees drop constraint if exists quality_task_default_assignees_pkey;
alter table public.quality_task_default_assignees add primary key (id);
alter table public.quality_task_default_assignees drop constraint if exists quality_task_default_assignees_entry_check;
alter table public.quality_task_default_assignees add constraint quality_task_default_assignees_entry_check
  check (user_id is not null or (manual_name is not null and trim(manual_name) <> ''));
create unique index if not exists quality_task_default_assignees_template_user
  on public.quality_task_default_assignees(template_id, user_id) where user_id is not null;

alter table public.quality_task_instance_assignees
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists manual_name text,
  alter column user_id drop not null;
update public.quality_task_instance_assignees set id = gen_random_uuid() where id is null;
alter table public.quality_task_instance_assignees alter column id set not null;
alter table public.quality_task_instance_assignees drop constraint if exists quality_task_instance_assignees_pkey;
alter table public.quality_task_instance_assignees add primary key (id);
alter table public.quality_task_instance_assignees drop constraint if exists quality_task_instance_assignees_entry_check;
alter table public.quality_task_instance_assignees add constraint quality_task_instance_assignees_entry_check
  check (user_id is not null or (manual_name is not null and trim(manual_name) <> ''));
create unique index if not exists quality_task_instance_assignees_instance_user
  on public.quality_task_instance_assignees(instance_id, user_id) where user_id is not null;
