-- Add avatar_url column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Create avatars storage bucket (public read, auth write)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own avatar
CREATE POLICY "Users can upload own avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND name = auth.uid()::text);

CREATE POLICY "Users can update own avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND name = auth.uid()::text);

CREATE POLICY "Avatars are publicly readable" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');
