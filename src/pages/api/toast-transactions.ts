import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { member_id, limit = '50', offset = '0' } = req.query;

    let query = supabase
      .from('toast_transactions')
      .select(`
        *,
        members (
          first_name,
          last_name,
          phone
        )
      `)
      .order('transaction_date', { ascending: false })
      .limit(parseInt(limit as string))
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    if (member_id) {
      query = query.eq('member_id', member_id);
    }

    const { data: transactions, error } = await query;

    if (error) {
      console.error('Error fetching Toast transactions:', error);
      return res.status(500).json({ error: 'Failed to fetch transactions' });
    }

    return res.status(200).json({ 
      transactions,
      count: transactions?.length || 0
    });

  } catch (error) {
    console.error('Error in toast-transactions API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 