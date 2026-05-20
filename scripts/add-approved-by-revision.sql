ALTER TABLE document_revisions
  ADD COLUMN IF NOT EXISTS approved_by text;
