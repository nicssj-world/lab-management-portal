CREATE TABLE IF NOT EXISTS system_changelog (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  date          date        NOT NULL DEFAULT CURRENT_DATE,
  category      text        NOT NULL DEFAULT 'อื่นๆ',
  title         text        NOT NULL,
  description   text,
  changed_by    text        NOT NULL,
  changed_by_id uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS system_changelog_date_idx ON system_changelog (date DESC);

-- Enable RLS (mutations go through service role / supabaseAdmin)
ALTER TABLE system_changelog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read changelog" ON system_changelog FOR SELECT USING (true);
