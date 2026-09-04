-- Allow overlapping Quality meetings when they use different locations.
-- Run once in Supabase SQL Editor for databases created from the manual scripts.

CREATE OR REPLACE FUNCTION public.guard_quality_task_meeting_slot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_start_date date;
  new_end_date date;
  is_quality_meeting boolean;
BEGIN
  IF NEW.planned_date IS NULL OR NEW.note = '__quality_task_cancelled__' THEN
    RETURN NEW;
  END IF;

  SELECT t.task_kind = 'meeting' AND t.workstream = 'quality'
  INTO is_quality_meeting
  FROM public.quality_task_templates AS t
  WHERE t.id = NEW.template_id;

  IF COALESCE(is_quality_meeting, false) IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  new_start_date := NEW.planned_date;
  IF NEW.schedule_id IS NULL
     AND NEW.period_end > NEW.period_start
     AND NEW.period_end >= NEW.planned_date THEN
    new_end_date := NEW.period_end;
  ELSE
    new_end_date := NEW.planned_date;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('quality-task:meeting-slot', 0)
  );

  IF EXISTS (
    SELECT 1
    FROM public.quality_task_instances AS existing
    JOIN public.quality_task_templates AS existing_template
      ON existing_template.id = existing.template_id
    WHERE existing.id <> NEW.id
      AND existing_template.task_kind = 'meeting'
      AND existing_template.workstream = 'quality'
      AND existing.planned_date IS NOT NULL
      AND existing.note IS DISTINCT FROM '__quality_task_cancelled__'
      AND existing.planned_date <=
        CASE
          WHEN existing.schedule_id IS NULL
               AND existing.period_end > existing.period_start
               AND existing.period_end >= existing.planned_date
            THEN existing.period_end
          ELSE existing.planned_date
        END
      AND existing.planned_date <= new_end_date
      AND new_start_date <=
        CASE
          WHEN existing.schedule_id IS NULL
               AND existing.period_end > existing.period_start
               AND existing.period_end >= existing.planned_date
            THEN existing.period_end
          ELSE existing.planned_date
        END
      AND (
        NEW.planned_start_time IS NULL
        OR NEW.planned_end_time IS NULL
        OR existing.planned_start_time IS NULL
        OR existing.planned_end_time IS NULL
        OR (
          NEW.planned_start_time < existing.planned_end_time
          AND existing.planned_start_time < NEW.planned_end_time
        )
      )
      AND (
        NULLIF(pg_catalog.btrim(NEW.meeting_location), ''::text) IS NULL
        OR NULLIF(pg_catalog.btrim(existing.meeting_location), ''::text) IS NULL
        OR pg_catalog.lower(pg_catalog.btrim(NEW.meeting_location)) =
          pg_catalog.lower(pg_catalog.btrim(existing.meeting_location))
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23P01',
      MESSAGE = 'สถานที่และช่วงเวลาดังกล่าวมีประชุมแล้ว';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_quality_task_meeting_slot
  ON public.quality_task_instances;
CREATE TRIGGER guard_quality_task_meeting_slot
BEFORE INSERT OR UPDATE OF template_id, schedule_id, period_start, period_end,
  planned_date, planned_start_time, planned_end_time, meeting_location, note
ON public.quality_task_instances
FOR EACH ROW
EXECUTE FUNCTION public.guard_quality_task_meeting_slot();

REVOKE ALL ON FUNCTION public.guard_quality_task_meeting_slot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_quality_task_meeting_slot() TO service_role;

NOTIFY pgrst, 'reload schema';
