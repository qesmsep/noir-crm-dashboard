import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const location = req.query.location || 'noirkc';
    const { fileName } = req.body;

    if (!fileName) {
      return res.status(400).json({ error: 'File name is required' });
    }

    // In production, use Supabase Storage
    if (process.env.NODE_ENV === 'production') {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const bucketName = 'menu-images';
      const storagePath = `${location}/${fileName}`;

      const { error } = await supabase.storage
        .from(bucketName)
        .remove([storagePath]);

      if (error) {
        console.error('Supabase delete error:', error);
        return res.status(500).json({
          error: 'Failed to delete file',
          details: error.message
        });
      }

      return res.status(200).json({ message: 'File deleted successfully' });
    }

    // In development, use filesystem
    const filePath = path.join(process.cwd(), 'public', 'menu', location, fileName);

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
