-- Allow a Quality owner to open a QR check-in window early when a meeting starts ahead of schedule.
ALTER TABLE public.quality_task_instances
  ADD COLUMN IF NOT EXISTS check_in_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS check_in_opened_by uuid REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS quality_task_instances_check_in_opened_at
  ON public.quality_task_instances(check_in_opened_at)
  WHERE check_in_opened_at IS NOT NULL;

NOTIFY pgrst, 'reload schema';
