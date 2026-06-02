-- Add updated_at to equipment table and auto-update trigger
-- Run in Supabase Dashboard → SQL Editor

ALTER TABLE equipment
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Back-fill existing rows so updated_at = created_at
UPDATE equipment SET updated_at = created_at WHERE updated_at IS NULL;

-- Trigger function (reuse if already exists from another table)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger on equipment
DROP TRIGGER IF EXISTS equipment_set_updated_at ON equipment;
CREATE TRIGGER equipment_set_updated_at
  BEFORE UPDATE ON equipment
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
