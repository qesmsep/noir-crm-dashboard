-- Drop B-tree index on photo column
-- B-tree indexes have an 8KB limit which prevents storing base64-encoded photos
-- Photos don't need to be indexed as we never search by photo data

DROP INDEX IF EXISTS idx_members_photo;
DROP INDEX IF EXISTS idx_members_photo_url;

-- Note: We keep the photo column for storing base64-encoded images
-- The index removal allows photos up to ~50KB base64 (400x400 @ 80% quality)
COMMENT ON COLUMN members.photo IS 'Base64-encoded profile photo (JPEG). No index to avoid 8KB B-tree limit.';
