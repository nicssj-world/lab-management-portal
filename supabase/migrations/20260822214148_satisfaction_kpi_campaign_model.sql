-- Satisfaction KPI metric master and annual campaign metadata.
-- This migration is additive: existing KPI labels/targets, campaign tokens,
-- survey versions, and submitted responses remain unchanged.

CREATE TABLE IF NOT EXISTS public.kpi_satisfaction_metrics (
  code text PRIMARY KEY,
  name text NOT NULL,
  target numeric NOT NULL DEFAULT 80,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kpi_satisfaction_metrics_name_nonempty
    CHECK (btrim(name) <> ''),
  CONSTRAINT kpi_satisfaction_metrics_target_range
    CHECK (target BETWEEN 0 AND 100)
);

-- Preserve every legacy metric code exactly. The label comes from the latest
-- fiscal year; the target comes from the latest year that has a target.
WITH latest_names AS (
  SELECT DISTINCT ON (metric_code)
    metric_code,
    metric_name
  FROM public.kpi_satisfaction
  WHERE metric_code IS NOT NULL
  ORDER BY metric_code, fiscal_year DESC, id DESC
),
latest_targets AS (
  SELECT DISTINCT ON (metric_code)
    metric_code,
    target_val
  FROM public.kpi_satisfaction
  WHERE target_val IS NOT NULL
  ORDER BY metric_code, fiscal_year DESC, id DESC
)
INSERT INTO public.kpi_satisfaction_metrics (code, name, target, is_active)
SELECT
  latest_names.metric_code,
  COALESCE(NULLIF(btrim(latest_names.metric_name), ''), latest_names.metric_code),
  COALESCE(latest_targets.target_val, 80),
  true
FROM latest_names
LEFT JOIN latest_targets USING (metric_code)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.kpi_satisfaction_metrics ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.kpi_satisfaction_metrics FROM anon, authenticated;
GRANT SELECT ON TABLE public.kpi_satisfaction_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.kpi_satisfaction_metrics TO service_role;

DROP POLICY IF EXISTS kpi_satisfaction_metrics_authenticated_read
  ON public.kpi_satisfaction_metrics;
CREATE POLICY kpi_satisfaction_metrics_authenticated_read
  ON public.kpi_satisfaction_metrics
  FOR SELECT TO authenticated
  USING (true);

ALTER TABLE public.kpi_satisfaction
  ADD COLUMN IF NOT EXISTS source_note text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.survey_campaigns
  ADD COLUMN IF NOT EXISTS fiscal_year integer,
  ADD COLUMN IF NOT EXISTS department_id bigint,
  ADD COLUMN IF NOT EXISTS target_response_count integer,
  ADD COLUMN IF NOT EXISTS kpi_metric_code text;

-- PostgreSQL does not support ADD CONSTRAINT IF NOT EXISTS, so guard each
-- additive constraint through pg_constraint and then validate it explicitly.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'survey_campaigns_fiscal_year_check'
      AND conrelid = 'public.survey_campaigns'::regclass
  ) THEN
    ALTER TABLE public.survey_campaigns
      ADD CONSTRAINT survey_campaigns_fiscal_year_check
      CHECK (fiscal_year BETWEEN 2500 AND 3000) NOT VALID;
  END IF;
END;
$$;

ALTER TABLE public.survey_campaigns
  VALIDATE CONSTRAINT survey_campaigns_fiscal_year_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'survey_campaigns_target_response_count_check'
      AND conrelid = 'public.survey_campaigns'::regclass
  ) THEN
    ALTER TABLE public.survey_campaigns
      ADD CONSTRAINT survey_campaigns_target_response_count_check
      CHECK (target_response_count > 0) NOT VALID;
  END IF;
END;
$$;

ALTER TABLE public.survey_campaigns
  VALIDATE CONSTRAINT survey_campaigns_target_response_count_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'survey_campaigns_department_id_fkey'
      AND conrelid = 'public.survey_campaigns'::regclass
  ) THEN
    ALTER TABLE public.survey_campaigns
      ADD CONSTRAINT survey_campaigns_department_id_fkey
      FOREIGN KEY (department_id)
      REFERENCES public.departments(id)
      ON DELETE RESTRICT
      NOT VALID;
  END IF;
END;
$$;

ALTER TABLE public.survey_campaigns
  VALIDATE CONSTRAINT survey_campaigns_department_id_fkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'kpi_satisfaction_metric_code_fkey'
      AND conrelid = 'public.kpi_satisfaction'::regclass
  ) THEN
    ALTER TABLE public.kpi_satisfaction
      ADD CONSTRAINT kpi_satisfaction_metric_code_fkey
      FOREIGN KEY (metric_code)
      REFERENCES public.kpi_satisfaction_metrics(code)
      ON DELETE RESTRICT
      NOT VALID;
  END IF;
