-- Rejection Log Module Migration
-- Run manually via Supabase Dashboard → SQL Editor

-- Main table
CREATE TABLE IF NOT EXISTS rejection_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spcmdate         date NOT NULL,
  spcmtime         text,
  ln               text NOT NULL,
  dspname          text,   -- stored in DB only; never exposed via API/UI
  hn               text,   -- stored in DB only; never exposed via API/UI
  an               text,   -- stored in DB only; never exposed via API/UI
  spcmnotedt       text,
  labspcmnm        text,
  itemno           integer NOT NULL DEFAULT 1,
  reject           text,
  reason           text,
  cnclstfnm        text,
  cncldatetime     timestamptz,
  work             text,
  ward             text,
  hptnm            text,
  upload_batch_id  uuid,
  uploaded_at      timestamptz DEFAULT now(),
  CONSTRAINT rejection_logs_ln_itemno_key UNIQUE (ln, itemno)
);

CREATE INDEX IF NOT EXISTS rejection_logs_spcmdate_idx ON rejection_logs (spcmdate);
CREATE INDEX IF NOT EXISTS rejection_logs_work_idx     ON rejection_logs (work);
CREATE INDEX IF NOT EXISTS rejection_logs_reject_idx   ON rejection_logs (reject);

-- Upload history
CREATE TABLE IF NOT EXISTS rejection_uploads (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename     text NOT NULL,
  data_month   text,          -- 'YYYY-MM' of the data month
  total_rows   integer DEFAULT 0,
  inserted     integer DEFAULT 0,
  skipped      integer DEFAULT 0,
  uploaded_by  uuid REFERENCES profiles(id),
  uploaded_at  timestamptz DEFAULT now()
);

