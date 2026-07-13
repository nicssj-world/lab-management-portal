-- Upgrade only: use this when the earlier document-set schema already has
-- link_kind, pending document-file columns, ephemeral attachments, and both
-- attachment natural-key unique indexes. Do not run after add-document-sets.sql.

BEGIN;

-- Legacy Published members with an active draft are ambiguous because the
-- earlier schema did not record set ownership. Stop before changing the schema.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM document_links links
    JOIN documents member ON member.id = links.linked_doc_id
    JOIN document_revision_drafts draft ON draft.document_id = member.id
      AND draft.cancelled_at IS NULL
      AND draft.status <> 'Published'
    WHERE links.link_kind = 'set'
      AND member.status = 'Published'
  ) THEN
    RAISE EXCEPTION 'Cannot infer set revision ownership for existing Published set members with active drafts. Classify those links manually before applying this migration; no draft will be adopted automatically.';
  END IF;
END;
$$;

ALTER TABLE document_links ADD COLUMN set_mode text;
ALTER TABLE document_links ADD COLUMN set_draft_id uuid REFERENCES document_revision_drafts(id);

UPDATE document_links links
SET set_mode = CASE WHEN member.status = 'Published' THEN 'linked' ELSE 'registered' END
FROM documents member
WHERE links.link_kind = 'set'
  AND links.linked_doc_id = member.id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM document_links
    WHERE link_kind = 'set' AND set_mode IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot enforce document_links set_mode: one or more set links could not be classified. Resolve the orphaned member rows manually, then rerun the constraint section.';
  END IF;

  IF EXISTS (
    SELECT set_draft_id
    FROM document_links
    WHERE set_draft_id IS NOT NULL
    GROUP BY set_draft_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot create uq_document_links_set_draft_id: one revision draft is assigned to more than one set. Resolve ownership manually; no rows were deleted.';
  END IF;
END;
$$;

ALTER TABLE document_links ADD CONSTRAINT document_links_set_mode_check CHECK (
  (link_kind = 'related' AND set_mode IS NULL AND set_draft_id IS NULL)
  OR
  (link_kind = 'set' AND set_mode IN ('registered', 'linked', 'revision'))
);
ALTER TABLE document_links ADD CONSTRAINT document_links_set_draft_consistency_check CHECK (
  (set_mode = 'revision' AND set_draft_id IS NOT NULL)
  OR
  (set_mode IS DISTINCT FROM 'revision' AND set_draft_id IS NULL)
);
CREATE UNIQUE INDEX uq_document_links_set_draft_id
  ON document_links(set_draft_id)
  WHERE set_draft_id IS NOT NULL AND link_kind = 'set';

CREATE TABLE document_set_uploads (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      uuid        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  actor_id         uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  upload_kind      text        NOT NULL CHECK (upload_kind IN ('register', 'attach', 'revise-existing')),
  storage_key      text        NOT NULL UNIQUE,
  file_name        text        NOT NULL,
  file_size        bigint      NOT NULL CHECK (file_size >= 0 AND file_size <= 52428800),
  mime_type        text        NOT NULL,
  expires_at       timestamptz NOT NULL,
  claimed_at       timestamptz,
  lease_token      uuid,
  lease_kind       text CHECK (lease_kind IN ('register', 'cleanup')),
  lease_expires_at timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_set_uploads_lease_consistency_check CHECK (
    (lease_token IS NULL AND lease_kind IS NULL AND lease_expires_at IS NULL)
    OR
    (lease_token IS NOT NULL AND lease_kind IS NOT NULL AND lease_expires_at IS NOT NULL)
  )
);

CREATE INDEX idx_document_set_uploads_expired_unclaimed
  ON document_set_uploads(expires_at)
  WHERE claimed_at IS NULL;
CREATE INDEX idx_document_set_uploads_active_leases
  ON document_set_uploads(lease_expires_at)
  WHERE claimed_at IS NULL AND lease_token IS NOT NULL;
CREATE INDEX idx_document_set_uploads_claimed_retention
  ON document_set_uploads(claimed_at)
  WHERE claimed_at IS NOT NULL;

ALTER TABLE document_set_uploads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE document_set_uploads FROM anon, authenticated;
GRANT ALL ON TABLE document_set_uploads TO service_role;

COMMIT;
