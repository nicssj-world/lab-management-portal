ALTER TABLE public.quality_task_instances
  ADD COLUMN IF NOT EXISTS meeting_location text,
  ADD COLUMN IF NOT EXISTS meeting_agenda text;
