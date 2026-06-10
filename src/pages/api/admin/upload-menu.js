import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { withRateLimitAndAuth } from '../../../lib/api-auth';

export const config = {
  api: {
    bodyParser: false,
  },
};

const ALLOWED_LOCATIONS = ['noirkc', 'rooftopkc'];
const MAX_FILES_PER_UPLOAD = 20;

/**
 * Sanitize filename to prevent path traversal attacks.
 * Only allows alphanumeric, dash, underscore, space, and dot.
 * Removes any path separators and parent directory references.
 * Max length: 255 characters.
 */
function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return null;
  }

  // Prevent excessively long filenames
  if (filename.length > 255) {
    return null;
  }

  // Remove any path components (/, \, .., etc)
  const basename = path.basename(filename);

  // Only allow safe characters: alphanumeric, dash, underscore, space, dot
  const sanitized = basename.replace(/[^a-zA-Z0-9\-_. ]/g, '');

  // Prevent empty filenames or filenames that are just dots
  if (!sanitized || sanitized === '.' || sanitized === '..') {
    return null;
  }

  return sanitized;
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const location = req.query.location || 'noirkc';

    // Validate location
    if (!ALLOWED_LOCATIONS.includes(location)) {
      return res.status(400).json({ error: 'Invalid location' });
    }

    // In production, use Supabase Storage
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(500).json({ error: 'Server configuration error' });
      }

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const bucketName = 'menu-images';
      const form = formidable({
        maxFileSize: 10 * 1024 * 1024, // 10MB limit
      });

      const [fields, files] = await form.parse(req);

      // Handle undefined/null files and convert to array
      if (!files.menuFiles) {
        return res.status(400).json({ error: 'No files provided' });
      }

      const uploadedFiles = Array.isArray(files.menuFiles) ? files.menuFiles : [files.menuFiles];

      // Filter out null/undefined entries
      const validFiles = uploadedFiles.filter(file => file != null);

      if (validFiles.length === 0) {
        return res.status(400).json({ error: 'No valid files provided' });
      }

      // Enforce file count limit
      if (validFiles.length > MAX_FILES_PER_UPLOAD) {
        return res.status(400).json({
          error: `Too many files (max ${MAX_FILES_PER_UPLOAD})`
        });
      }

      const results = [];
      const ALLOWED_MIMETYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

      for (const file of validFiles) {
        // Validate file type
        if (!file.mimetype || !ALLOWED_MIMETYPES.includes(file.mimetype)) {
          console.error('Invalid file type:', file.mimetype);
          // Clean up temp file
          try {
            await fs.promises.unlink(file.filepath);
          } catch (e) {
            console.error('Failed to clean up temp file:', e);
          }
          return res.status(400).json({ error: 'Invalid file type. Only images are allowed.' });
        }

        // Sanitize filename to prevent path traversal
        const sanitizedFilename = sanitizeFilename(file.originalFilename);

        if (!sanitizedFilename) {
          console.error('Invalid filename:', file.originalFilename);
          // Clean up temp file
          try {
            await fs.promises.unlink(file.filepath);
          } catch (e) {
            console.error('Failed to clean up temp file:', e);
          }
          return res.status(400).json({ error: 'Invalid filename' });
        }

        const fileContent = await fs.promises.readFile(file.filepath);
        const storagePath = `${location}/${sanitizedFilename}`;

        const { error } = await supabase.storage
          .from(bucketName)
          .upload(storagePath, fileContent, {
            contentType: file.mimetype,
            upsert: true
          });

        if (error) {
          console.error('Supabase upload error:', error);
          // Clean up temp file
          try {
            await fs.promises.unlink(file.filepath);
          } catch (e) {
            console.error('Failed to clean up temp file:', e);
          }
          return res.status(500).json({ error: 'Failed to upload file' });
        }

        const { data: { publicUrl } } = supabase.storage
          .from(bucketName)
          .getPublicUrl(storagePath);

        results.push({
          name: sanitizedFilename,
          path: publicUrl,
          size: file.size
        });

        await fs.promises.unlink(file.filepath);
      }

      return res.status(200).json({
        message: 'Files uploaded successfully',
        files: results
      });
    }

    // In development, use filesystem
    const menuDir = path.join(process.cwd(), 'public', 'menu', location);

    // Ensure menu directory exists
    await fs.promises.mkdir(menuDir, { recursive: true });

    const form = formidable({
      uploadDir: menuDir,
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
      filter: ({ mimetype }) => {
        return mimetype && mimetype.includes('image');
      },
    });

    const [fields, files] = await form.parse(req);

    // Handle undefined/null files
    if (!files.menuFiles) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const uploadedFiles = Array.isArray(files.menuFiles) ? files.menuFiles : [files.menuFiles];

    // Filter out null/undefined entries
    const validFiles = uploadedFiles.filter(file => file != null);

    if (validFiles.length === 0) {
      return res.status(400).json({ error: 'No valid files provided' });
    }

    // Enforce file count limit
    if (validFiles.length > MAX_FILES_PER_UPLOAD) {
      return res.status(400).json({
        error: `Too many files (max ${MAX_FILES_PER_UPLOAD})`
      });
    }

    const results = [];

    for (const file of validFiles) {
      // Sanitize filename to prevent path traversal
      const sanitizedFilename = sanitizeFilename(file.originalFilename);

      if (!sanitizedFilename) {
        console.error('Invalid filename:', file.originalFilename);
        return res.status(400).json({ error: 'Invalid filename' });
      }

      const newPath = path.join(menuDir, sanitizedFilename);

      // Rename file to remove temporary suffix
      if (file.filepath !== newPath) {
        await fs.promises.rename(file.filepath, newPath);
      }

      results.push({
        name: sanitizedFilename,
        path: `/menu/${location}/${sanitizedFilename}`,
        size: file.size
      });
    }

    res.status(200).json({
      message: 'Files uploaded successfully',
      files: results
    });
  } catch (error) {
    console.error('Error uploading menu files:', error);
    res.status(500).json({ error: 'Failed to upload files' });
  }
}

export default withRateLimitAndAuth(handler);
