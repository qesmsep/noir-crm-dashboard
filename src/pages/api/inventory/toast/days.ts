import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '../../../../lib/supabase';
import { withRateLimitAndAuth, AuthenticatedRequest } from '../../../../lib/api-auth';
import { toastSftpConfigured } from '../../../../lib/toast/sftp';
import { loadPlanContext, pendingLines, planFor } from '../../../../lib/toast/plan';

/**
 * GET /api/inventory/toast/days
 * Imported Toast sales days (newest first), with what's still waiting for
 * approval on each, the last sync run, and the loss allowance in force.
 */
async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const [daysRes, runRes] = await Promise.all([
      supabaseAdmin
        .from('toast_sales_days')
        .select('business_date, status, line_count, imported_at, last_applied_at, last_applied_by')
        .order('business_date', { ascending: false })
        .limit(60),
      supabaseAdmin
        .from('toast_sync_runs')
        .select('trigger, status, days_imported, lines_imported, error, started_at, finished_at')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (daysRes.error) throw new Error(daysRes.error.message);

    const days = daysRes.data || [];
    const open = days.filter(d => d.status !== 'applied').map(d => d.business_date as string);
    const ctx = await loadPlanContext();
    const lines = await pendingLines(open);

    const summary = new Map<string, { pending_drinks: number; ready_drinks: number; needs_attention: number }>();
    for (const date of open) {
      const dayLines = lines.filter(l => l.business_date === date);
      const plan = planFor(dayLines, ctx);
      const qtyById = new Map(dayLines.map(l => [l.item_selection_id, l.qty]));
      summary.set(date, {
        pending_drinks: dayLines.reduce((s, l) => s + l.qty, 0),
        ready_drinks: plan.resolved.reduce((s, r) => s + (qtyById.get(r.item_selection_id) || 0), 0),
        needs_attention: plan.unresolved.length,
      });
    }

    return res.status(200).json({
      configured: toastSftpConfigured(),
      allowance: ctx.allowance,
      last_run: runRes.data || null,
      days: days.map(d => ({
        ...d,
        ...(summary.get(d.business_date) || { pending_drinks: 0, ready_drinks: 0, needs_attention: 0 }),
      })),
    });
  } catch (err) {
    console.error('toast days error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load Toast sales' });
  }
}

export default withRateLimitAndAuth(handler);
