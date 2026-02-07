import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase';
import { parse } from 'cookie';

/**
 * Get all ledger transactions for the logged-in member
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get session from cookie
    const cookies = parse(req.headers.cookie || '');
    const sessionToken = cookies.member_session;

    if (!sessionToken) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get member from session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('member_portal_sessions')
      .select('member_id, members(account_id)')
      .eq('session_token', sessionToken)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const member = Array.isArray(session.members) ? session.members[0] : session.members;

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Get all ledger transactions for this member's account
    const { data: transactions, error: transactionsError } = await supabaseAdmin
      .from('ledger')
      .select('*')
      .eq('account_id', member.account_id)
      .order('created_at', { ascending: false });

    if (transactionsError) {
      console.error('Error fetching transactions:', transactionsError);
      return res.status(500).json({ error: 'Failed to fetch transactions' });
    }

    // Calculate running balance for each transaction
    const sortedTransactions = [...(transactions || [])].reverse();
    let runningBalance = 0;
    const transactionsWithBalance = sortedTransactions.map((transaction) => {
      const amount = parseFloat(transaction.amount.toString());
      runningBalance += transaction.transaction_type === 'credit' ? amount : -amount;
      return {
        ...transaction,
        running_balance: runningBalance,
      };
    }).reverse();

    res.status(200).json({
      transactions: transactionsWithBalance,
    });
  } catch (error) {
    console.error('Transactions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
