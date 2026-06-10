-- Document Attachments — supporting files for review workflow
-- Run in Supabase Dashboard > SQL Editor

CREATE TABLE document_attachments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  uuid        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  file_url     text        NOT NULL,
  file_name    text        NOT NULL,
  file_size    bigint,
  mime_type    text,
  uploaded_by  uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX idx_doc_attachments_document_id ON document_attachments(document_id);

ALTER TABLE document_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON document_attachments FOR ALL TO service_role USING (true);
