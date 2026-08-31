BEGIN;

-- Keep imported holidays distinguishable from administrator-entered overrides.
ALTER TABLE public.quality_task_holidays
  ADD COLUMN IF NOT EXISTS source text;

UPDATE public.quality_task_holidays
SET source = 'manual'
WHERE source IS NULL;

ALTER TABLE public.quality_task_holidays
  ALTER COLUMN source SET DEFAULT 'manual',
  ALTER COLUMN source SET NOT NULL;

ALTER TABLE public.quality_task_holidays
  ADD COLUMN IF NOT EXISTS source_event_id text,
  ADD COLUMN IF NOT EXISTS synced_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'quality_task_holidays_source_check'
      AND conrelid = 'public.quality_task_holidays'::regclass
  ) THEN
    ALTER TABLE public.quality_task_holidays
      ADD CONSTRAINT quality_task_holidays_source_check
      CHECK (source IN ('manual', 'google_th_holidays'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS quality_task_holidays_google_source_idx
  ON public.quality_task_holidays (source, source_event_id)
  WHERE source = 'google_th_holidays';

NOTIFY pgrst, 'reload schema';
COMMIT;
