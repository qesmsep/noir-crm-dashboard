import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

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
  const plus1 = normalized.length === 10 ? '1' + normalized : normalized;
  const plusPlus1 = normalized.length === 10 ? '+1' + normalized : normalized;
  console.log('API phone search:', { normalized, plus1, plusPlus1, phone });
  console.log('checkMemberByPhone API called with phone:', phone);
  const { data, error } = await supabase
    .from('membersTable')
    .select('*')
    .ilike('phone', `%${phone}%`);
  console.log('Supabase query result:', { data, error });
  if (error) {
    console.error('Supabase error in checkMemberByPhone:', error);
    return res.status(500).json({ error: error.message });
  }
  return res.status(200).json({ isMember: data.length > 0 });
} 