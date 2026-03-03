import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import OpenAI from 'openai';

export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Inventory Photo Scan API
 * POST: Upload an image and use AI (OpenAI Vision) to identify bottles and quantities
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = formidable({ maxFileSize: 20 * 1024 * 1024 });
    const [fields, files] = await form.parse(req);

    const imageFile = Array.isArray(files.image) ? files.image[0] : files.image;
    if (!imageFile) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    let existingItems: { id: string; name: string; brand: string }[] = [];
    try {
      const raw = Array.isArray(fields.existing_items)
        ? fields.existing_items[0]
        : fields.existing_items;
      if (raw) existingItems = JSON.parse(raw);
    } catch {}

    // Read image and convert to base64
    const imageBuffer = fs.readFileSync(imageFile.filepath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = imageFile.mimetype || 'image/jpeg';

    // Call OpenAI Vision
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const existingItemsList = existingItems.length > 0
      ? `\n\nExisting inventory items for matching:\n${existingItems.map((i) => `- ${i.brand ? i.brand + ' ' : ''}${i.name} (ID: ${i.id})`).join('\n')}`
      : '';

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a bar inventory scanning assistant. Analyze photos of bar shelves, back bars, and storage areas to identify bottles, brands, and estimate quantities.

Return your response as a JSON array of items found. Each item should have:
- name: the product name (e.g., "Vodka", "Gin")
- brand: the brand name if visible (e.g., "Grey Goose", "Hendrick's")
- category: one of "spirits", "wine", "beer", "mixers", "garnishes", "supplies", "other"
- estimated_quantity: number of bottles/units visible
- unit: "bottle", "can", "keg", "each"
- confidence: 0.0-1.0 how confident you are in the identification
- matched_inventory_id: if this item matches an existing inventory item, include that item's ID${existingItemsList}

Return ONLY valid JSON. No markdown, no explanation. Just the JSON array.`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Please analyze this bar inventory photo. Identify all visible bottles, brands, and quantities.',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      max_tokens: 4096,
    });

    const responseText = completion.choices[0]?.message?.content || '[]';

    // Parse AI response
    let items;
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      items = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch {
      console.error('Failed to parse AI response:', responseText);
      items = [];
    }

    // Clean up temp file
    try {
      fs.unlinkSync(imageFile.filepath);
    } catch {}

    return res.status(200).json({
      items,
      confidence: items.length > 0 ? items.reduce((sum: number, i: any) => sum + (i.confidence || 0.5), 0) / items.length : 0,
      raw_response: responseText,
    });
  } catch (err: any) {
    console.error('Scan error:', err);
    return res.status(500).json({ error: err.message || 'Failed to scan image' });
  }
}
