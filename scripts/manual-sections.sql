-- Manual sections CMS
-- Run via Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS manual_sections (
  id          TEXT        PRIMARY KEY,
  body_html_th TEXT       NOT NULL DEFAULT '',
  body_html_en TEXT       NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Remove id check constraint if it exists (from earlier version)
DO $$ BEGIN
  ALTER TABLE manual_sections DROP CONSTRAINT IF EXISTS manual_sections_id_check;
EXCEPTION WHEN others THEN NULL;
END $$;

ALTER TABLE manual_sections ENABLE ROW LEVEL SECURITY;

-- Public can read (for public /manual page)
DROP POLICY IF EXISTS "manual_public_read" ON manual_sections;
CREATE POLICY "manual_public_read"
  ON manual_sections FOR SELECT
  USING (true);

-- Authenticated users can insert/update (API routes enforce role check)
DROP POLICY IF EXISTS "manual_auth_write" ON manual_sections;
CREATE POLICY "manual_auth_write"
  ON manual_sections FOR ALL
  USING (auth.role() = 'authenticated');

-- Seed one empty row per section (edit via staff portal)
INSERT INTO manual_sections (id) VALUES
  ('home'), ('collection'), ('transport'), ('addon'), ('report'), ('outlab')
ON CONFLICT (id) DO NOTHING;
