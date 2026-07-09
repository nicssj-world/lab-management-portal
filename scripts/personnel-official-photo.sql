-- Official personnel photo (uniform / formal photo used in official records),
-- separate from the display avatar (profiles.avatar_url).
-- Stored as a path in the private `staff-files` bucket; the server signs it for display.
-- Run manually in Supabase Dashboard → SQL Editor.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS official_photo_url text;

COMMENT ON COLUMN profiles.official_photo_url IS
  'Storage path in staff-files bucket for the official/uniform photo shown in the personnel record. Separate from avatar_url (display profile photo).';
