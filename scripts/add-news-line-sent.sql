-- Track manual LINE OA broadcast of news items
-- Run manually in Supabase Dashboard → SQL Editor

ALTER TABLE news
  ADD COLUMN IF NOT EXISTS line_sent_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS line_sent_by text DEFAULT NULL;
