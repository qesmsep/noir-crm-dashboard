

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { method } = req;

  if (method === 'GET') {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'renewal_reminder_hour')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ hour: data.value });
  }

  if (method === 'POST') {
    const { hour } = req.body;
    if (hour == null) {
      return res.status(400).json({ error: 'hour is required' });
    }
    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'renewal_reminder_hour', value: String(hour) });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end(`Method ${method} Not Allowed`);
}