

import { createClient } from '@supabase/supabase-js';
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Load reminder hour (optional use)
  const { data: setting, error: settingErr } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'renewal_reminder_hour')
    .single();
  if (settingErr) return res.status(500).json({ error: settingErr.message });

  // Compute tomorrow's date string YYYY-MM-DD
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const targetDate = tomorrow.toISOString().slice(0, 10);

  // Fetch members renewing tomorrow (RPC or manual filter)
  // Assumes you have a Postgres function get_renewals(target_date) defined
  const { data: members, error: membersErr } = await supabase
    .rpc('get_renewals', { target_date: targetDate });
  if (membersErr) return res.status(500).json({ error: membersErr.message });

  // Build lines with name, balance, profile link
  const lines = [];
  for (const m of members) {
    const { data: ledger, error: ledgerErr } = await supabase
      .from('ledger')
      .select('amount')
      .eq('member_id', m.id);
    if (ledgerErr) continue;
    const balance = ledger.reduce((sum, t) => sum + Number(t.amount), 0);
    lines.push(
      `${m.first_name} ${m.last_name} — Balance: $${balance.toFixed(2)} — ` +
      `https://yourapp.com/profile/${m.id}`
    );
  }

  // Send email
  await sgMail.send({
    to: 'tim@828.life',
    from: 'no-reply@yourapp.com',
    subject: `Membership renewals for ${targetDate}`,
    text: lines.length ? lines.join('\n') : 'No renewals tomorrow.'
  });

  res.status(200).json({ sent: lines.length });
}