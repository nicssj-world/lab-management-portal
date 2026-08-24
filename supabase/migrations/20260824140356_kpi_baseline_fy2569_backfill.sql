-- Seed the agreed compliance baseline for FY2569.
--
-- July 2569 is the one-month baseline immediately before the tracking rollout.
-- Its historical compliance is intentionally treated as on time for every
-- active department, with one shared audit timestamp supplied by the business.
-- Keep the measured KPI progress untouched: this migration changes only the
-- compliance history fields, not KPI entry values or filled_count.

DO $$
DECLARE
  settings_row public.kpi_submission_settings%ROWTYPE;
  department_row record;
BEGIN
  SELECT * INTO settings_row
  FROM public.kpi_submission_settings
  WHERE id = true;

  IF settings_row.baseline_fiscal_year <> 2569
     OR settings_row.baseline_month <> 7 THEN
    RAISE EXCEPTION
      'Expected FY2569 month 7 baseline, found FY% month %',
      settings_row.baseline_fiscal_year,
      settings_row.baseline_month;
  END IF;

  FOR department_row IN
    SELECT id
    FROM public.departments
    WHERE is_active IS DISTINCT FROM false
  LOOP
    PERFORM public.ensure_kpi_submission_period(department_row.id, 2569, 7);
  END LOOP;
END;
$$;

UPDATE public.kpi_submission_periods
SET status = 'on_time',
    status_source = 'baseline',
    first_completed_at = '2026-08-24 13:31:00+00'::timestamptz,
    updated_at = now()
WHERE fiscal_year = 2569
  AND month = 7;