-- RPC for aggregation (charts + stats)
-- p_year + p_month   → monthly mode
-- p_filter_year      → yearly mode (single year), nullable
-- p_work             → section filter, nullable = all sections
CREATE OR REPLACE FUNCTION get_rejection_summary(
  p_year        int DEFAULT NULL,
  p_month       int DEFAULT NULL,
  p_filter_year text DEFAULT NULL,
  p_work        text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_start  date;
  v_end    date;
  v_ps     date;
  v_pe     date;
  v_ts     date;
BEGIN
  IF p_year IS NOT NULL AND p_month IS NOT NULL THEN
    -- Monthly mode
    v_start := make_date(p_year, p_month, 1);
    v_end   := (v_start + interval '1 month' - interval '1 day')::date;
    v_ps    := (v_start - interval '1 month')::date;
    v_pe    := v_start - 1;
    v_ts    := (v_start - interval '11 months')::date;
  ELSIF p_filter_year IS NOT NULL THEN
    -- Yearly mode
    v_start := make_date(p_filter_year::int, 1, 1);
    v_end   := make_date(p_filter_year::int, 12, 31);
    v_ps    := make_date(p_filter_year::int - 1, 1, 1);
    v_pe    := make_date(p_filter_year::int - 1, 12, 31);
    v_ts    := v_start;
  ELSE
    -- All time
    v_start := '2000-01-01'::date;
    v_end   := CURRENT_DATE;
    v_ps    := v_start;
    v_pe    := v_start;
    v_ts    := (CURRENT_DATE - interval '11 months')::date;
  END IF;

  RETURN json_build_object(
    'current_total', (
      SELECT count(*) FROM rejection_logs
      WHERE spcmdate BETWEEN v_start AND v_end
        AND (p_work IS NULL OR work = p_work)
    ),
    'prev_total', (
      SELECT count(*) FROM rejection_logs
      WHERE spcmdate BETWEEN v_ps AND v_pe
        AND (p_work IS NULL OR work = p_work)
    ),
    'by_reason', (
      SELECT coalesce(json_agg(r ORDER BY r.total DESC), '[]')
      FROM (
        SELECT reject AS reason, count(*)::int AS total
        FROM rejection_logs
        WHERE spcmdate BETWEEN v_start AND v_end
          AND (p_work IS NULL OR work = p_work)
        GROUP BY reject
      ) r
    ),
    'by_reason_prev', (
      SELECT coalesce(json_agg(r ORDER BY r.total DESC), '[]')
      FROM (
        SELECT reject AS reason, count(*)::int AS total
        FROM rejection_logs
        WHERE spcmdate BETWEEN v_ps AND v_pe
          AND (p_work IS NULL OR work = p_work)
        GROUP BY reject
      ) r
    ),
    'by_reason_detail', (
      SELECT coalesce(json_agg(r), '[]')
      FROM (
        SELECT coalesce(nullif(trim(reason), ''), 'ไม่ระบุเหตุผล') AS label,
               count(*)::int AS total
        FROM rejection_logs
        WHERE spcmdate BETWEEN v_start AND v_end
          AND (p_work IS NULL OR work = p_work)
          AND reject = 'อื่นๆ'
        GROUP BY label
        ORDER BY total DESC
        LIMIT 30
      ) r
    ),
    'by_section', (
      SELECT coalesce(json_agg(r ORDER BY r.total DESC), '[]')
      FROM (
        SELECT work AS section, count(*)::int AS total
        FROM rejection_logs
        WHERE spcmdate BETWEEN v_start AND v_end
          AND (p_work IS NULL OR work = p_work)
        GROUP BY work
      ) r
    ),
    'by_specimen', (
      SELECT coalesce(json_agg(r), '[]')
      FROM (
        SELECT labspcmnm AS specimen, count(*)::int AS total
        FROM rejection_logs
        WHERE spcmdate BETWEEN v_start AND v_end
          AND (p_work IS NULL OR work = p_work)
        GROUP BY labspcmnm
        ORDER BY total DESC
        LIMIT 10
      ) r
    ),
    'by_ward', (
      SELECT coalesce(json_agg(r), '[]')
      FROM (
        SELECT ward, count(*)::int AS total
        FROM rejection_logs
        WHERE spcmdate BETWEEN v_start AND v_end
          AND (p_work IS NULL OR work = p_work)
        GROUP BY ward
        ORDER BY total DESC
        LIMIT 20
      ) r
    ),
    'monthly_trend', (
      SELECT coalesce(json_agg(r ORDER BY r.month), '[]')
      FROM (
        SELECT to_char(spcmdate, 'YYYY-MM') AS month, count(*)::int AS total
        FROM rejection_logs
        WHERE spcmdate BETWEEN v_ts AND v_end
          AND (p_work IS NULL OR work = p_work)
        GROUP BY to_char(spcmdate, 'YYYY-MM')
      ) r
    ),
    'yearly_trend', (
      SELECT coalesce(json_agg(r ORDER BY r.yr), '[]')
      FROM (
        SELECT extract(year FROM spcmdate)::int AS yr, count(*)::int AS total
        FROM rejection_logs
        WHERE (p_work IS NULL OR work = p_work)
        GROUP BY yr
      ) r
    ),
    'yearly_by_reason', (
      SELECT coalesce(json_agg(r ORDER BY r.yr, r.total DESC), '[]')
      FROM (
        SELECT extract(year FROM spcmdate)::int AS yr,
               reject AS reason, count(*)::int AS total
        FROM rejection_logs
        WHERE (p_work IS NULL OR work = p_work)
          AND reject IN (
            SELECT reject FROM rejection_logs
            WHERE (p_work IS NULL OR work = p_work)
            GROUP BY reject ORDER BY count(*) DESC LIMIT 6
          )
        GROUP BY yr, reject
      ) r
    ),
    'yearly_by_section', (
      SELECT coalesce(json_agg(r ORDER BY r.yr, r.total DESC), '[]')
      FROM (
        SELECT extract(year FROM spcmdate)::int AS yr,
               work AS section, count(*)::int AS total
        FROM rejection_logs
        WHERE (p_work IS NULL OR work = p_work)
        GROUP BY yr, work
      ) r
    ),
    'monthly_by_year', (
      SELECT coalesce(json_agg(r ORDER BY r.yr, r.mo), '[]')
      FROM (
        SELECT extract(year FROM spcmdate)::int AS yr,
               extract(month FROM spcmdate)::int AS mo,
               count(*)::int AS total
        FROM rejection_logs
        WHERE (p_work IS NULL OR work = p_work)
        GROUP BY yr, mo
      ) r
    )
  );
END;
$$;
