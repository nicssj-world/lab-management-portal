-- Add free-form reference range note to tests table
ALTER TABLE tests ADD COLUMN IF NOT EXISTS ref_note text;
