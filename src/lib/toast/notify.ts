import { supabaseAdmin } from '../supabase';
import { sendSMS } from '../sms';
import { saleLocationSlug } from '../toastSalesCore';
import { loadPlanContext, pendingLines, planFor, PlanContext } from './plan';

const NOTICE_KEY = 'toast_gap_notices';
const MAX_REMEMBERED = 1000;
const MAX_LISTED = 6;

export interface Gap {
  key: string;
  text: string;
}

/** Everything in open days that can't come out of stock yet, one entry per Toast item, location and problem. */
export async function currentGaps(ctx?: PlanContext): Promise<Gap[]> {
  const { data, error } = await supabaseAdmin.from('toast_sales_days').select('business_date').in('status', ['pending', 'partial']);
  if (error) throw new Error(`toast_sales_days: ${error.message}`);
  const open = (data || []).map(d => d.business_date as string);
  if (open.length === 0) return [];

  const plan = planFor(await pendingLines(open), ctx || (await loadPlanContext()));
  const gaps = new Map<string, Gap>();
  for (const u of plan.unresolved) {
    for (const reason of u.reasons) {
      const key = `${u.toast_item_id}|${saleLocationSlug(u.menu)}|${reason}`;
      if (!gaps.has(key)) gaps.set(key, { key, text: `${u.menu_item} (${u.menu}): ${reason}` });
    }
  }
  return Array.from(gaps.values());
}

async function adminPhone(): Promise<string | null> {
  const { data } = await supabaseAdmin.from('settings').select('admin_notification_phone').limit(1).maybeSingle();
  const phone = (data?.admin_notification_phone || '').trim();
  return phone || null;
}

/**
 * Text the admin notification number about gaps that haven't been reported
 * before. Each gap is reported once; fixing it and having it come back counts
 * as new. Never throws — a failed text must not fail the sync.
 */
export async function notifyNewGaps(ctx?: PlanContext): Promise<{ sent: boolean; new_gaps: number; error?: string }> {
  try {
    const gaps = await currentGaps(ctx);
    const { data: row } = await supabaseAdmin.from('system_settings').select('id, value').eq('key', NOTICE_KEY).maybeSingle();
    const seen = new Set<string>(Array.isArray(row?.value?.keys) ? row.value.keys : []);
    const fresh = gaps.filter(g => !seen.has(g.key));
    if (fresh.length === 0) return { sent: false, new_gaps: 0 };

    const phone = await adminPhone();
    if (!phone) return { sent: false, new_gaps: fresh.length, error: 'No admin notification phone set in settings' };

    const base = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
    const lines = fresh.slice(0, MAX_LISTED).map(g => `• ${g.text}`);
    if (fresh.length > MAX_LISTED) lines.push(`…and ${fresh.length - MAX_LISTED} more`);
    const content =
      `Noir inventory: ${fresh.length} Toast sale gap${fresh.length > 1 ? 's' : ''} need fixing before they can come out of stock:\n` +
      lines.join('\n') +
      (base ? `\n${base}/admin/inventory` : '');

    const result = await sendSMS({ to: phone, content });
    if (!result.success) return { sent: false, new_gaps: fresh.length, error: result.error };

    // Remember what's been reported; forget gaps that have since been fixed so a recurrence is reported again.
    const current = new Set(gaps.map(g => g.key));
    const keys = Array.from(new Set([...Array.from(seen).filter(k => current.has(k)), ...fresh.map(g => g.key)])).slice(-MAX_REMEMBERED);
    const now = new Date().toISOString();
    if (row) await supabaseAdmin.from('system_settings').update({ value: { keys }, updated_at: now }).eq('key', NOTICE_KEY);
    else await supabaseAdmin.from('system_settings').insert({ key: NOTICE_KEY, value: { keys }, created_at: now, updated_at: now });
    return { sent: true, new_gaps: fresh.length };
  } catch (err) {
    console.error('toast gap notify error:', err);
    return { sent: false, new_gaps: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

const FAILURE_KEY = 'toast_sync_failure_notice';

/**
 * Text the admin number when the Toast sync fails — once per outage, not
 * once per failed run. Cleared by the next successful sync. Never throws.
 */
export async function notifySyncFailure(message: string): Promise<void> {
  try {
    const { data: row } = await supabaseAdmin.from('system_settings').select('value').eq('key', FAILURE_KEY).maybeSingle();
    if (row?.value?.notified_at) return; // already told about this outage

    const phone = await adminPhone();
    if (!phone) return;
    const base = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
    const result = await sendSMS({
      to: phone,
      content: `Noir inventory: the Toast sales sync failed — ${message.slice(0, 240)}` + (base ? `\n${base}/admin/inventory` : ''),
    });
    if (!result.success) return;

    const now = new Date().toISOString();
    const value = { notified_at: now, message: message.slice(0, 500) };
    if (row) await supabaseAdmin.from('system_settings').update({ value, updated_at: now }).eq('key', FAILURE_KEY);
    else await supabaseAdmin.from('system_settings').insert({ key: FAILURE_KEY, value, created_at: now, updated_at: now });
  } catch (err) {
    console.error('toast sync failure notify error:', err);
  }
}

/** A successful sync ends the outage, so the next failure texts again. */
export async function clearSyncFailure(): Promise<void> {
  try {
    await supabaseAdmin.from('system_settings').delete().eq('key', FAILURE_KEY);
  } catch (err) {
    console.error('toast sync failure clear error:', err);
  }
}
