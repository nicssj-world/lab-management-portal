-- Satisfaction survey editor override (ผู้ได้รับมอบหมายแบบสำรวจความพึงพอใจ):
-- grants edit access to the whole แบบสำรวจความพึงพอใจ module regardless of the
-- person's role, without touching their role-based permissions anywhere else.
-- Mirrors it_editors (scripts/add-it-access-editors.sql).
-- Run in Supabase Dashboard → SQL Editor.

CREATE TABLE IF NOT EXISTS satisfaction_editors (
  user_id    uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  updated_by uuid REFERENCES profiles(id),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE satisfaction_editors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "satisfaction_editors_select" ON satisfaction_editors FOR SELECT TO authenticated USING (true);
