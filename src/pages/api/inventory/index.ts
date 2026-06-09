import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase, supabaseAdmin } from '../../../lib/supabase';
import { withRateLimitAndAuth, AuthenticatedRequest } from '../../../lib/api-auth';
import { InventoryItemSchema, UpdateInventoryItemSchema, validateRequest, formatZodErrors } from '../../../lib/inventory-validation';
import { monitoring } from '../../../lib/monitoring';

/**
 * Inventory Items API with Multi-Location Support
 * GET: Fetch inventory items filtered by location
 * POST: Create a new inventory item
 * PUT: Update an existing inventory item
 * DELETE: Delete an inventory item
 *
 * Rate limiting is applied by withRateLimitAndAuth wrapper BEFORE authentication.
 */
async function inventoryHandler(req: AuthenticatedRequest, res: NextApiResponse) {
  const client = supabaseAdmin || supabase;

  if (req.method === 'GET') {
    try {
      const { location_slug } = req.query;

      // Build query
      let query = client.from('inventory_items').select('*');

      // Filter by location if provided
      if (location_slug) {
        const { data: locationData, error: locationError } = await client
          .from('locations')
          .select('id')
          .eq('slug', location_slug)
          .single();

        if (locationError) {
          return res.status(400).json({ error: 'Invalid location' });
        }

        query = query.eq('location_id', locationData.id);
      }

      query = query.order('name', { ascending: true });

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching inventory:', error);
        return res.status(500).json({ error: 'Failed to fetch inventory' });
      }

      return res.status(200).json({ data: data || [] });
    } catch (err) {
      console.error('Unhandled error fetching inventory:', err);
      await monitoring.trackError(err instanceof Error ? err : new Error('Unknown error'), {
        context: 'inventory_fetch',
        location: req.query?.location_slug,
        user: req.user?.email
      });
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    try {
      // Validate input
      const validation = validateRequest(InventoryItemSchema, req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid input',
          details: formatZodErrors(validation.errors)
        });
      }

      const body = validation.data;
      const now = new Date().toISOString();

      // Get location ID
      let locationId = body.location_id;
      if (!locationId && body.location_slug) {
        const { data: locationData, error: locationError } = await client
          .from('locations')
          .select('id')
          .eq('slug', body.location_slug)
          .single();

        if (locationError) {
          return res.status(400).json({ error: 'Invalid location' });
        }
        locationId = locationData?.id;
      }

      if (!locationId) {
        return res.status(400).json({ error: 'Location is required' });
      }

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
          location_id: locationId,
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

      await monitoring.trackEvent('inventory_item_created', {
        item_id: data.id,
        category: data.category,
        location: req.body?.location_slug,
        user: req.user?.email
      });

      return res.status(201).json({ data });
    } catch (err) {
      console.error('Unhandled error creating inventory item:', err);
      await monitoring.trackError(err instanceof Error ? err : new Error('Unknown error'), {
        context: 'inventory_create',
        user: req.user?.email
      });
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'PUT') {
    try {
      // Validate input
      const validation = validateRequest(UpdateInventoryItemSchema, req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid input',
          details: formatZodErrors(validation.errors)
        });
      }

      const { id, ...updates } = validation.data;
      if (!id) {
        return res.status(400).json({ error: 'Item ID is required' });
      }

      const { data, error} = await client
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

      await monitoring.trackEvent('inventory_item_updated', {
        item_id: id,
        user: req.user?.email
      });

      return res.status(200).json({ data });
    } catch (err) {
      console.error('Unhandled error updating inventory item:', err);
      await monitoring.trackError(err instanceof Error ? err : new Error('Unknown error'), {
        context: 'inventory_update',
        item_id: req.body?.id,
        user: req.user?.email
      });
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

      await monitoring.trackEvent('inventory_item_deleted', {
        item_id: id,
        user: req.user?.email
      });

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Unhandled error deleting inventory item:', err);
      await monitoring.trackError(err instanceof Error ? err : new Error('Unknown error'), {
        context: 'inventory_delete',
        item_id: req.body?.id,
        user: req.user?.email
      });
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// Export with admin authentication
export default withRateLimitAndAuth(inventoryHandler);
