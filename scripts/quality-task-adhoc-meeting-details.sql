-- Optional details for one-off quality-task meetings.
-- Run once in Supabase SQL Editor for databases created from the manual scripts.

ALTER TABLE public.quality_task_instances
  ADD COLUMN IF NOT EXISTS meeting_location text,
  ADD COLUMN IF NOT EXISTS meeting_agenda text;
