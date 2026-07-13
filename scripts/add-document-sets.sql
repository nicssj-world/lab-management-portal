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
