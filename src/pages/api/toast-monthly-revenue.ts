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
    const { month, year } = req.query;
    const currentDate = new Date();
    const targetMonth = month ? parseInt(month as string) : currentDate.getMonth();
    const targetYear = year ? parseInt(year as string) : currentDate.getFullYear();

    // Calculate the start and end of the target month
    const startDate = new Date(targetYear, targetMonth, 1);
    const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

    const { data: transactions, error } = await supabase
      .from('toast_transactions')
      .select('amount, transaction_date')
      .gte('transaction_date', startDate.toISOString())
      .lte('transaction_date', endDate.toISOString());

    if (error) {
      console.error('Error fetching Toast transactions:', error);
      return res.status(500).json({ error: 'Failed to fetch Toast transactions' });
    }

    const totalRevenue = transactions?.reduce((sum, tx) => sum + (tx.amount || 0), 0) || 0;

    return res.status(200).json({
      totalRevenue,
      transactionCount: transactions?.length || 0,
      month: targetMonth,
      year: targetYear,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });

  } catch (error) {
    console.error('Error in toast-monthly-revenue API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 