-- Fix menu-images bucket RLS policy
-- This allows public read access to menu images so they display on the landing pages

-- Allow anyone to view menu images (public read access)
CREATE POLICY "Public Access" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'menu-images');
