import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const location = (req.query.location as string) || 'noirkc';

    // In production, use Supabase Storage
    if (process.env.NODE_ENV === 'production') {
      const bucketName = 'menu-images';

      // List files from Supabase Storage
      const { data: files, error } = await supabase.storage
        .from(bucketName)
        .list(location, {
          sortBy: { column: 'name', order: 'asc' }
        });

      if (error || !files || files.length === 0) {
        // Return empty array if no files or error
        return res.status(200).json([]);
      }

      // Transform to expected format with public URLs
      const filesWithUrls = files.map(file => {
        const { data: { publicUrl } } = supabase.storage
          .from(bucketName)
          .getPublicUrl(`${location}/${file.name}`);

        return {
          name: file.name,
          path: publicUrl,
          size: file.metadata?.size || 0
        };
      });

      return res.status(200).json(filesWithUrls);
    } else {
      // In development, read from filesystem
      const menuDir = path.join(process.cwd(), 'public', 'menu', location);

      if (!fs.existsSync(menuDir)) {
        return res.status(200).json([]);
      }

      const files = fs.readdirSync(menuDir)
        .filter(file => {
          const ext = path.extname(file).toLowerCase();
          return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext);
        })
        .map(file => {
          const filePath = path.join(menuDir, file);
          const stats = fs.statSync(filePath);

          return {
            name: file,
            path: `/menu/${location}/${file}`,
            size: stats.size
          };
        });

      return res.status(200).json(files);
    }
  } catch (error) {
    console.error('Error listing menu files:', error);
    res.status(500).json({
      error: 'Failed to list files',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}