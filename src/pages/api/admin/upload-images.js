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
    const imagesDir = path.join(process.cwd(), 'public', 'images');
    
    // Ensure images directory exists
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    const form = formidable({
      uploadDir: imagesDir,
      keepExtensions: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB limit per file
      filter: ({ mimetype }) => {
        return mimetype && mimetype.includes('image');
      },
    });

    const [fields, files] = await form.parse(req);
    const uploadedFiles = Array.isArray(files.images) ? files.images : [files.images];
    
    const results = uploadedFiles.map(file => {
      const newPath = path.join(imagesDir, file.originalFilename);
      
      // Rename file to remove temporary suffix
      if (file.filepath !== newPath) {
        fs.renameSync(file.filepath, newPath);
      }
      
      return {
        name: file.originalFilename,
        path: `/images/${file.originalFilename}`,
        size: file.size
      };
    });

    res.status(200).json({ 
      message: 'Images uploaded successfully',
      files: results
    });
  } catch (error) {
    console.error('Error uploading images:', error);
    res.status(500).json({ error: 'Failed to upload images' });
  }
}
