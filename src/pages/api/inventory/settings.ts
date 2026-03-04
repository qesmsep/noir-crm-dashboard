import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';

const SETTINGS_KEY = 'inventory_categories';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const client = supabaseAdmin;

  if (req.method === 'GET') {
    try {
      // Try to get settings from database
      const { data, error } = await client
        .from('system_settings')
        .select('value')
        .eq('key', SETTINGS_KEY)
        .single();

      if (error || !data) {
        // Return default settings if not found
        return res.status(200).json({
          settings: {
            inventoryCategories: ['spirits', 'wine', 'beer', 'mixers', 'garnishes', 'supplies', 'other'],
            inventorySubcategories: {
              spirits: ['Vodka', 'Gin', 'Rum', 'Tequila', 'Whiskey', 'Bourbon', 'Scotch', 'Brandy', 'Cognac', 'Mezcal', 'Liqueur', 'Other'],
              wine: ['Red', 'White', 'Rosé', 'Sparkling', 'Champagne', 'Other'],
              beer: ['Lager', 'IPA', 'Stout', 'Pilsner', 'Wheat', 'Sour', 'Craft', 'Import', 'Other'],
              mixers: ['Juice', 'Soda', 'Tonic', 'Syrup', 'Bitters', 'Cream', 'Other'],
              garnishes: ['Citrus', 'Olives', 'Cherries', 'Herbs', 'Other'],
              supplies: ['Glassware', 'Ice', 'Straws', 'Napkins', 'Other'],
              other: ['Other'],
            },
            recipeCategories: ['Classic Cocktails', 'Signature Cocktails', 'Mocktails', 'Shots', 'Wine', 'Beer', 'Other'],
          }
        });
      }

      return res.status(200).json({ settings: data.value });
    } catch (err) {
      console.error('Error fetching settings:', err);
      return res.status(500).json({ error: 'Failed to fetch settings' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { settings } = req.body;

      // First check if settings exist
      const { data: existing } = await client
        .from('system_settings')
        .select('id')
        .eq('key', SETTINGS_KEY)
        .single();

      if (existing) {
        // Update existing settings
        const { error } = await client
          .from('system_settings')
          .update({
            value: settings,
            updated_at: new Date().toISOString()
          })
          .eq('key', SETTINGS_KEY);

        if (error) {
          console.error('Error updating settings:', error);
          return res.status(500).json({ error: 'Failed to update settings' });
        }
      } else {
        // Insert new settings
        const { error } = await client
          .from('system_settings')
          .insert({
            key: SETTINGS_KEY,
            value: settings,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (error) {
          console.error('Error creating settings:', error);
          return res.status(500).json({ error: 'Failed to save settings' });
        }
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Unhandled error saving settings:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}