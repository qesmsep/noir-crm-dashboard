import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const location = req.query.location || 'noirkc';

    // In production, use Supabase Storage
    if (process.env.NODE_ENV === 'production') {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const bucketName = 'menu-images';
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

        const fileContent = fs.readFileSync(file.filepath);
        const storagePath = `${location}/${file.originalFilename}`;

        const { error } = await supabase.storage
          .from(bucketName)
          .upload(storagePath, fileContent, {
            contentType: file.mimetype || 'image/png',
            upsert: true
          });

        if (error) {
          console.error('Supabase upload error:', error);
          throw new Error(`Failed to upload ${file.originalFilename}: ${error.message}`);
        }

        const { data: { publicUrl } } = supabase.storage
          .from(bucketName)
          .getPublicUrl(storagePath);

        results.push({
          name: file.originalFilename,
          path: publicUrl,
          size: file.size
        });

        fs.unlinkSync(file.filepath);
      }

      return res.status(200).json({
        message: 'Files uploaded successfully',
        files: results
      });
    }

    // In development, use filesystem
    const menuDir = path.join(process.cwd(), 'public', 'menu', location);

    // Ensure menu directory exists
    if (!fs.existsSync(menuDir)) {
      fs.mkdirSync(menuDir, { recursive: true });
    }

    const form = formidable({
      uploadDir: menuDir,
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
      filter: ({ mimetype }) => {
        return mimetype && mimetype.includes('image');
      },
    });

    const [fields, files] = await form.parse(req);
    const uploadedFiles = Array.isArray(files.menuFiles) ? files.menuFiles : [files.menuFiles];

    const results = uploadedFiles.map(file => {
      const newPath = path.join(menuDir, file.originalFilename);

      // Rename file to remove temporary suffix
      if (file.filepath !== newPath) {
        fs.renameSync(file.filepath, newPath);
      }

      return {
        name: file.originalFilename,
        path: `/menu/${location}/${file.originalFilename}`,
        size: file.size
      };
    });

    res.status(200).json({
      message: 'Files uploaded successfully',
      files: results
    });
  } catch (error) {
    console.error('Error uploading menu files:', error);
    res.status(500).json({ error: 'Failed to upload files' });
  }
}
