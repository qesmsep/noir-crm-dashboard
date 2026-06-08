import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../lib/supabase';
import { withAdminAuth, AuthenticatedRequest } from '../../../lib/api-auth';
import { TransferSchema, validateRequest, formatZodErrors } from '../../../lib/inventory-validation';
import { rateLimiters } from '../../../lib/rate-limiter';
import { monitoring } from '../../../lib/monitoring';

/**
 * Inventory Transfer API
 * POST: Transfer inventory items between locations atomically
 *
 * CSRF Protection: Uses Supabase httpOnly, SameSite cookies for CSRF mitigation.
 * Authentication is required via withAdminAuth middleware.
 */
async function transferHandler(req: AuthenticatedRequest, res: NextApiResponse) {
  const client = supabaseAdmin;

  // Rate limiting with headers.
  // NOTE: the standard limiter is in-memory and per-instance, so on serverless
  // (Vercel) its state resets on cold start and is not shared across instances.
  // Treat this as best-effort abuse mitigation, not a hard guarantee.
  // TODO: back with Redis/Upstash for a distributed limit.
  const rateLimitPassed = await rateLimiters.standard.check(req);
  if (!rateLimitPassed) {
    const retryAfter = rateLimiters.standard.getRetryAfter(req);
    res.setHeader('Retry-After', retryAfter.toString());
    res.setHeader('X-RateLimit-Limit', '100');
    res.setHeader('X-RateLimit-Remaining', '0');
    return res.status(429).json({
      error: 'Too many requests',
      message: 'Please wait before making another request',
      retryAfter
    });
  }

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
        p_created_by: req.user?.email || 'Unknown'
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
      await monitoring.trackEvent('inventory_transfer_completed', {
        item_id: item_id,
        from_location_id: from_location_id,
        to_location_id: to_location_id,
        quantity: quantity,
        user: req.user?.email
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
      await monitoring.trackError(err instanceof Error ? err : new Error('Unknown error'), {
        context: 'inventory_transfer',
        // Only log safe identifiers, not user input
        user: req.user?.email
      });
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// Export with admin authentication
export default withAdminAuth(transferHandler);
