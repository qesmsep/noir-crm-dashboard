import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase, supabaseAdmin } from '../../../lib/supabase';

/**
 * Inventory Items API
 * GET: Fetch all inventory items
 * POST: Create a new inventory item
 * PUT: Update an existing inventory item
 * DELETE: Delete an inventory item
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const client = supabaseAdmin || supabase;

  if (req.method === 'GET') {
    try {
      const { data, error } = await client
        .from('inventory_items')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching inventory:', error);
        return res.status(500).json({ error: 'Failed to fetch inventory' });
      }

      return res.status(200).json({ data: data || [] });
    } catch (err) {
      console.error('Unhandled error fetching inventory:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = req.body;
      const now = new Date().toISOString();

      const { data, error } = await client
        .from('inventory_items')
        .insert({
          name: body.name,
          category: body.category,
          subcategory: body.subcategory || '',
          brand: body.brand || '',
          quantity: body.quantity || 0,
          unit: body.unit || 'bottle',
          volume_ml: body.volume_ml || 750,
          cost_per_unit: body.cost_per_unit || 0,
          price_per_serving: body.price_per_serving || 0,
          par_level: body.par_level || 0,
          notes: body.notes || '',
          image_url: body.image_url || '',
          last_counted: now,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating inventory item:', error);
        return res.status(500).json({ error: 'Failed to create item' });
      }

      return res.status(201).json({ data });
    } catch (err) {
      console.error('Unhandled error creating inventory item:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { id, ...updates } = req.body;
      if (!id) {
        return res.status(400).json({ error: 'Item ID is required' });
      }

      const { data, error } = await client
        .from('inventory_items')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating inventory item:', error);
        return res.status(500).json({ error: 'Failed to update item' });
      }

      return res.status(200).json({ data });
    } catch (err) {
      console.error('Unhandled error updating inventory item:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { id } = req.body;
      if (!id) {
        return res.status(400).json({ error: 'Item ID is required' });
      }

      const { error } = await client
        .from('inventory_items')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting inventory item:', error);
        return res.status(500).json({ error: 'Failed to delete item' });
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Unhandled error deleting inventory item:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
