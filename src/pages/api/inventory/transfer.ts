import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';
import { withRateLimitAndAuth, AuthenticatedRequest } from '../../../lib/api-auth';
import { TransferSchema, validateRequest, formatZodErrors } from '../../../lib/inventory-validation';
import { monitoring } from '../../../lib/monitoring';

/**
 * Inventory Transfer API
 * POST: Transfer inventory items between locations atomically
 *
 * Rate limiting is applied by withRateLimitAndAuth wrapper BEFORE authentication.
 */
async function transferHandler(req: AuthenticatedRequest, res: NextApiResponse) {
  const client = supabaseAdmin;

  if (req.method === 'POST') {
    try {
      // Validate input
      const validation = validateRequest(TransferSchema, req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid input',
          details: formatZodErrors(validation.errors)
        });
      }

      const { item_id, from_location_id, to_location_id, quantity, notes } = validation.data;

      // Use atomic database function to prevent race conditions
      const { data: result, error } = await client.rpc('transfer_inventory_between_locations', {
        p_item_id: item_id,
        p_from_location_id: from_location_id,
        p_to_location_id: to_location_id,
        p_quantity: quantity,
        p_notes: notes || '',
        p_created_by: req.user?.id || 'Unknown'
      });

      if (error) {
        console.error('Error transferring inventory:', error);
        return res.status(500).json({ error: 'Failed to process transfer' });
      }

      // The function returns an array with a single result row
      const transferResult = result?.[0];

      if (!transferResult?.success) {
        return res.status(400).json({
          error: 'Transfer failed',
          message: transferResult?.message || 'Unknown error'
        });
      }

      // Track successful transfer
      monitoring.trackEvent('inventory_transfer_completed', {
        item_id: item_id,
        from_location_id: from_location_id,
        to_location_id: to_location_id,
        quantity: quantity,
        user_id: req.user?.id
      });

      // Return the transfer result
      return res.status(200).json({
        success: true,
        message: transferResult.message,
        data: {
          source_item_id: transferResult.source_item_id,
          destination_item_id: transferResult.destination_item_id,
          source_new_quantity: transferResult.source_new_quantity,
          destination_new_quantity: transferResult.destination_new_quantity
        }
      });
    } catch (err) {
      console.error('Unhandled error during transfer:', err);
      monitoring.trackError(err instanceof Error ? err : new Error('Unknown error'), {
        context: 'inventory_transfer',
        // Only log safe identifiers, not user input
        user_id: req.user?.id
      });
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export default withRateLimitAndAuth(transferHandler);
