import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../../lib/supabase';
import { withRateLimitAndAuth, AuthenticatedRequest } from '../../../../lib/api-auth';
import { LocationSlugSchema } from '../../../../lib/inventory-validation';

/**
 * GET  /api/inventory/counts?location_slug= — inventory counts, newest first.
 * POST /api/inventory/counts { location_slug } — start a count: snapshots what
 *      the app thinks is on the shelf for every item at that location.
 */
async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      let query = supabaseAdmin
        .from('inventory_counts')
        .select('id, location_id, status, started_at, started_by, completed_at, completed_by, summary, locations(name, slug)')
        .order('started_at', { ascending: false })
        .limit(50);
      const slug = req.query.location_slug ? String(req.query.location_slug) : '';
      if (slug && slug !== 'all') {
        const { data: loc } = await supabaseAdmin.from('locations').select('id').eq('slug', slug).maybeSingle();
        if (!loc) return res.status(404).json({ error: 'Location not found' });
        query = query.eq('location_id', loc.id);
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return res.status(200).json({ data: data || [] });
    }

    if (req.method === 'POST') {
      const slug = LocationSlugSchema.safeParse(req.body?.location_slug);
      if (!slug.success) return res.status(400).json({ error: 'Pick a location to count' });

      const { data: loc } = await supabaseAdmin.from('locations').select('id, name').eq('slug', slug.data).maybeSingle();
      if (!loc) return res.status(404).json({ error: 'Location not found' });

      const { data: open } = await supabaseAdmin
        .from('inventory_counts')
        .select('id')
        .eq('location_id', loc.id)
        .eq('status', 'in_progress')
        .maybeSingle();
      if (open) return res.status(409).json({ error: `A count is already open for ${loc.name}`, id: open.id });

      const { data: items, error: itemsErr } = await supabaseAdmin
        .from('inventory_items')
        .select('id, quantity, cost_per_unit')
        .eq('location_id', loc.id);
      if (itemsErr) throw new Error(itemsErr.message);
      if (!items || items.length === 0) return res.status(400).json({ error: `No inventory items at ${loc.name} to count` });

      const { data: count, error } = await supabaseAdmin
        .from('inventory_counts')
        .insert({ location_id: loc.id, started_by: req.user?.email || req.user?.id || 'admin' })
        .select('id')
        .single();
      if (error || !count) {
        // Unique index: someone opened a count for this location at the same moment.
        return res.status(409).json({ error: error?.message || 'Could not start the count' });
      }

      const { error: linesErr } = await supabaseAdmin.from('inventory_count_lines').insert(
        items.map(i => ({
          count_id: count.id,
          item_id: i.id,
          system_qty_at_start: Number(i.quantity) || 0,
          cost_per_unit: Number(i.cost_per_unit) || 0,
        }))
      );
      if (linesErr) {
        await supabaseAdmin.from('inventory_counts').delete().eq('id', count.id);
        throw new Error(linesErr.message);
      }

      return res.status(201).json({ id: count.id });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('inventory counts error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed' });
  }
}

export default withRateLimitAndAuth(handler);
