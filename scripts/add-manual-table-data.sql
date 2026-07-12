-- Adds JSON storage for data-driven manual tables.
-- Run manually in Supabase Dashboard -> SQL Editor. Safe to re-run.
ALTER TABLE manual_sections ADD COLUMN IF NOT EXISTS table_data jsonb;
