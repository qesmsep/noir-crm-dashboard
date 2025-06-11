import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { phone } = req.query;
  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }
  // Normalize phone: remove non-digits
  const normalized = phone.replace(/\D/g, '');
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .limit(1)
    .or(`phone.eq.${normalized},phone.eq.${phone}`);
  if (error) return res.status(500).json({ error: error.message });
  if (data && data.length > 0) {
    return res.status(200).json({ member: data[0] });
  } else {
    return res.status(200).json({ member: null });
  }
} 