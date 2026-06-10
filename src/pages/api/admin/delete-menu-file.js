import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { withRateLimitAndAuth } from '../../../lib/api-auth';

const ALLOWED_LOCATIONS = ['noirkc', 'rooftopkc'];

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
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const location = req.query.location || 'noirkc';
    const { fileName } = req.body;

    // Validate location
    if (!ALLOWED_LOCATIONS.includes(location)) {
      return res.status(400).json({ error: 'Invalid location' });
    }

    if (!fileName) {
      return res.status(400).json({ error: 'File name is required' });
    }

    // Validate fileName is a string
    if (typeof fileName !== 'string') {
      return res.status(400).json({ error: 'File name must be a string' });
    }

    // Sanitize filename to prevent path traversal
    const sanitizedFilename = sanitizeFilename(fileName);

    if (!sanitizedFilename) {
      return res.status(400).json({ error: 'Invalid file name' });
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
      const storagePath = `${location}/${sanitizedFilename}`;

      const { error } = await supabase.storage
        .from(bucketName)
        .remove([storagePath]);

      if (error) {
        console.error('Supabase delete error:', error);
        return res.status(500).json({ error: 'Failed to delete file' });
      }

      return res.status(200).json({ message: 'File deleted successfully' });
    }

    // In development, use filesystem
    const filePath = path.join(process.cwd(), 'public', 'menu', location, sanitizedFilename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Delete the file
    fs.unlinkSync(filePath);

    res.status(200).json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting menu file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
}

export default withRateLimitAndAuth(handler);
