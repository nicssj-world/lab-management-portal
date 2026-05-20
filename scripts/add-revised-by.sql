ALTER TABLE document_revisions
  ADD COLUMN IF NOT EXISTS revised_by text;
