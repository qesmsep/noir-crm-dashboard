import type { NextApiResponse } from 'next';
import { z } from 'zod';
import { supabaseAdmin } from '../../../../lib/supabase';
import { withStrictRateLimitAndAuth, AuthenticatedRequest } from '../../../../lib/api-auth';
import { detectSalesFormat, parseItemSelectionCsv, parseProductMix, productMixKey } from '../../../../lib/toastSalesCore';
import { reopenIfPending, settleDaysWithNothingToApprove } from '../../../../lib/toast/settle';
import { notifyNewGaps } from '../../../../lib/toast/notify';

export const config = { api: { bodyParser: { sizeLimit: '5mb' } } };

const Body = z.object({
  content: z.string().min(1).max(5_000_000),
  filename: z.string().max(255).default('pasted report'),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preview: z.boolean().default(false),
});

const CHUNK = 500;
const MAX_PMIX_ROWS = 5000;

/** Toast item ids already known for each menu/group/item name, so a hand upload links like the nightly export does. */
async function knownToastIds(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const { data: links } = await supabaseAdmin.from('toast_item_links').select('toast_item_id, menu_item, menu_group, menu');
  const since = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10);
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from('toast_sales_lines')
      .select('toast_item_id, menu_item, menu_group, menu, business_date')
      .gte('business_date', since)
      .not('toast_item_id', 'like', 'pmix:%')
      .order('business_date', { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const l of data || []) map.set(productMixKey(l), l.toast_item_id); // newest wins
    if (!data || data.length < 1000) break;
  }
  for (const l of links || []) map.set(productMixKey(l), l.toast_item_id); // a saved link wins
  return map;
}

/**
 * POST /api/inventory/toast/manual-upload
 * The backup to the nightly export: upload Toast's Product Mix report (any
 * date range) or a day's ItemSelectionDetails.csv. It lands in the same
 * review-and-approve list as the nightly sync. `preview: true` checks the file
 * without saving anything.
 */
async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid upload', details: parsed.error.issues });
  const { content, filename, period_start: start, period_end: end, preview } = parsed.data;
  if (start > end) return res.status(400).json({ error: 'The start date is after the end date' });

  const format = detectSalesFormat(content);
  if (!format) {
    return res.status(400).json({
      error: 'This isn’t a Toast report this page can read. Export Product Mix from Toast Web as CSV (or paste it), or upload ItemSelectionDetails.csv from the nightly export.',
    });
  }
  if (format === 'item_selections' && start !== end) {
    return res.status(400).json({ error: 'ItemSelectionDetails.csv covers one business day — set the start and end date to that day.' });
  }

  try {
    // Anything already imported in this range would be counted twice.
    const { data: overlapping, error: overlapErr } = await supabaseAdmin
      .from('toast_sales_days')
      .select('business_date, source, period_start, status')
      .or(`and(business_date.gte.${start},business_date.lte.${end}),and(source.eq.manual_pmix,period_start.lte.${end},business_date.gte.${start})`);
    if (overlapErr) throw new Error(overlapErr.message);
    const conflicts = (overlapping || []).filter(d =>
      // Re-uploading the nightly file for a day the sync already pulled is harmless (rows de-duplicate).
      !(format === 'item_selections' && d.source !== 'manual_pmix')
    );

    if (format === 'item_selections') {
      const lines = parseItemSelectionCsv(content, end);
      const summary = { format, rows: lines.length, drinks: lines.filter(l => !l.voided).reduce((s, l) => s + l.qty, 0), period_start: start, period_end: end, conflicts };
      if (preview || conflicts.length) {
        return res.status(conflicts.length && !preview ? 409 : 200).json({ ...summary, error: conflicts.length ? 'These dates were already imported from a Product Mix upload.' : undefined });
      }
      const { data: existing } = await supabaseAdmin.from('toast_sales_days').select('business_date, line_count').eq('business_date', end).maybeSingle();
      const { error: dayErr } = await supabaseAdmin.from('toast_sales_days').upsert(
        // source is left out for a day the nightly sync already created (undefined
        // keys aren't sent), so an existing day keeps 'sftp'.
        { business_date: end, export_folder: filename, source: existing ? undefined : 'manual_items', line_count: Math.max(existing?.line_count || 0, lines.length) },
        { onConflict: 'business_date' }
      );
      if (dayErr) throw new Error(dayErr.message);
      for (let i = 0; i < lines.length; i += CHUNK) {
        const { error } = await supabaseAdmin.from('toast_sales_lines').upsert(lines.slice(i, i + CHUNK), { onConflict: 'item_selection_id', ignoreDuplicates: true });
        if (error) throw new Error(error.message);
      }
    } else {
      const rows = parseProductMix(content);
      const summary = { format, rows: rows.length, drinks: rows.reduce((s, r) => s + r.qty, 0), period_start: start, period_end: end, conflicts };
      if (preview || conflicts.length) {
        return res.status(conflicts.length && !preview ? 409 : 200).json({
          ...summary,
          error: conflicts.length ? 'Sales for some of these dates are already imported — uploading would count them twice.' : undefined,
        });
      }
      if (rows.length === 0) return res.status(400).json({ error: 'No items with a quantity in this report.' });
      if (rows.length > MAX_PMIX_ROWS) return res.status(400).json({ error: `This report has ${rows.length} items — upload it in smaller date ranges.` });

      const ids = await knownToastIds();
      const lines = rows.map(r => {
        const key = productMixKey(r);
        return {
          item_selection_id: `pmix:${end}:${key}`,
          toast_item_id: ids.get(key) || `pmix:${key}`,
          menu_item: r.menu_item,
          menu_group: r.menu_group,
          menu: r.menu,
          qty: r.qty,
          gross_price: r.gross,
          discount: r.discount,
          net_price: r.net,
          ordered_at: start === end ? start : `${start} to ${end}`,
        };
      });
      // Day and lines in one transaction, with the overlap check inside it.
      const { error } = await supabaseAdmin.rpc('import_product_mix', {
        p_period_start: start,
        p_business_date: end,
        p_filename: filename,
        p_lines: lines,
      });
      if (error) {
        if (error.message?.includes('OVERLAP')) {
          return res.status(409).json({ error: 'Sales for some of these dates are already imported — uploading would count them twice.', detail: error.message });
        }
        throw new Error(error.message);
      }
    }

    await reopenIfPending(end);
    const closed = await settleDaysWithNothingToApprove([end]);
    await notifyNewGaps();
    return res.status(201).json({ imported: true, format, business_date: end, closed_no_sales: closed.length > 0 });
  } catch (err) {
    console.error('manual sales upload error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Upload failed' });
  }
}

export default withStrictRateLimitAndAuth(handler);
