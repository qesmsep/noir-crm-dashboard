import type { NextApiResponse } from 'next';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { withRateLimitAndAuth, AuthenticatedRequest } from '../../../../lib/api-auth';
import { loadPlanContext } from '../../../../lib/toast/plan';
import { settleDaysWithNothingToApprove } from '../../../../lib/toast/settle';
import { saleLocationSlug, suggestLink } from '../../../../lib/toastSalesCore';

const LOOKBACK_DAYS = 60;

const LinkSchema = z.discriminatedUnion('link_type', [
  z.object({ toast_item_id: z.string().min(1), link_type: z.literal('recipe'), recipe_id: z.string().uuid() }),
  z.object({
    toast_item_id: z.string().min(1),
    link_type: z.literal('item'),
    inventory_item_id: z.string().uuid(),
    amount: z.number().positive().max(1000),
    amount_unit: z.enum(['oz', 'ml', 'unit']),
  }),
  z.object({ toast_item_id: z.string().min(1), link_type: z.literal('ignore') }),
]);

/**
 * GET  /api/inventory/toast/links — every Toast item sold in the last 60 days,
 *      its link (if any), and a suggested link for the ones not linked yet.
 * PUT  /api/inventory/toast/links — save one item's link.
 * DELETE /api/inventory/toast/links?toast_item_id= — unlink.
 */
async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const since = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString().slice(0, 10);
      const seen = new Map<string, { toast_item_id: string; menu_item: string; menu_group: string; menu: string; qty: number; last_sold: string }>();
      const page = 1000;
      for (let from = 0; ; from += page) {
        const { data, error } = await supabaseAdmin
          .from('toast_sales_lines')
          .select('toast_item_id, menu_item, menu_group, menu, qty, business_date')
          .gte('business_date', since)
          .eq('voided', false)
          .order('item_selection_id')
          .range(from, from + page - 1);
        if (error) throw new Error(error.message);
        for (const l of data || []) {
          const s = seen.get(l.toast_item_id);
          if (!s) {
            seen.set(l.toast_item_id, { toast_item_id: l.toast_item_id, menu_item: l.menu_item, menu_group: l.menu_group, menu: l.menu, qty: Number(l.qty), last_sold: l.business_date });
          } else {
            s.qty += Number(l.qty);
            if (l.business_date > s.last_sold) Object.assign(s, { menu_item: l.menu_item, menu_group: l.menu_group, menu: l.menu, last_sold: l.business_date });
          }
        }
        if (!data || data.length < page) break;
      }

      const ctx = await loadPlanContext();
      const links = new Map(ctx.links.map(l => [l.toast_item_id, l]));
      const locBySlug = new Map(ctx.locations.map(l => [l.slug, l.id]));

      const rows = Array.from(seen.values())
        .map(s => {
          const link = links.get(s.toast_item_id) || null;
          return {
            ...s,
            location_slug: saleLocationSlug(s.menu),
            link,
            suggestion: link ? null : suggestLink(s, ctx.recipes, ctx.items, locBySlug.get(saleLocationSlug(s.menu)) || null),
          };
        })
        .sort((a, b) => Number(!!a.link) - Number(!!b.link) || b.qty - a.qty);

      return res.status(200).json({ data: rows });
    }

    if (req.method === 'PUT') {
      const parsed = LinkSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'Invalid link', details: parsed.error.issues });
      const body = parsed.data;

      const { data: last } = await supabaseAdmin
        .from('toast_sales_lines')
        .select('menu_item, menu_group, menu')
        .eq('toast_item_id', body.toast_item_id)
        .order('business_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      const row = {
        toast_item_id: body.toast_item_id,
        menu_item: last?.menu_item || '',
        menu_group: last?.menu_group || '',
        menu: last?.menu || '',
        link_type: body.link_type,
        recipe_id: body.link_type === 'recipe' ? body.recipe_id : null,
        inventory_item_id: body.link_type === 'item' ? body.inventory_item_id : null,
        amount: body.link_type === 'item' ? body.amount : null,
        amount_unit: body.link_type === 'item' ? body.amount_unit : null,
        updated_at: new Date().toISOString(),
        updated_by: req.user?.email || req.user?.id || 'admin',
      };
      const { error } = await supabaseAdmin.from('toast_item_links').upsert(row, { onConflict: 'toast_item_id' });
      if (error) throw new Error(error.message);
      const closed = await settleDaysWithNothingToApprove();
      return res.status(200).json({ data: row, days_closed: closed });
    }

    if (req.method === 'DELETE') {
      const id = String(req.query.toast_item_id || '');
      if (!id) return res.status(400).json({ error: 'toast_item_id is required' });
      const { error } = await supabaseAdmin.from('toast_item_links').delete().eq('toast_item_id', id);
      if (error) throw new Error(error.message);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('toast links error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed' });
  }
}

export default withRateLimitAndAuth(handler);
