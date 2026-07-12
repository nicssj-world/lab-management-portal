-- Quality Task meeting participants. Run in Supabase Dashboard -> SQL Editor.
-- Idempotent: uses IF NOT EXISTS.

alter table public.quality_task_templates
  add column if not exists default_participant_depts text[],
  add column if not exists default_participant_user_ids uuid[];

alter table public.quality_task_instances
  add column if not exists participant_depts text[],
  add column if not exists participant_user_ids uuid[];
