-- Visitor self-checkout and automatic midnight checkout extension.
-- Apply after scripts/it-visitor-log.sql and before deploying the matching application code.

BEGIN;

ALTER TABLE it_visitor_logs
  ADD COLUMN IF NOT EXISTS checkout_secret_hash text,
  ADD COLUMN IF NOT EXISTS checkout_method text,
  ADD COLUMN IF NOT EXISTS checkout_note text;

ALTER TABLE it_visitor_logs
  DROP CONSTRAINT IF EXISTS it_visitor_logs_checkout_method_check;

ALTER TABLE it_visitor_logs
  ADD CONSTRAINT it_visitor_logs_checkout_method_check
  CHECK (checkout_method IS NULL OR checkout_method IN ('self', 'staff', 'auto'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'it_visitor_logs_checkout_secret_hash_check'
      AND conrelid = 'it_visitor_logs'::regclass
  ) THEN
    ALTER TABLE it_visitor_logs
      ADD CONSTRAINT it_visitor_logs_checkout_secret_hash_check
      CHECK (checkout_secret_hash IS NULL OR checkout_secret_hash ~ '^[a-f0-9]{64}$');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS it_visitor_checkout_secret_hash_idx
  ON it_visitor_logs(checkout_secret_hash)
  WHERE checkout_secret_hash IS NOT NULL;

UPDATE it_visitor_logs
SET checkout_method = 'staff'
WHERE exited_at IS NOT NULL
  AND closed_by IS NOT NULL
  AND checkout_method IS NULL;

-- Close any open visit at the first midnight after its Bangkok check-in date.
-- The function is called once daily by pg_cron just after midnight and also from application
-- reads, so a delayed scheduler cannot leave a stale visit open indefinitely.
DO $extension$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE EXTENSION pg_cron WITH SCHEMA pg_catalog;
  END IF;
END;
$extension$;

CREATE OR REPLACE FUNCTION public.auto_checkout_it_visitor_logs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  closed_count integer;
BEGIN
  WITH closed AS (
    UPDATE public.it_visitor_logs AS visitor
    SET
      exited_at = ((date_trunc('day', visitor.entered_at AT TIME ZONE 'Asia/Bangkok') + interval '1 day') AT TIME ZONE 'Asia/Bangkok'),
      closed_at = now(),
      closed_by = NULL,
      checkout_method = 'auto',
      checkout_note = 'ระบบปิดเวลาออกอัตโนมัติเมื่อพ้น 00:00 ของวันถัดไป',
      checkout_secret_hash = NULL
    WHERE visitor.exited_at IS NULL
      AND now() >= ((date_trunc('day', visitor.entered_at AT TIME ZONE 'Asia/Bangkok') + interval '1 day') AT TIME ZONE 'Asia/Bangkok')
    RETURNING visitor.id
  )
  INSERT INTO public.audit_log(action, user_id, target, detail)
  SELECT
    'it_visitor.auto_checkout',
    NULL,
    closed.id::text,
    'ระบบปิดเวลาออกอัตโนมัติเมื่อพ้นเที่ยงคืนของวันที่เข้า'
  FROM closed;

  GET DIAGNOSTICS closed_count = ROW_COUNT;
  RETURN closed_count;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_checkout_it_visitor_logs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_checkout_it_visitor_logs() TO service_role;

-- Keep one named job. Re-running this script replaces the existing schedule
-- through the supported cron functions instead of touching cron.job directly.
-- Supabase pg_cron uses GMT/UTC here: 17:05 UTC = 00:05 Asia/Bangkok.
DO $job$
DECLARE
  existing_job_id bigint;
BEGIN
  FOR existing_job_id IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'it-visitor-auto-checkout'
  LOOP
    PERFORM cron.unschedule(existing_job_id);
  END LOOP;

  PERFORM cron.schedule(
    'it-visitor-auto-checkout',
    '5 17 * * *',
    $command$SELECT public.auto_checkout_it_visitor_logs();$command$
  );
END;
$job$;

-- RLS remains unchanged: anonymous users never access the table directly.
NOTIFY pgrst, 'reload schema';

COMMIT;
