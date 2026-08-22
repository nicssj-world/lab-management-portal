-- Legacy KPI screens created one row per metric/year even when there was no
-- result. The redesigned workflow represents "missing" by the absence of a
-- row, so these placeholders must not reserve a campaign KPI slot.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.kpi_satisfaction AS value
    JOIN public.survey_kpi_publications AS publication
      ON publication.metric_code = value.metric_code
     AND publication.fiscal_year = value.fiscal_year
    WHERE value.value IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot remove an empty KPI row backed by a survey publication';
  END IF;
END;
$$;

DELETE FROM public.kpi_satisfaction AS value
WHERE value.value IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.survey_kpi_publications AS publication
    WHERE publication.metric_code = value.metric_code
      AND publication.fiscal_year = value.fiscal_year
  );

ALTER TABLE public.kpi_satisfaction
  ALTER COLUMN value SET NOT NULL;

-- Keep the reservation guard semantically correct during a rolling rollout.
-- After this migration the value predicate is redundant, but it documents the
-- boundary: only a real result, never an empty legacy row, owns the slot.
CREATE OR REPLACE FUNCTION public.guard_satisfaction_campaign_metric_slot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.kpi_metric_code IS NULL OR NEW.fiscal_year IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('satisfaction-kpi:' || NEW.kpi_metric_code || ':' || NEW.fiscal_year::text, 0)
  );

  IF EXISTS (
    SELECT 1
    FROM public.kpi_satisfaction AS value
    WHERE value.metric_code = NEW.kpi_metric_code
      AND value.fiscal_year = NEW.fiscal_year
      AND value.value IS NOT NULL
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.survey_kpi_publications AS publication
    WHERE publication.campaign_id = NEW.id
      AND publication.metric_code = NEW.kpi_metric_code
      AND publication.fiscal_year = NEW.fiscal_year
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'KPI metric/year already has a value';
  END IF;

  RETURN NEW;
END;
$$;
