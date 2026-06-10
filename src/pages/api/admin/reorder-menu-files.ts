import type { NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import { withRateLimitAndAuth, AuthenticatedRequest } from '../../../lib/api-auth';

const ALLOWED_LOCATIONS = ['noirkc', 'rooftopkc'];
const MAX_ORDER_SIZE = 100;

async function handler(
  req: AuthenticatedRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const location = (req.query.location as string) || 'noirkc';
    const { order } = req.body;

    // Validate location
    if (!ALLOWED_LOCATIONS.includes(location)) {
      return res.status(400).json({ error: 'Invalid location' });
    }

    // Validate order is an array of strings with reasonable size
    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'Order must be an array' });
    }

    if (!order.every(item => typeof item === 'string')) {
      return res.status(400).json({ error: 'Order must be an array of strings' });
    }

    if (order.length > MAX_ORDER_SIZE) {
      return res.status(400).json({ error: `Order array too large (max ${MAX_ORDER_SIZE})` });
    }

    // In production, store order in Supabase system_settings table
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(500).json({ error: 'Server configuration error' });
      }

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      const settingKey = `menu_order_${location}`;
      const settingValue = {
        order,
        updatedAt: new Date().toISOString()
      };

      // Upsert the menu order setting
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: settingKey,
          value: settingValue,
          description: `Menu file order for ${location}`
        }, {
          onConflict: 'key'
        });

      if (error) {
        console.error('Error saving menu order to Supabase:', error);
        return res.status(500).json({ error: 'Failed to save menu order' });
      }

      return res.status(200).json({ success: true });
    }

    // In development, save the order to a JSON file
    const menuDir = path.join(process.cwd(), 'public', 'menu', location);
    const orderFilePath = path.join(menuDir, '.order.json');

    // Ensure directory exists
    await fs.mkdir(menuDir, { recursive: true });

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

export default withRateLimitAndAuth(handler);
