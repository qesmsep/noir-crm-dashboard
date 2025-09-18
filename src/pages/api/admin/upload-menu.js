import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

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
    const menuDir = path.join(process.cwd(), 'public', 'menu');
    
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
        path: `/menu/${file.originalFilename}`,
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
