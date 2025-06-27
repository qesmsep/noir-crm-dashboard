import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    // Fetch members
    const { data: membersData, error: memErr } = await supabase
      .from('members')
      .select('*')
      .order('join_date', { ascending: false });

    if (memErr) {
      console.error('Error fetching members:', memErr);
      return res.status(500).json({ error: 'Failed to fetch members' });
    }

    // Enrich with Stripe data
    const enriched = membersData.map(m => ({
      ...m,
      stripeStatus: m.statusStripe || 'none',
      nextRenewal: m.nextRenewalDate || '—'
    }));

    return res.status(200).json(enriched);
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}