END;
$$;

ALTER TABLE public.kpi_satisfaction
  VALIDATE CONSTRAINT kpi_satisfaction_metric_code_fkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'survey_campaigns_kpi_metric_code_fkey'
      AND conrelid = 'public.survey_campaigns'::regclass
  ) THEN
    ALTER TABLE public.survey_campaigns
      ADD CONSTRAINT survey_campaigns_kpi_metric_code_fkey
      FOREIGN KEY (kpi_metric_code)
      REFERENCES public.kpi_satisfaction_metrics(code)
      ON DELETE RESTRICT
      NOT VALID;
  END IF;
END;
$$;

ALTER TABLE public.survey_campaigns
  VALIDATE CONSTRAINT survey_campaigns_kpi_metric_code_fkey;

-- Explicit FY2569 mapping. Department IDs are resolved from stable codes;
-- KPI metric mappings intentionally stay null for an administrator to choose.
WITH campaign_department_map(campaign_id, department_code) AS (
  VALUES
    ('b03f97d5-acaf-4cc8-9720-70354fdcb63f'::uuid, 'MCL'),
    ('9d319578-7af4-4421-84fa-e392d24f2298'::uuid, 'OPD'),
    ('c4f1b570-8c89-4f54-b50f-f9dd1b6a408f'::uuid, 'OPD'),
    ('1448036f-3ef7-4b81-b89b-675c34f21d85'::uuid, 'MCL')
)
UPDATE public.survey_campaigns AS campaign
SET
  fiscal_year = 2569,
  department_id = department.id,
  opens_at = '2025-10-01T00:00:00+07:00'::timestamptz,
  closes_at = '2026-10-01T00:00:00+07:00'::timestamptz
FROM campaign_department_map AS mapping
JOIN public.departments AS department
  ON department.code = mapping.department_code
WHERE campaign.id = mapping.campaign_id;

CREATE UNIQUE INDEX IF NOT EXISTS survey_campaigns_survey_department_fiscal_year_uidx
  ON public.survey_campaigns (survey_id, department_id, fiscal_year);

CREATE UNIQUE INDEX IF NOT EXISTS survey_campaigns_kpi_metric_fiscal_year_uidx
  ON public.survey_campaigns (kpi_metric_code, fiscal_year)
  WHERE kpi_metric_code IS NOT NULL AND fiscal_year IS NOT NULL;

CREATE INDEX IF NOT EXISTS survey_campaigns_fiscal_year_department_idx
  ON public.survey_campaigns (fiscal_year DESC, department_id, survey_id)
  WHERE fiscal_year IS NOT NULL;

CREATE INDEX IF NOT EXISTS kpi_satisfaction_fiscal_year_metric_idx
  ON public.kpi_satisfaction (fiscal_year DESC, metric_code);

CREATE INDEX IF NOT EXISTS survey_kpi_publications_published_at_idx
  ON public.survey_kpi_publications (published_at DESC);

-- Campaign reservations and manual KPI values live in separate tables. These
-- matching advisory locks close the small race where each request could check
-- the other table before either one committed.
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

DROP TRIGGER IF EXISTS satisfaction_campaign_metric_slot_guard
  ON public.survey_campaigns;
CREATE TRIGGER satisfaction_campaign_metric_slot_guard
  BEFORE INSERT OR UPDATE OF kpi_metric_code, fiscal_year
  ON public.survey_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_satisfaction_campaign_metric_slot();

CREATE OR REPLACE FUNCTION public.guard_satisfaction_value_metric_slot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('satisfaction-kpi:' || NEW.metric_code || ':' || NEW.fiscal_year::text, 0)
  );

  IF EXISTS (
    SELECT 1
    FROM public.survey_campaigns AS campaign
    WHERE campaign.kpi_metric_code = NEW.metric_code
      AND campaign.fiscal_year = NEW.fiscal_year
      AND NOT EXISTS (
        SELECT 1
        FROM public.survey_kpi_publications AS publication
        WHERE publication.campaign_id = campaign.id
          AND publication.metric_code = NEW.metric_code
          AND publication.fiscal_year = NEW.fiscal_year
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'KPI metric/year is reserved by a survey campaign';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS satisfaction_value_metric_slot_guard
  ON public.kpi_satisfaction;
CREATE TRIGGER satisfaction_value_metric_slot_guard
  BEFORE INSERT OR UPDATE OF metric_code, fiscal_year
  ON public.kpi_satisfaction
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_satisfaction_value_metric_slot();
