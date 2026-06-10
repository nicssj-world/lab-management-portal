-- Document Links — link existing documents as related/reference docs
-- Run in Supabase Dashboard > SQL Editor

CREATE TABLE document_links (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id    uuid        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  linked_doc_id  uuid        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  created_by     uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     timestamptz DEFAULT now(),
  UNIQUE(document_id, linked_doc_id)
);

CREATE INDEX idx_document_links_document_id ON document_links(document_id);

ALTER TABLE document_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON document_links FOR ALL TO service_role USING (true);
