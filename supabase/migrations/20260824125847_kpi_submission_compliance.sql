-- KPI submission compliance tracking.
--
-- The existing KPI tables remain the source for numeric values. This migration
-- adds immutable definition versions and period snapshots so changing a KPI in
-- Settings cannot rewrite a locked fiscal period. All writes to the new
-- objects go through the server-side service role and the atomic save RPC.

CREATE TABLE IF NOT EXISTS public.kpi_dept_exclusions (
  id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dept_id  bigint NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  kpi_id   bigint NOT NULL REFERENCES public.kpi_definitions(id) ON DELETE CASCADE,
  UNIQUE (dept_id, kpi_id)
);

CREATE TABLE IF NOT EXISTS public.kpi_submission_settings (
  id                         boolean PRIMARY KEY DEFAULT true CHECK (id),
  tracking_start_fiscal_year integer NOT NULL CHECK (tracking_start_fiscal_year BETWEEN 2500 AND 3000),
  tracking_start_month       integer NOT NULL CHECK (tracking_start_month BETWEEN 1 AND 12),
  baseline_fiscal_year       integer NOT NULL CHECK (baseline_fiscal_year BETWEEN 2500 AND 3000),
  baseline_month             integer NOT NULL CHECK (baseline_month BETWEEN 1 AND 12),
  deadline_day               integer NOT NULL DEFAULT 15 CHECK (deadline_day BETWEEN 1 AND 28),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  updated_by                 uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

INSERT INTO public.kpi_submission_settings (
  id,
  tracking_start_fiscal_year,
  tracking_start_month,
  baseline_fiscal_year,
  baseline_month,
  deadline_day
)
VALUES (true, 2569, 8, 2569, 7, 15)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.kpi_definition_versions (
  id                            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kpi_id                        bigint NOT NULL REFERENCES public.kpi_definitions(id) ON DELETE RESTRICT,
  version_no                    integer NOT NULL CHECK (version_no > 0),
  code                          text NOT NULL,
  category                      text NOT NULL,
  sub_code                      text,
  name_th                       text NOT NULL,
  unit                          text,
  target_type                   text NOT NULL CHECK (target_type IN ('gte', 'lte', 'eq')),
  target_val                    numeric(10,2) NOT NULL,
  sort_order                    integer NOT NULL DEFAULT 0,
  denominator                   text,
  effective_from_fiscal_year    integer NOT NULL CHECK (effective_from_fiscal_year BETWEEN 2500 AND 3000),
  effective_from_month          integer NOT NULL CHECK (effective_from_month BETWEEN 1 AND 12),
  created_at                    timestamptz NOT NULL DEFAULT now(),
  created_by                    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE (kpi_id, version_no)
);

CREATE TABLE IF NOT EXISTS public.kpi_submission_periods (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dept_id               bigint NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  fiscal_year           integer NOT NULL CHECK (fiscal_year BETWEEN 2500 AND 3000),
  month                 integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  deadline              date NOT NULL,
  required_count        integer NOT NULL DEFAULT 0 CHECK (required_count >= 0),
  filled_count          integer NOT NULL DEFAULT 0 CHECK (filled_count >= 0),
  first_completed_at    timestamptz,
  first_completed_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_entry_at         timestamptz,
  last_entry_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status                text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('not_tracked', 'not_open', 'pending', 'on_time', 'missed', 'not_applicable')),
  status_source         text NOT NULL DEFAULT 'live'
                        CHECK (status_source IN ('live', 'baseline')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dept_id, fiscal_year, month)
);

CREATE TABLE IF NOT EXISTS public.kpi_submission_requirements (
  period_id             bigint NOT NULL REFERENCES public.kpi_submission_periods(id) ON DELETE CASCADE,
  kpi_id                bigint NOT NULL REFERENCES public.kpi_definitions(id) ON DELETE RESTRICT,
  definition_version_id bigint NOT NULL REFERENCES public.kpi_definition_versions(id) ON DELETE RESTRICT,
  code                  text NOT NULL,
  category              text NOT NULL,
  sub_code              text,
  name_th               text NOT NULL,
  unit                  text,
  target_type           text NOT NULL CHECK (target_type IN ('gte', 'lte', 'eq')),
  target_val            numeric(10,2) NOT NULL,
  sort_order            integer NOT NULL DEFAULT 0,
  denominator           text,
  PRIMARY KEY (period_id, kpi_id)
);

