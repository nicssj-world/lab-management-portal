-- July 2569 is the start of the operational workflow for the baseline.
-- Preserve the agreed completion timestamp for jobs that were complete, but
-- keep incomplete jobs as missed and without a first-completion event.
UPDATE public.kpi_submission_settings
SET tracking_start_month = 7,
    updated_at = now()
WHERE id = true
  AND tracking_start_fiscal_year = 2569;

UPDATE public.kpi_submission_periods
SET status = CASE
      WHEN required_count = 0 THEN 'not_applicable'
      WHEN filled_count >= required_count THEN 'on_time'
      ELSE 'missed'
    END,
    status_source = CASE
      WHEN required_count > 0 AND filled_count < required_count THEN 'live'
      ELSE 'baseline'
    END,
    first_completed_at = CASE
      WHEN required_count > 0 AND filled_count >= required_count
        THEN '2026-08-24 13:31:00+00'::timestamptz
      WHEN first_completed_at = '2026-08-24 13:31:00+00'::timestamptz
        THEN NULL
      ELSE first_completed_at
    END,
    first_completed_by = CASE
      WHEN required_count > 0 AND filled_count >= required_count
        THEN first_completed_by
      WHEN first_completed_at = '2026-08-24 13:31:00+00'::timestamptz
        THEN NULL
      ELSE first_completed_by
    END,
    updated_at = now()
WHERE fiscal_year = 2569
  AND month = 7;
