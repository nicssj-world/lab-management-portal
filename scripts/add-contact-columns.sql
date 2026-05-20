-- Add contact fields to tests table
ALTER TABLE tests ADD COLUMN IF NOT EXISTS contact_name  text;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE tests ADD COLUMN IF NOT EXISTS contact_note  text;
