import type { NextApiResponse } from 'next';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { withRateLimitAndAuth, AuthenticatedRequest } from '../../../../lib/api-auth';
import { getLossAllowance } from '../../../../lib/inventory/lossAllowance';
import { measuredLossPct, POURED_CATEGORIES, summarizeCount } from '../../../../lib/toastSalesCore';

const SaveBody = z.object({
  lines: z
    .array(z.object({ item_id: z.string().uuid(), counted_qty: z.number().min(0).max(100000).nullable() }))
    .min(1)
    .max(1000),
});

const ActionBody = z.object({ action: z.enum(['complete', 'cancel']) });

interface LineRow {
  item_id: string;
  system_qty_at_start: number;
  system_qty_at_close: number | null;
  counted_qty: number | null;
  counted_at: string | null;
  cost_per_unit: number;
  inventory_items: { name: string; brand: string; category: string; subcategory: string; unit: string; volume_ml: number; par_level: number } | null;
}

async function loadCount(id: string) {
  const { data: count, error } = await supabaseAdmin
    .from('inventory_counts')
    .select('id, location_id, status, started_at, started_by, completed_at, completed_by, notes, summary, locations(name, slug)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!count) return null;
  const { data: lines, error: linesErr } = await supabaseAdmin
    .from('inventory_count_lines')
    .select('item_id, system_qty_at_start, system_qty_at_close, counted_qty, counted_at, cost_per_unit, inventory_items(name, brand, category, subcategory, unit, volume_ml, par_level)')
    .eq('count_id', id);
  if (linesErr) throw new Error(linesErr.message);
  const rows = ((lines || []) as unknown as LineRow[]).sort(
    (a, b) =>
      (a.inventory_items?.category || '').localeCompare(b.inventory_items?.category || '') ||
      (a.inventory_items?.name || '').localeCompare(b.inventory_items?.name || '')
  );
  return { count, lines: rows };
}

/** Score a just-closed count: variance at cost, and the real loss rate on poured stock since the last count. */
async function scoreCount(countId: string, locationId: string) {
  const loaded = await loadCount(countId);
  if (!loaded) return null;
  const { count, lines } = loaded;

  const scored = lines.map(l => ({
    item_id: l.item_id,
    category: l.inventory_items?.category || 'other',
    cost_per_unit: Number(l.cost_per_unit) || 0,
    system_qty: Number(l.system_qty_at_close ?? l.system_qty_at_start),
    counted_qty: l.counted_qty === null ? null : Number(l.counted_qty),
  }));
  const variance = summarizeCount(scored);

  const { data: prev } = await supabaseAdmin
    .from('inventory_counts')
    .select('completed_at')
    .eq('location_id', locationId)
    .eq('status', 'completed')
    .neq('id', countId)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const allowance = await getLossAllowance();
  let measured: number | null = null;
  let pouredSalesValue = 0;

  if (prev?.completed_at) {
    const pouredCounted = new Map(
      scored.filter(s => s.counted_qty !== null && POURED_CATEGORIES.has(s.category)).map(s => [s.item_id, s])
    );
    const { data: sales } = await supabaseAdmin
      .from('inventory_transactions')
      .select('item_id, quantity_change')
      .eq('location_id', locationId)
      .eq('transaction_type', 'sales')
      .gt('created_at', prev.completed_at)
      .lte('created_at', count.completed_at || new Date().toISOString());
    for (const t of sales || []) {
      const s = pouredCounted.get(t.item_id);
      if (s) pouredSalesValue += -Number(t.quantity_change) * s.cost_per_unit;
    }
    const shortfall = -variance.poured_variance_value; // positive = less on the shelf than expected
    measured = measuredLossPct(pouredSalesValue, shortfall, allowance.poured_pct);
  }

  const summary = {
    ...variance,
    since: prev?.completed_at || null,
    poured_sales_value: Math.round(pouredSalesValue * 100) / 100,
    allowance_pct: allowance.poured_pct,
    measured_loss_pct: measured,
  };
  await supabaseAdmin.from('inventory_counts').update({ summary }).eq('id', countId);
  return summary;
}

/**
 * GET  /api/inventory/counts/:id — the count and every line.
 * PUT  /api/inventory/counts/:id { lines: [{ item_id, counted_qty }] } — save counts (open counts only).
 * POST /api/inventory/counts/:id { action: 'complete' | 'cancel' }
 */
async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  const id = String(req.query.id || '');
  if (!z.string().uuid().safeParse(id).success) return res.status(400).json({ error: 'Invalid count id' });

  try {
    if (req.method === 'GET') {
      const loaded = await loadCount(id);
      if (!loaded) return res.status(404).json({ error: 'Count not found' });
      return res.status(200).json({ data: loaded });
    }

    const { data: count } = await supabaseAdmin.from('inventory_counts').select('id, status, location_id').eq('id', id).maybeSingle();
    if (!count) return res.status(404).json({ error: 'Count not found' });

    if (req.method === 'PUT') {
      if (count.status !== 'in_progress') return res.status(409).json({ error: 'This count is closed' });
      const parsed = SaveBody.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'Invalid counts', details: parsed.error.issues });

      const now = new Date().toISOString();
      for (const line of parsed.data.lines) {
        const { error } = await supabaseAdmin
          .from('inventory_count_lines')
          .update({ counted_qty: line.counted_qty, counted_at: line.counted_qty === null ? null : now })
          .eq('count_id', id)
          .eq('item_id', line.item_id);
        if (error) throw new Error(error.message);
      }
      return res.status(200).json({ saved: parsed.data.lines.length });
    }

    if (req.method === 'POST') {
      const parsed = ActionBody.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'action must be complete or cancel' });
      if (count.status !== 'in_progress') return res.status(409).json({ error: 'This count is already closed' });

      if (parsed.data.action === 'cancel') {
        const { error } = await supabaseAdmin
          .from('inventory_counts')
          .update({ status: 'cancelled', completed_at: new Date().toISOString(), completed_by: req.user?.email || req.user?.id || 'admin' })
          .eq('id', id)
          .eq('status', 'in_progress');
        if (error) throw new Error(error.message);
        return res.status(200).json({ status: 'cancelled' });
      }

      const { error } = await supabaseAdmin.rpc('complete_inventory_count', {
        p_count_id: id,
        p_completed_by: req.user?.email || req.user?.id || 'admin',
      });
      if (error) return res.status(409).json({ error: error.message });

      const summary = await scoreCount(id, count.location_id);
      return res.status(200).json({ status: 'completed', summary });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('inventory count error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed' });
  }
}

export default withRateLimitAndAuth(handler);
