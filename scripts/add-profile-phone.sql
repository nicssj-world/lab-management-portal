-- Add a self-service phone number field for staff profiles.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text;
