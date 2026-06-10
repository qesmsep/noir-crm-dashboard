-- Fix menu-images bucket RLS policy
-- This allows public read access to menu images so they display on the landing pages
--
-- NOTE: This policy already exists from migrations/20260607_create_menu_storage_bucket.sql
-- Created during investigation of "no menu pages available" issue (June 2026)
-- The actual fix was changing /api/admin/menu-files to use SERVICE_ROLE_KEY instead of ANON_KEY
-- Kept for reference and documentation purposes
--
-- If you run this, it will report "policy already exists" - that's expected and correct

-- Allow anyone to view menu images (public read access)
CREATE POLICY "Public Access" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'menu-images');
