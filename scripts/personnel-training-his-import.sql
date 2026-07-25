-- HIS training import provenance and duplicate protection.
-- Run in Supabase SQL Editor after the personnel module migrations. Safe to re-run.

CREATE TABLE IF NOT EXISTS staff_training_import_batches (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode           text NOT NULL CHECK (mode IN ('self', 'bulk')),
  imported_by    uuid NOT NULL REFERENCES profiles(id),
  file_count     integer NOT NULL DEFAULT 0 CHECK (file_count >= 0),
  row_count      integer NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  inserted_count integer NOT NULL DEFAULT 0 CHECK (inserted_count >= 0),
  skipped_count  integer NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
  error_count    integer NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE staff_training ADD COLUMN IF NOT EXISTS source_system text;
ALTER TABLE staff_training ADD COLUMN IF NOT EXISTS source_record_id text;
ALTER TABLE staff_training ADD COLUMN IF NOT EXISTS source_details jsonb;
ALTER TABLE staff_training ADD COLUMN IF NOT EXISTS import_batch_id uuid REFERENCES staff_training_import_batches(id);

DO $$ BEGIN
  ALTER TABLE staff_training
    ADD CONSTRAINT staff_training_source_record_unique
    UNIQUE (profile_id, source_system, source_record_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS staff_training_import_batch_idx ON staff_training(import_batch_id);
CREATE INDEX IF NOT EXISTS staff_training_import_batches_actor_idx ON staff_training_import_batches(imported_by, created_at DESC);

ALTER TABLE staff_training_import_batches ENABLE ROW LEVEL SECURITY;

