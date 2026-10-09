import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../../lib/supabase';
import { withRateLimitAndAuth, AuthenticatedRequest } from '../../../../lib/api-auth';
import { loadPlanContext, pendingLines, planFor } from '../../../../lib/toast/plan';

/**
 * POST /api/inventory/toast/apply  { business_date }
 * Approves a day: takes everything that can be worked out out of stock in one
 * transaction. Items that still need a link or recipe fix stay pending and
 * can be applied later.
 */
async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const date = String(req.body?.business_date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'business_date must be YYYY-MM-DD' });

  try {
    const ctx = await loadPlanContext();
    const plan = planFor(await pendingLines([date]), ctx);
    if (plan.resolved.length === 0) {
      return res.status(400).json({ error: 'Nothing on this day is ready to apply — link the items flagged below first.' });
    }

    const adjustments = Array.from(plan.totals.entries())
      .map(([item_id, units]) => ({ item_id, quantity_change: -Math.round(units * 10000) / 10000 }))
      .filter(a => a.quantity_change < 0);

    const { data, error } = await supabaseAdmin.rpc('apply_toast_sales', {
      p_business_date: date,
      p_line_ids: plan.resolved.map(r => r.item_selection_id),
      p_adjustments: adjustments,
      p_created_by: req.user?.email || req.user?.id || 'admin',
    });
    if (error) {
      const stale = error.message?.includes('STALE_PLAN');
      return res.status(stale ? 409 : 500).json({
        error: stale ? 'This day changed while you were reviewing it. Reload and try again.' : error.message,
      });
    }

    const rows = (data || []) as { item_id: string; old_quantity: number; new_quantity: number }[];
    return res.status(200).json({
      applied_lines: plan.resolved.length,
      items_updated: rows.length,
      went_negative: rows.filter(r => Number(r.new_quantity) < 0).map(r => r.item_id),
      still_pending: plan.unresolved.length,
    });
  } catch (err) {
    console.error('toast apply error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to apply sales' });
  }
}

export default withRateLimitAndAuth(handler);
