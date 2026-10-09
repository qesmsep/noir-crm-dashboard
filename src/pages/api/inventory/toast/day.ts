import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../../lib/supabase';
import { withRateLimitAndAuth, AuthenticatedRequest } from '../../../../lib/api-auth';
import { loadPlanContext, pendingLines, planFor, previewRows } from '../../../../lib/toast/plan';

/**
 * GET /api/inventory/toast/day?date=YYYY-MM-DD
 * What approving this day would take out of stock, and what can't be applied yet.
 */
async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const date = String(req.query.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });

  try {
    const { data: day, error } = await supabaseAdmin
      .from('toast_sales_days')
      .select('business_date, status, line_count, imported_at, last_applied_at, last_applied_by')
      .eq('business_date', date)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!day) return res.status(404).json({ error: `No Toast sales imported for ${date}` });

    const ctx = await loadPlanContext();
    const lines = await pendingLines([date]);
    const plan = planFor(lines, ctx);
    const qtyById = new Map(lines.map(l => [l.item_selection_id, l.qty]));
    const ignoredLines = plan.resolved.filter(r => r.deductions.length === 0).length;

    return res.status(200).json({
      day,
      allowance: ctx.allowance,
      pending_drinks: lines.reduce((s, l) => s + l.qty, 0),
      ready_drinks: plan.resolved.reduce((s, r) => s + (qtyById.get(r.item_selection_id) || 0), 0),
      ignored_lines: ignoredLines,
      deductions: previewRows(plan, ctx),
      needs_attention: plan.unresolved,
    });
  } catch (err) {
    console.error('toast day error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load day' });
  }
}

export default withRateLimitAndAuth(handler);
