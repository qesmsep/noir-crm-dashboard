import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const imagesDir = path.join(process.cwd(), 'public', 'images');
    
    if (!fs.existsSync(imagesDir)) {
      return res.status(404).json({ error: 'Images directory not found' });
    }

    const files = fs.readdirSync(imagesDir);
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    
    // Filter for potential homepage images (exclude logos, icons, etc.)
    const homepageImages = files
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        const isImage = imageExtensions.includes(ext);
        const isNotLogo = !file.toLowerCase().includes('logo') && 
                         !file.toLowerCase().includes('noir-wedding') &&
                         !file.toLowerCase().includes('cloud-');
        return isImage && isNotLogo;
      })
      .map(file => {
        const filePath = path.join(imagesDir, file);
        const stats = fs.statSync(filePath);
        
        return {
          name: file,
          path: `/images/${file}`,
          size: stats.size,
          current: false // This would need to be determined by checking the current page.js
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    res.status(200).json(homepageImages);
  } catch (error) {
    console.error('Error reading images directory:', error);
    res.status(500).json({ error: 'Failed to read images directory' });
  }
}
