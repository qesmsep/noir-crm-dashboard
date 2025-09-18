import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const menuDir = path.join(process.cwd(), 'public', 'menu');
    
    // Check if directory exists
    if (!fs.existsSync(menuDir)) {
      return res.status(404).json({ error: 'Menu directory not found' });
    }

    // Read all files in the menu directory
    const files = fs.readdirSync(menuDir);
    
    // Filter for image files (png, jpg, jpeg, gif, webp)
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return imageExtensions.includes(ext);
    });

    // Sort files naturally (handles numbered files better)
    const sortedFiles = imageFiles.sort((a, b) => {
      // Extract numbers from filenames for natural sorting
      const aNum = a.match(/\d+/);
      const bNum = b.match(/\d+/);
      
      if (aNum && bNum) {
        return parseInt(aNum[0]) - parseInt(bNum[0]);
      }
      
      // If no numbers, sort alphabetically
      return a.localeCompare(b);
    });

    // Convert to full paths
    const imagePaths = sortedFiles.map(file => `/menu/${file}`);
    
    res.status(200).json(imagePaths);
  } catch (error) {
    console.error('Error reading menu directory:', error);
    res.status(500).json({ error: 'Failed to read menu directory' });
  }
}
