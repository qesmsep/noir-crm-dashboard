import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from '../../../lib/auth';

// Initialize Supabase client with service role for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check admin authentication
    const session = await getServerSession(req, res);
    if (!session?.isAdmin) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const location = (req.query.location as string) || 'noirkc';
    const { fileName } = req.body;

    if (!fileName) {
      return res.status(400).json({ error: 'File name is required' });
    }

    const bucketName = 'menu-images';
    const storagePath = `${location}/${fileName}`;

    // Delete from Supabase Storage
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

    res.status(200).json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting menu file:', error);
    res.status(500).json({
      error: 'Failed to delete file',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}