ALTER TABLE public.kpi_entries
  ADD COLUMN IF NOT EXISTS definition_version_id bigint
    REFERENCES public.kpi_definition_versions(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Seed version 1 from the current Settings values. 2500/1 means it applies to
-- every existing fiscal period; later versions are selected by effective date.
INSERT INTO public.kpi_definition_versions (
  kpi_id, version_no, code, category, sub_code, name_th, unit,
  target_type, target_val, sort_order, denominator,
  effective_from_fiscal_year, effective_from_month
)
SELECT
  id, 1, code, category, sub_code, name_th, unit,
  COALESCE(target_type, 'gte'), COALESCE(target_val, 0), COALESCE(sort_order, 0), denominator,
  2500, 1
FROM public.kpi_definitions
ON CONFLICT (kpi_id, version_no) DO NOTHING;

UPDATE public.kpi_entries AS entry
SET definition_version_id = version.id
FROM public.kpi_definition_versions AS version
WHERE entry.definition_version_id IS NULL
  AND version.kpi_id = entry.kpi_id
  AND version.version_no = 1;

CREATE INDEX IF NOT EXISTS kpi_definition_versions_effective_idx
  ON public.kpi_definition_versions (
    kpi_id,
    effective_from_fiscal_year DESC,
    effective_from_month DESC,
    version_no DESC
  );

CREATE INDEX IF NOT EXISTS kpi_submission_periods_year_status_deadline_idx
  ON public.kpi_submission_periods (fiscal_year, status, deadline, dept_id);

CREATE INDEX IF NOT EXISTS kpi_submission_requirements_period_idx
  ON public.kpi_submission_requirements (period_id, sort_order, kpi_id);

CREATE INDEX IF NOT EXISTS kpi_entries_submission_period_idx
  ON public.kpi_entries (dept_id, fiscal_year, month, updated_at DESC);

CREATE OR REPLACE FUNCTION public.kpi_fiscal_period_key(p_fiscal_year integer, p_month integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT p_fiscal_year * 12 + CASE
    WHEN p_month = 10 THEN 0
    WHEN p_month = 11 THEN 1
    WHEN p_month = 12 THEN 2
    WHEN p_month = 1 THEN 3
    WHEN p_month = 2 THEN 4
    WHEN p_month = 3 THEN 5
    WHEN p_month = 4 THEN 6
    WHEN p_month = 5 THEN 7
    WHEN p_month = 6 THEN 8
    WHEN p_month = 7 THEN 9
    WHEN p_month = 8 THEN 10
    WHEN p_month = 9 THEN 11
    ELSE -1
  END;
$$;

CREATE OR REPLACE FUNCTION public.kpi_submission_deadline(
  p_fiscal_year integer,
  p_month integer,
  p_deadline_day integer DEFAULT 15
)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  measured_year integer;
  deadline_month integer;
  deadline_year integer;
BEGIN
  IF p_month NOT BETWEEN 1 AND 12 OR p_deadline_day NOT BETWEEN 1 AND 28 THEN
    RAISE EXCEPTION 'Invalid KPI submission period';
  END IF;

  measured_year := CASE WHEN p_month >= 10 THEN p_fiscal_year - 544 ELSE p_fiscal_year - 543 END;
  deadline_month := CASE WHEN p_month = 12 THEN 1 ELSE p_month + 1 END;
  deadline_year := CASE WHEN p_month = 12 THEN measured_year + 1 ELSE measured_year END;
  RETURN make_date(deadline_year, deadline_month, p_deadline_day);
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_kpi_submission_period(
  p_dept_id bigint,
  p_fiscal_year integer,
  p_month integer
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_period_id bigint;
  settings_row public.kpi_submission_settings%ROWTYPE;
BEGIN
  IF p_fiscal_year NOT BETWEEN 2500 AND 3000 OR p_month NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'Invalid KPI submission period';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('kpi-submission-period:' || p_dept_id::text || ':' || p_fiscal_year::text || ':' || p_month::text, 0)
  );

  SELECT * INTO settings_row
  FROM public.kpi_submission_settings
  WHERE id = true;

  INSERT INTO public.kpi_submission_periods (
    dept_id, fiscal_year, month, deadline, status, status_source
  )
  VALUES (
    p_dept_id,
    p_fiscal_year,
    p_month,
    public.kpi_submission_deadline(p_fiscal_year, p_month, settings_row.deadline_day),
    'pending',
    CASE
      WHEN p_fiscal_year = settings_row.baseline_fiscal_year
       AND p_month = settings_row.baseline_month THEN 'baseline'
      ELSE 'live'
    END
  )
  ON CONFLICT (dept_id, fiscal_year, month) DO NOTHING
  RETURNING id INTO v_period_id;

  IF v_period_id IS NULL THEN
    SELECT id INTO v_period_id
    FROM public.kpi_submission_periods
    WHERE dept_id = p_dept_id
      AND fiscal_year = p_fiscal_year
      AND month = p_month;
  END IF;

  INSERT INTO public.kpi_submission_requirements (
    period_id, kpi_id, definition_version_id, code, category, sub_code,
    name_th, unit, target_type, target_val, sort_order, denominator
  )
  SELECT
    v_period_id,
    definition.id,
    version.id,
    version.code,
    version.category,
    version.sub_code,
    version.name_th,
    version.unit,
    version.target_type,
    version.target_val,
    version.sort_order,
    version.denominator
  FROM public.kpi_definitions AS definition
  JOIN LATERAL (
    SELECT version.*
    FROM public.kpi_definition_versions AS version
    WHERE version.kpi_id = definition.id
      AND public.kpi_fiscal_period_key(version.effective_from_fiscal_year, version.effective_from_month)
        <= public.kpi_fiscal_period_key(p_fiscal_year, p_month)
    ORDER BY
      public.kpi_fiscal_period_key(version.effective_from_fiscal_year, version.effective_from_month) DESC,
      version.version_no DESC
    LIMIT 1
  ) AS version ON true
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.kpi_dept_exclusions AS exclusion
    WHERE exclusion.dept_id = p_dept_id
      AND exclusion.kpi_id = definition.id
  )
  ON CONFLICT (period_id, kpi_id) DO NOTHING;

  UPDATE public.kpi_submission_periods
  SET required_count = (
        SELECT count(*)::integer
        FROM public.kpi_submission_requirements
        WHERE kpi_submission_requirements.period_id = v_period_id
      ),
      updated_at = now()
  WHERE id = v_period_id;

  RETURN v_period_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_kpi_submission_period(
  p_dept_id bigint,
  p_fiscal_year integer,
  p_month integer,
  p_actor_id uuid DEFAULT NULL
)
RETURNS public.kpi_submission_periods
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_period_id bigint;
  period_row public.kpi_submission_periods%ROWTYPE;
  settings_row public.kpi_submission_settings%ROWTYPE;
  v_required_count integer;
  v_filled_count integer;
  first_completion timestamptz;
  current_calendar_year integer;
  current_month integer;
  current_fiscal_year integer;
  current_period_key integer;
  period_key integer;
  deadline_end timestamptz;
BEGIN
  v_period_id := public.ensure_kpi_submission_period(p_dept_id, p_fiscal_year, p_month);

  SELECT * INTO settings_row
  FROM public.kpi_submission_settings
  WHERE id = true;

  SELECT * INTO period_row
  FROM public.kpi_submission_periods
  WHERE id = v_period_id
  FOR UPDATE;

  SELECT count(*)::integer INTO v_required_count
  FROM public.kpi_submission_requirements
  WHERE kpi_submission_requirements.period_id = v_period_id;

  SELECT count(*)::integer INTO v_filled_count
  FROM public.kpi_submission_requirements AS requirement
  JOIN public.kpi_entries AS entry
    ON entry.dept_id = p_dept_id
   AND entry.kpi_id = requirement.kpi_id
   AND entry.fiscal_year = p_fiscal_year
   AND entry.month = p_month
  WHERE requirement.period_id = v_period_id
    AND entry.numerator IS NOT NULL
    AND entry.numerator <> 'NaN'::numeric
    AND (
      requirement.denominator IS NULL
      OR (
        entry.denominator IS NOT NULL
        AND entry.denominator <> 'NaN'::numeric
        AND entry.denominator >= 0
      )
    );

  first_completion := period_row.first_completed_at;
  IF first_completion IS NULL AND v_filled_count >= v_required_count AND v_required_count > 0 THEN
    IF p_actor_id IS NOT NULL THEN
      -- A save request that crosses the completion boundary is the first
      -- reliable completion timestamp, even when some fields existed earlier.
      first_completion := now();
    ELSE
      -- Backfill/reconcile has no event timestamp; use the earliest known
      -- entry update as the best historical approximation.
      SELECT min(entry.updated_at) INTO first_completion
      FROM public.kpi_submission_requirements AS requirement
      JOIN public.kpi_entries AS entry
        ON entry.dept_id = p_dept_id
       AND entry.kpi_id = requirement.kpi_id
       AND entry.fiscal_year = p_fiscal_year
       AND entry.month = p_month
      WHERE requirement.period_id = v_period_id;
      first_completion := COALESCE(first_completion, now());
    END IF;
  END IF;

  current_calendar_year := extract(year FROM (now() AT TIME ZONE 'Asia/Bangkok'))::integer;
  current_month := extract(month FROM (now() AT TIME ZONE 'Asia/Bangkok'))::integer;
  current_fiscal_year := CASE
    WHEN current_month >= 10 THEN current_calendar_year + 544
    ELSE current_calendar_year + 543
  END;
  current_period_key := public.kpi_fiscal_period_key(current_fiscal_year, current_month);
  period_key := public.kpi_fiscal_period_key(p_fiscal_year, p_month);
  deadline_end := (period_row.deadline + time '23:59:59.999') AT TIME ZONE 'Asia/Bangkok';

  UPDATE public.kpi_submission_periods
  SET required_count = v_required_count,
      filled_count = v_filled_count,
      first_completed_at = first_completion,
      first_completed_by = CASE
        WHEN period_row.first_completed_at IS NULL AND first_completion IS NOT NULL THEN COALESCE(p_actor_id, period_row.first_completed_by)
        ELSE period_row.first_completed_by
      END,
      last_entry_at = CASE WHEN p_actor_id IS NULL THEN period_row.last_entry_at ELSE now() END,
      last_entry_by = CASE WHEN p_actor_id IS NULL THEN period_row.last_entry_by ELSE p_actor_id END,
      status = CASE
        WHEN v_required_count = 0 THEN 'not_applicable'
        WHEN period_row.status_source = 'baseline' THEN
          CASE WHEN v_filled_count >= v_required_count THEN 'on_time' ELSE 'missed' END
        WHEN period_key < public.kpi_fiscal_period_key(settings_row.tracking_start_fiscal_year, settings_row.tracking_start_month) THEN 'not_tracked'
        WHEN period_key >= current_period_key THEN 'not_open'
        WHEN v_filled_count >= v_required_count THEN
          CASE WHEN first_completion IS NOT NULL AND first_completion <= deadline_end THEN 'on_time' ELSE 'missed' END
        WHEN now() <= deadline_end THEN 'pending'
        ELSE 'missed'
      END,
      updated_at = now()
  WHERE id = v_period_id
  RETURNING * INTO period_row;

  RETURN period_row;
END;
$$;

-- Entries and the period reconciliation are performed by one database
-- function, so a retry cannot leave the numeric values and compliance counts
-- in different transactions.
CREATE OR REPLACE FUNCTION public.save_kpi_entries(
  p_entries jsonb,
  p_clear_entries jsonb,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  entry_row record;
  clear_row record;
  period_row record;
  period_json jsonb := '[]'::jsonb;
  v_period_id bigint;
  v_version_id bigint;
BEGIN
  FOR entry_row IN
    SELECT *
    FROM jsonb_to_recordset(COALESCE(p_entries, '[]'::jsonb)) AS item(
      dept_id bigint,
      kpi_id bigint,
      fiscal_year integer,
      month integer,
      numerator numeric,
      denominator numeric
    )
  LOOP
    v_period_id := public.ensure_kpi_submission_period(entry_row.dept_id, entry_row.fiscal_year, entry_row.month);
    SELECT definition_version_id INTO v_version_id
    FROM public.kpi_submission_requirements
    WHERE kpi_submission_requirements.period_id = v_period_id
      AND kpi_id = entry_row.kpi_id;

    IF v_version_id IS NULL THEN
      RAISE EXCEPTION 'KPI is not required for this department and period';
    END IF;

    INSERT INTO public.kpi_entries (
      dept_id, kpi_id, fiscal_year, month, numerator, denominator,
      result_pct, definition_version_id, updated_at, updated_by
    )
    VALUES (
      entry_row.dept_id,
      entry_row.kpi_id,
      entry_row.fiscal_year,
      entry_row.month,
      entry_row.numerator,
      entry_row.denominator,
      CASE
        WHEN entry_row.denominator IS NULL OR entry_row.denominator <= 0 THEN NULL
        ELSE round((entry_row.numerator / entry_row.denominator) * 100, 2)
      END,
      v_version_id,
      now(),
      p_actor_id
    )
    ON CONFLICT (dept_id, kpi_id, fiscal_year, month) DO UPDATE
    SET numerator = EXCLUDED.numerator,
        denominator = EXCLUDED.denominator,
        result_pct = EXCLUDED.result_pct,
        definition_version_id = EXCLUDED.definition_version_id,
        updated_at = now(),
        updated_by = EXCLUDED.updated_by;
  END LOOP;

  FOR clear_row IN
    SELECT *
    FROM jsonb_to_recordset(COALESCE(p_clear_entries, '[]'::jsonb)) AS item(
      dept_id bigint,
      kpi_id bigint,
      fiscal_year integer,
      month integer
    )
  LOOP
    PERFORM public.ensure_kpi_submission_period(clear_row.dept_id, clear_row.fiscal_year, clear_row.month);
    DELETE FROM public.kpi_entries
    WHERE dept_id = clear_row.dept_id
      AND kpi_id = clear_row.kpi_id
      AND fiscal_year = clear_row.fiscal_year
      AND month = clear_row.month;
  END LOOP;

  FOR period_row IN
    SELECT DISTINCT item.dept_id, item.fiscal_year, item.month
    FROM (
      SELECT dept_id, fiscal_year, month
      FROM jsonb_to_recordset(COALESCE(p_entries, '[]'::jsonb)) AS entry_item(
        dept_id bigint, kpi_id bigint, fiscal_year integer, month integer,
        numerator numeric, denominator numeric
      )
      UNION
      SELECT dept_id, fiscal_year, month
      FROM jsonb_to_recordset(COALESCE(p_clear_entries, '[]'::jsonb)) AS clear_item(
        dept_id bigint, kpi_id bigint, fiscal_year integer, month integer
      )
    ) AS item
  LOOP
    period_json := period_json || jsonb_build_array(
      to_jsonb(public.reconcile_kpi_submission_period(
        period_row.dept_id,
        period_row.fiscal_year,
        period_row.month,
        p_actor_id
      ))
    );
  END LOOP;

  RETURN period_json;
END;
$$;

-- Materialize the current period and the agreed one-month baseline for every
-- active department. Older periods remain available in the numeric KPI view,
-- but are intentionally absent from compliance tracking.
DO $$
DECLARE
  department_row record;
  settings_row public.kpi_submission_settings%ROWTYPE;
BEGIN
  SELECT * INTO settings_row
  FROM public.kpi_submission_settings
  WHERE id = true;

  FOR department_row IN
    SELECT id FROM public.departments WHERE is_active IS DISTINCT FROM false
  LOOP
    PERFORM public.reconcile_kpi_submission_period(
      department_row.id,
      settings_row.baseline_fiscal_year,
      settings_row.baseline_month
    );
    PERFORM public.reconcile_kpi_submission_period(
      department_row.id,
      settings_row.tracking_start_fiscal_year,
      settings_row.tracking_start_month
    );
  END LOOP;
END;
$$;

-- Numeric KPI history should use the definition snapshot attached to the
-- entry. The fallback to kpi_definitions keeps legacy rows readable until an
-- entry is edited or backfilled.
DROP VIEW IF EXISTS public.vw_kpi_dashboard;
CREATE VIEW public.vw_kpi_dashboard
WITH (security_invoker = true)
AS
SELECT
  department.code AS dept_code,
  department.name_th AS dept_name,
  CASE WHEN version.id IS NOT NULL THEN version.code ELSE definition.code END AS kpi_code,
  CASE WHEN version.id IS NOT NULL THEN version.category ELSE definition.category END AS category,
  CASE WHEN version.id IS NOT NULL THEN version.sub_code ELSE definition.sub_code END AS sub_code,
  CASE WHEN version.id IS NOT NULL THEN version.name_th ELSE definition.name_th END AS kpi_name,
  CASE WHEN version.id IS NOT NULL THEN version.target_type ELSE definition.target_type END AS target_type,
  CASE WHEN version.id IS NOT NULL THEN version.target_val ELSE definition.target_val END AS target_val,
  CASE WHEN version.id IS NOT NULL THEN version.unit ELSE definition.unit END AS unit,
  CASE WHEN version.id IS NOT NULL THEN version.denominator ELSE definition.denominator END AS denominator_label,
  entry.fiscal_year,
  entry.month,
  entry.numerator,
  entry.denominator,
  entry.result_pct,
  CASE
    WHEN entry.numerator IS NULL THEN NULL::boolean
    WHEN (CASE WHEN version.id IS NOT NULL THEN version.denominator ELSE definition.denominator END) IS NULL THEN
      CASE
        WHEN (CASE WHEN version.id IS NOT NULL THEN version.target_type ELSE definition.target_type END) = 'eq' THEN entry.numerator = (CASE WHEN version.id IS NOT NULL THEN version.target_val ELSE definition.target_val END)
        WHEN (CASE WHEN version.id IS NOT NULL THEN version.target_type ELSE definition.target_type END) = 'gte' THEN entry.numerator >= (CASE WHEN version.id IS NOT NULL THEN version.target_val ELSE definition.target_val END)
        WHEN (CASE WHEN version.id IS NOT NULL THEN version.target_type ELSE definition.target_type END) = 'lte' THEN entry.numerator <= (CASE WHEN version.id IS NOT NULL THEN version.target_val ELSE definition.target_val END)
        ELSE false
      END
    WHEN entry.denominator IS NULL OR entry.denominator < 0 OR (entry.denominator = 0 AND entry.numerator <> 0) THEN NULL::boolean
    WHEN entry.denominator = 0 AND entry.numerator = 0 THEN NULL::boolean
    WHEN (CASE WHEN version.id IS NOT NULL THEN version.target_type ELSE definition.target_type END) = 'eq' THEN entry.result_pct = (CASE WHEN version.id IS NOT NULL THEN version.target_val ELSE definition.target_val END)
    WHEN (CASE WHEN version.id IS NOT NULL THEN version.target_type ELSE definition.target_type END) = 'gte' THEN entry.result_pct >= (CASE WHEN version.id IS NOT NULL THEN version.target_val ELSE definition.target_val END)
    WHEN (CASE WHEN version.id IS NOT NULL THEN version.target_type ELSE definition.target_type END) = 'lte' THEN entry.result_pct <= (CASE WHEN version.id IS NOT NULL THEN version.target_val ELSE definition.target_val END)
    ELSE false
  END AS is_pass,
  entry.definition_version_id
FROM public.kpi_entries AS entry
JOIN public.departments AS department ON department.id = entry.dept_id
JOIN public.kpi_definitions AS definition ON definition.id = entry.kpi_id
LEFT JOIN public.kpi_definition_versions AS version ON version.id = entry.definition_version_id;

ALTER TABLE public.kpi_submission_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_definition_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_submission_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_submission_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_dept_exclusions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.kpi_submission_settings FROM anon, authenticated;
REVOKE ALL ON TABLE public.kpi_definition_versions FROM anon, authenticated;
REVOKE ALL ON TABLE public.kpi_submission_periods FROM anon, authenticated;
REVOKE ALL ON TABLE public.kpi_submission_requirements FROM anon, authenticated;
REVOKE ALL ON TABLE public.kpi_dept_exclusions FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.kpi_submission_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.kpi_definition_versions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.kpi_submission_periods TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.kpi_submission_requirements TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.kpi_dept_exclusions TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.kpi_definition_versions_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.kpi_submission_periods_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.kpi_dept_exclusions_id_seq TO service_role;

REVOKE ALL ON FUNCTION public.ensure_kpi_submission_period(bigint, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reconcile_kpi_submission_period(bigint, integer, integer, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_kpi_entries(jsonb, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_kpi_submission_period(bigint, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_kpi_submission_period(bigint, integer, integer, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_kpi_entries(jsonb, jsonb, uuid) TO service_role;
GRANT SELECT ON public.vw_kpi_dashboard TO authenticated, service_role;
