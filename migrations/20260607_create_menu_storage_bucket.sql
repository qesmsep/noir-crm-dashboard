-- Create menu-images storage bucket for menu files
-- This replaces the filesystem-based storage that doesn't work on Vercel

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'menu-images',
  'menu-images',
  true, -- Public bucket so images can be accessed directly
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

-- Set up RLS policies for the bucket
-- Allow anyone to view (since it's a public bucket)
CREATE POLICY "Public Access" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'menu-images');

-- Only authenticated admins can upload/update/delete
CREATE POLICY "Admin Upload" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'menu-images'
    AND EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Admin Update" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'menu-images'
    AND EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Admin Delete" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'menu-images'
    AND EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE admin_users.email = auth.jwt()->>'email'
    )
  );

-- Note: After running this migration, you'll need to:
-- 1. Upload existing menu images to Supabase Storage
-- 2. Update the frontend to use the new /api/admin/menu-storage/* endpoints
-- 3. The old filesystem-based endpoints will continue to work locally but not in production