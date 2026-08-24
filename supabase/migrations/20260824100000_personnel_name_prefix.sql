ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name_prefix text;

DO $$ BEGIN
  ALTER TABLE profiles
    ADD CONSTRAINT profiles_name_prefix_check
    CHECK (name_prefix IS NULL OR name_prefix IN ('นาย', 'น.ส.', 'นาง'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
