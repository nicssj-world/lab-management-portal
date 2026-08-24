-- Reconcile all matrix cells in one server/database round trip. The caller
-- passes the already-authorized department scope; this function never exposes
-- itself to browser roles.
CREATE OR REPLACE FUNCTION public.reconcile_kpi_submission_periods_bulk(
  p_fiscal_year integer,
  p_dept_ids bigint[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  settings_row public.kpi_submission_settings%ROWTYPE;
  department_id bigint;
  fiscal_month integer;
  period_id bigint;
  existing_required_count integer;
  current_calendar_year integer;
  current_month integer;
  current_fiscal_year integer;
  current_period_key integer;
  tracking_start_key integer;
  baseline_key integer;
  period_key integer;
BEGIN
  IF p_fiscal_year NOT BETWEEN 2500 AND 3000 THEN
    RAISE EXCEPTION 'Invalid KPI fiscal year';
  END IF;

  IF p_dept_ids IS NULL OR cardinality(p_dept_ids) = 0 THEN
    RAISE EXCEPTION 'At least one KPI department is required';
  END IF;

  SELECT * INTO settings_row
  FROM public.kpi_submission_settings
  WHERE id = true;

  current_calendar_year := extract(year FROM (now() AT TIME ZONE 'Asia/Bangkok'))::integer;
  current_month := extract(month FROM (now() AT TIME ZONE 'Asia/Bangkok'))::integer;
  current_fiscal_year := CASE
    WHEN current_month >= 10 THEN current_calendar_year + 544
    ELSE current_calendar_year + 543
  END;
  current_period_key := public.kpi_fiscal_period_key(current_fiscal_year, current_month);
  tracking_start_key := public.kpi_fiscal_period_key(
    settings_row.tracking_start_fiscal_year,
    settings_row.tracking_start_month
  );
  baseline_key := public.kpi_fiscal_period_key(
    settings_row.baseline_fiscal_year,
    settings_row.baseline_month
  );

  FOREACH department_id IN ARRAY p_dept_ids LOOP
    FOREACH fiscal_month IN ARRAY ARRAY[10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9] LOOP
      period_key := public.kpi_fiscal_period_key(p_fiscal_year, fiscal_month);
      SELECT period.id, period.required_count
      INTO period_id, existing_required_count
      FROM public.kpi_submission_periods AS period
      WHERE period.dept_id = department_id
        AND period.fiscal_year = p_fiscal_year
        AND period.month = fiscal_month;

      -- Existing historical snapshots are already kept current by the atomic
      -- save RPC. Reconcile only tracked/future periods, or a period that is
      -- missing its snapshot/count for the first time.
      IF period_id IS NULL
         OR existing_required_count = 0
         OR period_key = baseline_key
         OR period_key >= tracking_start_key THEN
        PERFORM public.reconcile_kpi_submission_period(
          department_id,
          p_fiscal_year,
          fiscal_month,
          NULL
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_kpi_submission_periods_bulk(integer, bigint[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_kpi_submission_periods_bulk(integer, bigint[]) TO service_role;
