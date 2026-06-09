import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';
import { withAdminAuth, AuthenticatedRequest } from '../../../lib/api-auth';
import { TransactionSchema, validateRequest, formatZodErrors } from '../../../lib/inventory-validation';
import { rateLimiters } from '../../../lib/rate-limiter';
import { monitoring } from '../../../lib/monitoring';

async function transactionsHandler(req: AuthenticatedRequest, res: NextApiResponse) {
  const client = supabaseAdmin;

  // Rate limiting
  const rateLimitPassed = await rateLimiters.standard.check(req);
  if (!rateLimitPassed) {
    return res.status(429).json({
      error: 'Too many requests',
      message: 'Please wait before making another request'
    });
  }

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
      await monitoring.trackError(err instanceof Error ? err : new Error('Unknown error'), {
        context: 'transactions_fetch',
        item_id: req.query?.item_id,
        user: req.user?.email
      });
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    try {
      // Validate input
      const validation = validateRequest(TransactionSchema, req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid input',
          details: formatZodErrors(validation.errors)
        });
      }

      const { item_id, transaction_type, quantity_change, notes } = validation.data;

      // Use atomic database function to prevent race conditions
      const { data: result, error } = await client.rpc('adjust_inventory_quantity', {
        p_item_id: item_id,
        p_quantity_change: quantity_change,
        p_transaction_type: transaction_type,
        p_notes: notes || '',
        p_created_by: req.user?.email || 'Unknown'
      });

      if (error) {
        console.error('Error adjusting inventory:', error);

        // Check if it's an insufficient stock error
        if (error.message?.includes('Insufficient inventory')) {
          return res.status(400).json({
            error: 'Insufficient stock',
            message: error.message
          });
        }

        return res.status(500).json({ error: 'Failed to process transaction' });
      }

      // Track successful transaction
      await monitoring.trackEvent('inventory_transaction_created', {
        item_id: item_id,
        transaction_type: transaction_type,
        quantity_change: quantity_change,
        low_stock: result.low_stock,
        user: req.user?.email
      });

      // Return the result with warning information
      return res.status(201).json({
        data: result,
        warnings: {
          low_stock: result.low_stock,
          out_of_stock: result.out_of_stock
        }
      });
    } catch (err) {
      console.error('Unhandled error creating transaction:', err);
      await monitoring.trackError(err instanceof Error ? err : new Error('Unknown error'), {
        context: 'transaction_create',
        item_id: req.body?.item_id,
        user: req.user?.email
      });
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// Export with admin authentication
export default withAdminAuth(transactionsHandler);