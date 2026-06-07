import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import fs from 'fs';
import { getServerSession } from '../../../lib/auth';

// Initialize Supabase client with service role for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check admin authentication
    const session = await getServerSession(req, res);
    if (!session?.isAdmin) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const location = (req.query.location as string) || 'noirkc';
    const bucketName = 'menu-images';

    // Parse the form data
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
    });

    const [fields, files] = await form.parse(req);
    const uploadedFiles = Array.isArray(files.menuFiles) ? files.menuFiles : [files.menuFiles];

    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const results = [];

    for (const file of uploadedFiles) {
      if (!file) continue;

      // Read file content
      const fileContent = fs.readFileSync(file.filepath);

      // Create path in storage: location/filename
      const storagePath = `${location}/${file.originalFilename}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(storagePath, fileContent, {
          contentType: file.mimetype || 'image/png',
          upsert: true // Overwrite if exists
        });

      if (error) {
        console.error('Supabase upload error:', error);
        throw new Error(`Failed to upload ${file.originalFilename}: ${error.message}`);
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(storagePath);

      results.push({
        name: file.originalFilename,
        path: publicUrl,
        size: file.size
      });

      // Clean up temp file
      fs.unlinkSync(file.filepath);
    }

    res.status(200).json({
      message: 'Files uploaded successfully',
      files: results
    });
  } catch (error) {
    console.error('Error uploading menu files:', error);
    res.status(500).json({
      error: 'Failed to upload files',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}