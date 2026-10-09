import { supabaseAdmin } from '../supabase';
import { DEFAULT_LOSS_ALLOWANCE, LossAllowance } from '../toastSalesCore';

const KEY = 'inventory_loss_allowance';

export interface LossAllowanceSetting extends LossAllowance {
  history: { date: string; poured_pct: number; packaged_pct: number; reason: string; by: string }[];
}

export async function getLossAllowance(): Promise<LossAllowanceSetting> {
  const { data } = await supabaseAdmin.from('system_settings').select('value').eq('key', KEY).maybeSingle();
  const v = (data?.value || {}) as Partial<LossAllowanceSetting>;
  return {
    poured_pct: typeof v.poured_pct === 'number' ? v.poured_pct : DEFAULT_LOSS_ALLOWANCE.poured_pct,
    packaged_pct: typeof v.packaged_pct === 'number' ? v.packaged_pct : DEFAULT_LOSS_ALLOWANCE.packaged_pct,
    history: Array.isArray(v.history) ? v.history : [],
  };
}

export async function setLossAllowance(next: LossAllowance, reason: string, by: string): Promise<LossAllowanceSetting> {
  const current = await getLossAllowance();
  const value: LossAllowanceSetting = {
    poured_pct: next.poured_pct,
    packaged_pct: next.packaged_pct,
    history: [
      ...current.history,
      { date: new Date().toISOString(), poured_pct: next.poured_pct, packaged_pct: next.packaged_pct, reason, by },
    ],
  };
  const now = new Date().toISOString();
  const { data: existing } = await supabaseAdmin.from('system_settings').select('id').eq('key', KEY).maybeSingle();
  const { error } = existing
    ? await supabaseAdmin.from('system_settings').update({ value, updated_at: now }).eq('key', KEY)
    : await supabaseAdmin.from('system_settings').insert({ key: KEY, value, created_at: now, updated_at: now });
  if (error) throw new Error(`Saving loss allowance: ${error.message}`);
  return value;
}
