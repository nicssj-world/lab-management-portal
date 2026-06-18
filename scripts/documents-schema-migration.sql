-- ============================================================
-- Document Control Module — Schema Migration
-- Run in Supabase Dashboard > SQL Editor
-- WARNING: Drops existing documents table and all data
-- ============================================================

-- Drop old table and dependencies
DROP TABLE IF EXISTS documents CASCADE;

-- ── Core documents table ──────────────────────────────────────
CREATE TABLE documents (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_code text        UNIQUE NOT NULL,
  title         text        NOT NULL,
  type          text        NOT NULL
                              CHECK (type IN ('QP','WI','Form','Policy','Manual','Record','Others')),
  department    text,
  revision      text        NOT NULL DEFAULT '1',
  status        text        NOT NULL DEFAULT 'Draft'
                              CHECK (status IN ('Draft','Review','Approved','Published','Obsolete')),
  visibility    text        NOT NULL DEFAULT 'Internal'
                              CHECK (visibility IN ('Public','Internal')),
  owner_id      uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  owner_name    text,
  description   text,
  tags          text[],
  file_url      text        NOT NULL,
  file_name     text        NOT NULL,
  file_size     bigint,
  mime_type     text,
  effective_date date,
  expiry_date   date,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- ── Revision history ─────────────────────────────────────────
CREATE TABLE document_revisions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     uuid        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  revision_number text        NOT NULL,
  revision_note   text,
  file_url        text        NOT NULL,
  file_name       text        NOT NULL,
  expiry_date     date,
  uploaded_by     uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now()
);

-- ── Access / audit log ────────────────────────────────────────
CREATE TABLE document_access_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid        REFERENCES documents(id) ON DELETE SET NULL,
  user_id     uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  action      text        NOT NULL
                            CHECK (action IN ('upload','download','edit','delete','publish')),
  created_at  timestamptz DEFAULT now()
);

-- ── updated_at trigger ────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS documents_updated_at ON documents;
CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE documents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_revisions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read documents"
  ON documents FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated read revisions"
  ON document_revisions FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated read access logs"
  ON document_access_logs FOR SELECT TO authenticated USING (true);

-- ── Storage bucket ────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "authenticated upload documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY "authenticated read documents storage"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents');

CREATE POLICY "authenticated delete documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents');
