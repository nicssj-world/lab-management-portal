-- IT working group override (คณะทำงาน IT): grants admin-equivalent edit access to the
-- whole งาน IT module (access register + downtime log + backup log) regardless of the
-- person's role, without touching their role-based permissions anywhere else.
-- Mirrors equipment_editors (scripts/equipment-readiness-patch.sql).
-- Run in Supabase Dashboard → SQL Editor.

CREATE TABLE IF NOT EXISTS it_editors (
  user_id    uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  updated_by uuid REFERENCES profiles(id),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE it_editors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "it_editors_select" ON it_editors FOR SELECT TO authenticated USING (true);
