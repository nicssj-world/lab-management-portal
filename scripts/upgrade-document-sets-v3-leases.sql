-- Lease-only upgrade: use this only when set_mode/set_draft_id and the
-- document_set_uploads table already exist, but none of the three lease columns
-- exist. This is the upgrade path from the cef3-era document-set schema.

BEGIN;

DO $$
DECLARE
  lease_column_count integer;
BEGIN
  IF to_regclass('public.document_set_uploads') IS NULL THEN
    RAISE EXCEPTION 'document_set_uploads does not exist. Use add-document-sets.sql or upgrade-document-sets-v2.sql instead.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'document_links' AND column_name = 'set_mode'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'document_links' AND column_name = 'set_draft_id'
  ) THEN
    RAISE EXCEPTION 'set_mode/set_draft_id ownership columns are missing. Use upgrade-document-sets-v2.sql instead.';
  END IF;

  SELECT count(*) INTO lease_column_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'document_set_uploads'
    AND column_name IN ('lease_token', 'lease_kind', 'lease_expires_at');

  IF lease_column_count <> 0 THEN
    RAISE EXCEPTION 'Expected zero lease columns, found %. If all three exist this migration is already applied; if only some exist, repair the partial schema manually.', lease_column_count;
  END IF;
END;
$$;

ALTER TABLE document_set_uploads ADD COLUMN lease_token uuid;
ALTER TABLE document_set_uploads ADD COLUMN lease_kind text;
ALTER TABLE document_set_uploads ADD COLUMN lease_expires_at timestamptz;

ALTER TABLE document_set_uploads
  ADD CONSTRAINT document_set_uploads_lease_kind_check
  CHECK (lease_kind IN ('register', 'cleanup'));
ALTER TABLE document_set_uploads
  ADD CONSTRAINT document_set_uploads_lease_consistency_check CHECK (
    (lease_token IS NULL AND lease_kind IS NULL AND lease_expires_at IS NULL)
    OR
    (lease_token IS NOT NULL AND lease_kind IS NOT NULL AND lease_expires_at IS NOT NULL)
  );

CREATE INDEX idx_document_set_uploads_active_leases
  ON document_set_uploads(lease_expires_at)
  WHERE claimed_at IS NULL AND lease_token IS NOT NULL;
CREATE INDEX idx_document_set_uploads_claimed_retention
  ON document_set_uploads(claimed_at)
  WHERE claimed_at IS NOT NULL;

COMMIT;
