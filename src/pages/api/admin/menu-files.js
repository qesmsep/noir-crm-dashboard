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
        return imageExtensions.includes(ext) && file !== '.order.json';
      })
      .map(file => {
        const filePath = path.join(menuDir, file);
        const stats = fs.statSync(filePath);

        return {
          name: file,
          path: `/menu/${file}`,
          size: stats.size
        };
      });

    // Check if there's a saved order
    const orderFilePath = path.join(menuDir, '.order.json');
    let orderedFiles = imageFiles;

    if (fs.existsSync(orderFilePath)) {
      try {
        const orderData = JSON.parse(fs.readFileSync(orderFilePath, 'utf-8'));
        const { order } = orderData;

        if (Array.isArray(order)) {
          // Sort files according to saved order
          const fileMap = new Map(imageFiles.map(f => [f.name, f]));
          orderedFiles = order
            .map(name => fileMap.get(name))
            .filter(Boolean); // Remove any files that no longer exist

          // Append any new files that aren't in the saved order
          const orderedNames = new Set(order);
          const newFiles = imageFiles.filter(f => !orderedNames.has(f.name));
          orderedFiles = [...orderedFiles, ...newFiles];
        }
      } catch (error) {
        console.error('Error reading order file:', error);
        // Fall back to default sorting
      }
    }

    // Default sorting if no saved order
    if (orderedFiles === imageFiles) {
      orderedFiles = imageFiles.sort((a, b) => {
        // Natural sorting for numbered files
        const aNum = a.name.match(/\d+/);
        const bNum = b.name.match(/\d+/);

        if (aNum && bNum) {
          return parseInt(aNum[0]) - parseInt(bNum[0]);
        }

        return a.name.localeCompare(b.name);
      });
    }

    res.status(200).json(orderedFiles);
  } catch (error) {
    console.error('Error reading menu directory:', error);
    res.status(500).json({ error: 'Failed to read menu directory' });
  }
}
