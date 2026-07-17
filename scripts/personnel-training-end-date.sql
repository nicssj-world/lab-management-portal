-- MT-CBH Staff / Personnel Module — Training end date (multi-day trainings)
-- Run via Supabase Dashboard → SQL Editor. Safe to re-run.

ALTER TABLE staff_training ADD COLUMN IF NOT EXISTS training_end_date date;
