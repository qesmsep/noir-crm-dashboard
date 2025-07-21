-- Migration to update transaction attachments to support multiple file types
-- This updates the storage bucket to allow various document and image formats

-- Update the storage bucket to allow multiple file types
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/rtf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/zip',
  'application/x-rar-compressed'
]
WHERE id = 'transaction-attachments';

-- Verify the update
SELECT id, name, allowed_mime_types 
FROM storage.buckets 
WHERE id = 'transaction-attachments'; 