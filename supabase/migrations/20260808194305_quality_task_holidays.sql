BEGIN;

CREATE TABLE IF NOT EXISTS public.quality_task_holidays (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date  date NOT NULL UNIQUE,
  name          text NOT NULL CHECK (NULLIF(btrim(name), '') IS NOT NULL),
  kind          text NOT NULL DEFAULT 'public' CHECK (kind IN ('public', 'special')),
  created_by    uuid REFERENCES public.profiles(id),
  updated_by    uuid REFERENCES public.profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quality_task_holidays_date
  ON public.quality_task_holidays(holiday_date);

ALTER TABLE public.quality_task_holidays ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quality_task_holidays FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_task_holidays TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
