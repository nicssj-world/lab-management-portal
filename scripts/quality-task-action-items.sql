-- Action Items for meeting occurrences (quality_task_instances with task_kind = 'meeting')
-- Apply manually via Supabase Dashboard -> SQL Editor.

create table if not exists public.quality_task_action_items (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.quality_task_instances(id) on delete cascade,
  user_id uuid references public.profiles(id),
  manual_name text,
  description text not null check (nullif(trim(description), '') is not null),
  due_date date,
  done_at timestamptz,
  done_by uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id is not null or (manual_name is not null and trim(manual_name) <> '')),
  check ((done_at is null) = (done_by is null))
);

create index if not exists quality_task_action_items_instance_idx
  on public.quality_task_action_items(instance_id);

alter table public.quality_task_action_items enable row level security;
