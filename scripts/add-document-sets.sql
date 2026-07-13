ALTER TABLE document_links ADD COLUMN link_kind text NOT NULL DEFAULT 'related';
ALTER TABLE document_links ADD CONSTRAINT document_links_link_kind_check CHECK (link_kind IN ('related','set'));
CREATE INDEX idx_document_links_set ON document_links(document_id) WHERE link_kind = 'set';
ALTER TABLE documents ADD COLUMN pending_file_url text;
ALTER TABLE documents ADD COLUMN pending_file_name text;
ALTER TABLE documents ADD COLUMN pending_file_size bigint;
ALTER TABLE documents ADD COLUMN pending_file_mime text;
ALTER TABLE document_attachments ADD COLUMN ephemeral boolean NOT NULL DEFAULT false;
