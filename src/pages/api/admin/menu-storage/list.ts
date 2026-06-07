import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

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
    const bucketName = 'menu-images';

    // List files from Supabase Storage
    const { data: files, error } = await supabase.storage
      .from(bucketName)
      .list(location, {
        sortBy: { column: 'name', order: 'asc' }
      });

    if (error) {
      console.error('Supabase list error:', error);
      // If bucket doesn't exist or no files, return empty array
      return res.status(200).json([]);
    }

    // Transform to expected format with public URLs
    const filesWithUrls = (files || []).map(file => {
      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(`${location}/${file.name}`);

      return {
        name: file.name,
        path: publicUrl,
        size: file.metadata?.size || 0,
        lastModified: file.updated_at
      };
    });

    res.status(200).json(filesWithUrls);
  } catch (error) {
    console.error('Error listing menu files:', error);
    res.status(500).json({
      error: 'Failed to list files',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}