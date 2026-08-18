-- Add optional start/end times for quality-task meetings.
-- Run once in Supabase SQL Editor for databases created from the manual scripts.

ALTER TABLE public.quality_task_instances
  ADD COLUMN IF NOT EXISTS planned_start_time time,
  ADD COLUMN IF NOT EXISTS planned_end_time time;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'quality_task_instances_planned_time_check'
      AND conrelid = 'public.quality_task_instances'::regclass
  ) THEN
    ALTER TABLE public.quality_task_instances
      ADD CONSTRAINT quality_task_instances_planned_time_check
      CHECK (
        (planned_start_time IS NULL AND planned_end_time IS NULL)
        OR (
          planned_start_time IS NOT NULL
          AND planned_end_time IS NOT NULL
          AND planned_end_time > planned_start_time
        )
      );
  END IF;
END $$;
