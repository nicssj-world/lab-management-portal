-- Visitor self-checkout extension.
-- Apply after scripts/it-visitor-log.sql and before deploying the matching application code.

BEGIN;

ALTER TABLE it_visitor_logs
  ADD COLUMN IF NOT EXISTS checkout_secret_hash text,
  ADD COLUMN IF NOT EXISTS checkout_method text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'it_visitor_logs_checkout_method_check'
      AND conrelid = 'it_visitor_logs'::regclass
  ) THEN
    ALTER TABLE it_visitor_logs
      ADD CONSTRAINT it_visitor_logs_checkout_method_check
      CHECK (checkout_method IS NULL OR checkout_method IN ('self', 'staff'));
  END IF;

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

-- RLS remains unchanged: anonymous users never access the table directly.
NOTIFY pgrst, 'reload schema';

COMMIT;
