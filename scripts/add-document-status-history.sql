-- Add status transition history for the Documents module.
-- Run manually in Supabase Dashboard > SQL Editor.

CREATE TABLE IF NOT EXISTS document_status_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  from_status text CHECK (from_status IS NULL OR from_status IN ('Draft','Review','Approved','Published','Obsolete')),
  to_status   text NOT NULL CHECK (to_status IN ('Draft','Review','Approved','Published','Obsolete')),
  changed_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  changed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_status_history_document_id_changed_at
  ON document_status_history (document_id, changed_at);

ALTER TABLE document_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated read document status history" ON document_status_history;
CREATE POLICY "authenticated read document status history"
  ON document_status_history FOR SELECT TO authenticated USING (true);

-- Seed one baseline row for existing documents. Earlier transitions cannot be reconstructed,
-- so this records the current status at the document creation time as a starting point.
INSERT INTO document_status_history (document_id, from_status, to_status, changed_at)
SELECT d.id, NULL, d.status, COALESCE(d.created_at, now())
FROM documents d
WHERE NOT EXISTS (
  SELECT 1
  FROM document_status_history h
  WHERE h.document_id = d.id
);
