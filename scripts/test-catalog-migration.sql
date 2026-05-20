-- Test Catalog Migration
-- Adds new columns to tests table and creates related tables

ALTER TABLE tests ADD COLUMN IF NOT EXISTS lis_code text;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS short_name text;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS department text;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS instrument text;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS methodology_note text;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS tat_minutes int;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS urgent_tat_minutes int;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS available_24hr boolean DEFAULT false;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS tube_color text;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS transport_condition text;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS specimen_note text;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users;

CREATE TABLE IF NOT EXISTS test_reference_ranges (
  id          bigserial PRIMARY KEY,
  test_id     bigint NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  gender      text CHECK (gender IN ('M','F','All')),
  min_age     numeric,
  max_age     numeric,
  lower_limit numeric,
  upper_limit numeric,
  unit        text,
  note        text,
  sort_order  int DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_ref_ranges_test_id ON test_reference_ranges(test_id);

CREATE TABLE IF NOT EXISTS test_documents (
  id           bigserial PRIMARY KEY,
  test_id      bigint NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  doc_type     text NOT NULL CHECK (doc_type IN ('SOP','WI','Form','Other')),
  name         text NOT NULL,
  storage_path text NOT NULL,
  uploaded_by  uuid REFERENCES auth.users,
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_test_docs_test_id ON test_documents(test_id);

ALTER TABLE test_reference_ranges ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ref_ranges_read" ON test_reference_ranges;
CREATE POLICY "ref_ranges_read" ON test_reference_ranges FOR SELECT USING (true);

DROP POLICY IF EXISTS "test_docs_read" ON test_documents;
CREATE POLICY "test_docs_read" ON test_documents FOR SELECT USING (true);
