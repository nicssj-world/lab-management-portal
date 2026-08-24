-- Older FY2569 periods are outside the compliance tracking window.
-- Keep their actual KPI and last-edit history, but do not present a
-- first-completion event for periods that were never tracked.
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
