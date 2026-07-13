ALTER TABLE document_links ADD COLUMN link_kind text NOT NULL DEFAULT 'related';
ALTER TABLE document_links ADD CONSTRAINT document_links_link_kind_check CHECK (link_kind IN ('related','set'));
CREATE INDEX idx_document_links_set ON document_links(document_id) WHERE link_kind = 'set';
ALTER TABLE documents ADD COLUMN pending_file_url text;
ALTER TABLE documents ADD COLUMN pending_file_name text;
ALTER TABLE documents ADD COLUMN pending_file_size bigint;
ALTER TABLE documents ADD COLUMN pending_file_mime text;
ALTER TABLE document_attachments ADD COLUMN ephemeral boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM document_attachments
    GROUP BY document_id, file_url
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot create uq_document_attachments_document_file_url: duplicate (document_id, file_url) rows exist in document_attachments. Resolve duplicates manually, then rerun this migration.';
  END IF;
END;
$$;

CREATE UNIQUE INDEX uq_document_attachments_document_file_url
  ON document_attachments(document_id, file_url);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM document_revision_draft_attachments
    GROUP BY draft_id, file_url
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot create uq_document_revision_draft_attachments_draft_file_url: duplicate (draft_id, file_url) rows exist in document_revision_draft_attachments. Resolve duplicates manually, then rerun this migration.';
  END IF;
END;
$$;

CREATE UNIQUE INDEX uq_document_revision_draft_attachments_draft_file_url
  ON document_revision_draft_attachments(draft_id, file_url);

-- A Published member with an active draft is ambiguous in legacy set data: the old
-- schema did not record whether that draft belonged to this set. Refuse to guess.
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

-- Existing non-Published members were created by register-set; Published members
-- without an active draft were display-only links. Ambiguous active drafts were
-- rejected by the preflight above.
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
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   uuid        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  actor_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  upload_kind   text        NOT NULL CHECK (upload_kind IN ('register', 'attach', 'revise-existing')),
  storage_key   text        NOT NULL UNIQUE,
  file_name     text        NOT NULL,
  file_size     bigint      NOT NULL CHECK (file_size >= 0 AND file_size <= 52428800),
  mime_type     text        NOT NULL,
  expires_at    timestamptz NOT NULL,
  claimed_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_set_uploads_expired_unclaimed
  ON document_set_uploads(expires_at)
  WHERE claimed_at IS NULL;

ALTER TABLE document_set_uploads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE document_set_uploads FROM anon, authenticated;
GRANT ALL ON TABLE document_set_uploads TO service_role;
