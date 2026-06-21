-- Revision Draft Attachments — supporting files attached to an in-progress working revision draft.
-- Hard-deleted when the draft is published (Word/Excel source + official file are promoted to the
-- document separately and are NOT stored here).
-- Run in Supabase Dashboard > SQL Editor.

CREATE TABLE document_revision_draft_attachments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id     uuid        NOT NULL REFERENCES document_revision_drafts(id) ON DELETE CASCADE,
  document_id  uuid        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  file_url     text        NOT NULL,
  file_name    text        NOT NULL,
  file_size    bigint,
  mime_type    text,
  uploaded_by  uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX idx_draft_attachments_draft_id ON document_revision_draft_attachments(draft_id);

ALTER TABLE document_revision_draft_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON document_revision_draft_attachments FOR ALL TO service_role USING (true);
