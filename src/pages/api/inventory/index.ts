import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase, supabaseAdmin } from '../../../lib/supabase';
import { withRateLimitAndAuth, AuthenticatedRequest } from '../../../lib/api-auth';
import { InventoryItemSchema, UpdateInventoryItemSchema, validateRequest, formatZodErrors } from '../../../lib/inventory-validation';
import { monitoring } from '../../../lib/monitoring';
import { findSimilarItems, matchKey } from '../../../lib/inventory/itemNames';

/**
 * Inventory Items API with Multi-Location Support
 * GET: Fetch inventory items filtered by location
 * POST: Create a new inventory item
 * PUT: Update an existing inventory item
 * DELETE: Delete an inventory item
 *
 * Rate limiting is applied by withRateLimitAndAuth wrapper BEFORE authentication.
 */
type ItemLabelRow = { id: string; name: string; brand: string | null; location_id: string; volume_ml: number | null };

/** Every item's label, paged past PostgREST's row cap so the duplicate check never misses rows. */
async function allItemLabels(client: NonNullable<typeof supabaseAdmin>) {
  const PAGE = 1000;
  const rows: ItemLabelRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client
      .from('inventory_items')
      .select('id, name, brand, location_id, volume_ml')
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) return { data: null, error };
    rows.push(...((data || []) as ItemLabelRow[]));
    if (!data || data.length < PAGE) return { data: rows, error: null };
  }
}

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
      monitoring.trackError(err instanceof Error ? err : new Error('Unknown error'), {
        context: 'inventory_fetch',
        location: req.query?.location_slug,
        user_id: req.user?.id
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

      // Don't create a second row for something already in inventory. The same
      // product at another bar is how an item is linked across bars, so that's
      // fine; anything else that looks like a duplicate needs confirm_new.
      const { data: existing, error: existingError } = await allItemLabels(client);
      if (existingError) {
        console.error('Error checking for duplicate inventory items:', existingError);
        return res.status(500).json({ error: 'Failed to create item' });
      }
      const candidate = { name: body.name, brand: body.brand || '' };
      const key = matchKey(candidate);
      const sameHere = (existing || []).find(i => i.location_id === locationId && matchKey(i) === key);
      if (sameHere) {
        return res.status(409).json({ error: 'This item already exists at this location', code: 'ALREADY_EXISTS', existing: sameHere });
      }
      // confirm_new comes from the "it's a different item" checkbox, or from the
      // Sales review copying a recipe's bottle to another bar by its own name.
      if (body.confirm_new !== true) {
        const others = (existing || []).filter(i => matchKey(i) !== key);
        const likely = findSimilarItems(candidate, others).filter(m => m.likely);
        if (likely.length > 0) {
          return res.status(409).json({
            error: 'Looks like this is already in inventory',
            code: 'SIMILAR_ITEMS',
            similar: likely.map(m => ({ ...m.item, score: m.score })),
          });
        }
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

      monitoring.trackEvent('inventory_item_created', {
        item_id: data.id,
        category: data.category,
        location: req.body?.location_slug,
        user_id: req.user?.id
      });

      return res.status(201).json({ data });
    } catch (err) {
      console.error('Unhandled error creating inventory item:', err);
      monitoring.trackError(err instanceof Error ? err : new Error('Unknown error'), {
        context: 'inventory_create',
        user_id: req.user?.id
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

      // A rename or move must not land on another row for the same item at that bar.
      if (updates.name !== undefined || updates.brand !== undefined || updates.location_id !== undefined) {
        const { data: current, error: currentError } = await client
          .from('inventory_items')
          .select('id, name, brand, location_id')
          .eq('id', id)
          .maybeSingle();
        if (currentError) {
          console.error('Error loading inventory item:', currentError);
          return res.status(500).json({ error: 'Failed to update item' });
        }
        if (!current) return res.status(404).json({ error: 'Item not found' });
        const next = { name: updates.name ?? current.name, brand: updates.brand ?? current.brand ?? '' };
        const nextLocation = updates.location_id ?? current.location_id;
        const key = matchKey(next);
        if (key !== matchKey(current) || nextLocation !== current.location_id) {
          const { data: here, error: hereError } = await client
            .from('inventory_items')
            .select('id, name, brand, location_id')
            .eq('location_id', nextLocation);
          if (hereError) {
            console.error('Error checking for duplicate inventory items:', hereError);
            return res.status(500).json({ error: 'Failed to update item' });
          }
          const clash = (here || []).find(i => i.id !== id && matchKey(i) === key);
          if (clash) {
            return res.status(409).json({ error: 'This item already exists at this location', code: 'ALREADY_EXISTS', existing: clash });
          }
        }
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

      monitoring.trackEvent('inventory_item_updated', {
        item_id: id,
        user_id: req.user?.id
      });

      return res.status(200).json({ data });
    } catch (err) {
      console.error('Unhandled error updating inventory item:', err);
      monitoring.trackError(err instanceof Error ? err : new Error('Unknown error'), {
        context: 'inventory_update',
        item_id: req.body?.id,
        user_id: req.user?.id
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

      monitoring.trackEvent('inventory_item_deleted', {
        item_id: id,
        user_id: req.user?.id
      });

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Unhandled error deleting inventory item:', err);
      monitoring.trackError(err instanceof Error ? err : new Error('Unknown error'), {
        context: 'inventory_delete',
        item_id: req.body?.id,
        user_id: req.user?.id
      });
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// Export with admin authentication
export default withRateLimitAndAuth(inventoryHandler);
