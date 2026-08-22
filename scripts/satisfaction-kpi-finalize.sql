-- Run only after every existing satisfaction campaign has been reviewed and
-- assigned its fiscal year, department, and KPI metric. The preflight raises
-- an exception before any constraint changes if even one campaign is incomplete.

BEGIN;

DO $$
DECLARE
  incomplete_campaigns text;
BEGIN
  SELECT string_agg(id::text, ', ' ORDER BY id::text)
  INTO incomplete_campaigns
  FROM public.survey_campaigns
  WHERE fiscal_year IS NULL
     OR department_id IS NULL
     OR kpi_metric_code IS NULL;

  IF incomplete_campaigns IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot finalize satisfaction campaign constraints. Incomplete campaign IDs: %',
      incomplete_campaigns;
  END IF;
END;
$$;

ALTER TABLE public.survey_campaigns
  ALTER COLUMN fiscal_year SET NOT NULL,
  ALTER COLUMN department_id SET NOT NULL,
  ALTER COLUMN kpi_metric_code SET NOT NULL;

COMMIT;
