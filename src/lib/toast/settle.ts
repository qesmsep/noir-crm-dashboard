import { supabaseAdmin } from '../supabase';
import { loadPlanContext, pendingLines, planFor, PlanContext } from './plan';

/**
 * Close any open day that has nothing to take out of stock — a closed night,
 * voids only, or only items marked "don't track" — so nobody is asked to
 * approve it. Days with anything to deduct, or anything that needs fixing,
 * stay open. Returns the dates closed.
 */
export async function settleDaysWithNothingToApprove(dates?: string[], ctx?: PlanContext): Promise<string[]> {
  let open = dates;
  if (!open) {
    const { data, error } = await supabaseAdmin.from('toast_sales_days').select('business_date').in('status', ['pending', 'partial']);
    if (error) throw new Error(`toast_sales_days: ${error.message}`);
    open = (data || []).map(d => d.business_date as string);
  }
  if (open.length === 0) return [];

  const context = ctx || (await loadPlanContext());
  const lines = await pendingLines(open);
  const closed: string[] = [];

  for (const date of open) {
    const dayLines = lines.filter(l => l.business_date === date);
    const plan = planFor(dayLines, context);
    if (plan.totals.size > 0 || plan.unresolved.length > 0) continue;

    if (dayLines.length > 0) {
      const { error } = await supabaseAdmin
        .from('toast_sales_lines')
        .update({ applied_at: new Date().toISOString(), applied_by: 'auto: nothing to deduct' })
        .in('item_selection_id', dayLines.map(l => l.item_selection_id))
        .is('applied_at', null);
      if (error) throw new Error(`toast_sales_lines ${date}: ${error.message}`);
    }
    const { data: day } = await supabaseAdmin.from('toast_sales_days').select('status').eq('business_date', date).maybeSingle();
    // A day that already had something applied keeps "applied"; one that never needed anything is "empty".
    const status = day?.status === 'partial' ? 'applied' : 'empty';
    const { error } = await supabaseAdmin.from('toast_sales_days').update({ status }).eq('business_date', date).in('status', ['pending', 'partial']);
    if (error) throw new Error(`toast_sales_days ${date}: ${error.message}`);
    closed.push(date);
  }
  return closed;
}
