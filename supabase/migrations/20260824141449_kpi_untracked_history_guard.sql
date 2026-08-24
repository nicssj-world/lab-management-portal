-- Compliance history starts at the configured tracking period. Numeric KPI
-- history may still be edited for older months, but those edits must never
-- create a first-completion event in the monitoring view.
CREATE OR REPLACE FUNCTION public.keep_untracked_kpi_submission_history_empty()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  settings_row public.kpi_submission_settings%ROWTYPE;
BEGIN
  SELECT * INTO settings_row
  FROM public.kpi_submission_settings
  WHERE id = true;

  IF settings_row.id IS TRUE
     AND public.kpi_fiscal_period_key(NEW.fiscal_year, NEW.month)
       < public.kpi_fiscal_period_key(
           settings_row.tracking_start_fiscal_year,
           settings_row.tracking_start_month
         ) THEN
    NEW.first_completed_at := NULL;
    NEW.first_completed_by := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS keep_untracked_kpi_submission_history_empty
  ON public.kpi_submission_periods;

CREATE TRIGGER keep_untracked_kpi_submission_history_empty
BEFORE INSERT OR UPDATE ON public.kpi_submission_periods
FOR EACH ROW
EXECUTE FUNCTION public.keep_untracked_kpi_submission_history_empty();

REVOKE ALL ON FUNCTION public.keep_untracked_kpi_submission_history_empty() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.keep_untracked_kpi_submission_history_empty() TO service_role;

-- Remove any first-completion values that may have been created before this
-- guard existed. Last-entry history and numeric values are intentionally kept.
UPDATE public.kpi_submission_periods
SET first_completed_at = NULL,
    first_completed_by = NULL,
    updated_at = now()
WHERE fiscal_year = 2569
  AND status = 'not_tracked'
  AND (
    month BETWEEN 1 AND 6
    OR month BETWEEN 10 AND 12
  );
