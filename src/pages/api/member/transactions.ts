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
    // Using same query as admin ledger: order by date ascending
    const { data: transactions, error: transactionsError} = await supabaseAdmin
      .from('ledger')
      .select('*')
      .eq('account_id', member.account_id)
      .order('date', { ascending: true });

    if (transactionsError) {
      console.error('Error fetching transactions:', transactionsError);
      return res.status(500).json({ error: 'Failed to fetch transactions' });
    }

    // Fetch attachments for all transactions
    let attachmentMap: Record<number, any[]> = {};
    if (transactions && transactions.length > 0) {
      const { data: attachments, error: attachmentError } = await supabaseAdmin
        .from('transaction_attachments')
        .select('*')
        .in('ledger_id', transactions.map(tx => tx.id))
        .order('uploaded_at', { ascending: false });

      if (!attachmentError && attachments) {
        // Group attachments by ledger_id
        attachmentMap = attachments.reduce((acc, att) => {
          if (!acc[att.ledger_id]) acc[att.ledger_id] = [];
          acc[att.ledger_id].push(att);
          return acc;
        }, {} as Record<number, any[]>);
      }
    }

    // Calculate running balance for each transaction (same logic as admin)
    let runningBalance = 0;
    const transactionsWithBalance = (transactions || []).map((transaction) => {
      const amount = parseFloat(transaction.amount.toString());
      runningBalance += amount; // Amount is already signed (positive for payment, negative for purchase)
      return {
        ...transaction,
        description: transaction.note, // Map 'note' to 'description' for display
        transaction_type: transaction.type === 'payment' ? 'credit' : 'debit', // Map 'type' to 'transaction_type'
        running_balance: runningBalance,
        created_at: transaction.date, // Use date instead of created_at
        attachments: attachmentMap[transaction.id] || [], // Add attachments
        attachment_count: (attachmentMap[transaction.id] || []).length,
      };
    });

    // Reverse to show most recent first
    res.status(200).json({
      transactions: transactionsWithBalance.reverse(),
    });
  } catch (error) {
    console.error('Transactions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
