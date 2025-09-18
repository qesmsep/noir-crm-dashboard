import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const menuDir = path.join(process.cwd(), 'public', 'menu');
    
    if (!fs.existsSync(menuDir)) {
      return res.status(404).json({ error: 'Menu directory not found' });
    }

    const files = fs.readdirSync(menuDir);
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    
    const imageFiles = files
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return imageExtensions.includes(ext);
      })
      .map(file => {
        const filePath = path.join(menuDir, file);
        const stats = fs.statSync(filePath);
        
        return {
          name: file,
          path: `/menu/${file}`,
          size: stats.size
        };
      })
      .sort((a, b) => {
        // Natural sorting for numbered files
        const aNum = a.name.match(/\d+/);
        const bNum = b.name.match(/\d+/);
        
        if (aNum && bNum) {
          return parseInt(aNum[0]) - parseInt(bNum[0]);
        }
        
        return a.name.localeCompare(b.name);
      });

    res.status(200).json(imageFiles);
  } catch (error) {
    console.error('Error reading menu directory:', error);
    res.status(500).json({ error: 'Failed to read menu directory' });
  }
}
