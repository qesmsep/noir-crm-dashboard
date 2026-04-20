import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const location = (req.query.location as string) || 'noirkc';
    const { order } = req.body;

    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'Order must be an array' });
    }

    // Save the order to a JSON file
    const orderFilePath = path.join(process.cwd(), 'public', 'menu', location, '.order.json');

    await fs.writeFile(
      orderFilePath,
      JSON.stringify({ order, updatedAt: new Date().toISOString() }, null, 2),
      'utf-8'
    );

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error saving menu order:', error);
    res.status(500).json({ error: 'Failed to save menu order' });
  }
}
