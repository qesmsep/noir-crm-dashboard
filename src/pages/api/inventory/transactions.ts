import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const client = supabaseAdmin;

  if (req.method === 'GET') {
    try {
      const { item_id } = req.query;

      let query = client
        .from('inventory_transactions')
        .select(`
          *,
          inventory_items (
            name,
            brand
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (item_id) {
        query = query.eq('item_id', item_id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching transactions:', error);
        return res.status(500).json({ error: 'Failed to fetch transactions' });
      }

      return res.status(200).json({ data: data || [] });
    } catch (err) {
      console.error('Unhandled error fetching transactions:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { item_id, transaction_type, quantity_change, notes } = req.body;

      // Get current quantity
      const { data: item, error: itemError } = await client
        .from('inventory_items')
        .select('quantity')
        .eq('id', item_id)
        .single();

      if (itemError) {
        return res.status(400).json({ error: 'Item not found' });
      }

      const quantityBefore = item.quantity;
      const quantityAfter = transaction_type === 'remove'
        ? quantityBefore - Math.abs(quantity_change)
        : quantityBefore + Math.abs(quantity_change);

      // Create transaction record
      const { data: transaction, error: transError } = await client
        .from('inventory_transactions')
        .insert({
          item_id,
          transaction_type,
          quantity: Math.abs(quantity_change),
          quantity_before: quantityBefore,
          quantity_after: quantityAfter,
          notes: notes || '',
          created_by: 'Admin',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (transError) {
        console.error('Error creating transaction:', transError);
        return res.status(500).json({ error: 'Failed to create transaction' });
      }

      // Update item quantity
      const { error: updateError } = await client
        .from('inventory_items')
        .update({
          quantity: quantityAfter,
          updated_at: new Date().toISOString()
        })
        .eq('id', item_id);

      if (updateError) {
        console.error('Error updating item quantity:', updateError);
        return res.status(500).json({ error: 'Failed to update quantity' });
      }

      return res.status(201).json({ data: transaction });
    } catch (err) {
      console.error('Unhandled error creating transaction:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}