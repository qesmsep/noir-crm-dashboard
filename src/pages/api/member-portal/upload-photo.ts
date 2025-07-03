import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase';
import formidable from 'formidable';
import { promises as fs } from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'member-photos');

// Ensure upload directory exists
const ensureUploadDir = async () => {
  try {
    await fs.access(uploadDir);
  } catch {
    await fs.mkdir(uploadDir, { recursive: true });
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await ensureUploadDir();

    const form = formidable({
      uploadDir,
      keepExtensions: true,
      maxFileSize: 5 * 1024 * 1024, // 5MB
      filename: (name, ext, part) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        return `member-${uniqueSuffix}${ext}`;
      },
    });

    const [fields, files] = await form.parse(req);
    
    const member_id = Array.isArray(fields.member_id) ? fields.member_id[0] : fields.member_id;
    const photoFile = Array.isArray(files.photo) ? files.photo[0] : files.photo;

    if (!member_id || !photoFile) {
      return res.status(400).json({ error: 'Missing member_id or photo file' });
    }

    // Validate file type
    if (!photoFile.mimetype?.startsWith('image/')) {
      // Clean up uploaded file
      await fs.unlink(photoFile.filepath);
      return res.status(400).json({ error: 'Invalid file type. Please upload an image.' });
    }

    // Get user from authorization header (if using session-based auth)
    // For now, we'll skip auth validation for photo upload since it's part of the profile change workflow

    // Generate public URL for the uploaded file
    const filename = path.basename(photoFile.filepath);
    const photoUrl = `/uploads/member-photos/${filename}`;

    res.status(200).json({
      success: true,
      photo_url: photoUrl,
      filename,
    });
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
}