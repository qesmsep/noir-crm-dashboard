import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imagePath } = req.body;
    
    if (!imagePath) {
      return res.status(400).json({ error: 'Image path is required' });
    }

    // Extract filename from path (e.g., "/images/photo.jpg" -> "photo.jpg")
    const fileName = path.basename(imagePath);
    
    // Read the current page.js file
    const pagePath = path.join(process.cwd(), 'src', 'app', 'page.js');
    let pageContent = fs.readFileSync(pagePath, 'utf8');
    
    // Find and replace the image source
    const imageRegex = /src="\/images\/[^"]+"/;
    const newImageSrc = `src="${imagePath}"`;
    
    if (imageRegex.test(pageContent)) {
      pageContent = pageContent.replace(imageRegex, newImageSrc);
      
      // Write the updated content back to the file
      fs.writeFileSync(pagePath, pageContent, 'utf8');
      
      res.status(200).json({ 
        message: 'Current image updated successfully',
        newImagePath: imagePath
      });
    } else {
      res.status(400).json({ error: 'Could not find image source to replace' });
    }
  } catch (error) {
    console.error('Error updating current image:', error);
    res.status(500).json({ error: 'Failed to update current image' });
  }
}
