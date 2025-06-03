import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const TOAST_API_URL = process.env.TOAST_API_URL;
const TOAST_API_KEY = process.env.TOAST_API_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify the request is authorized (you might want to add more security)
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Fetch house accounts from Toast
    const toastResponse = await axios.get(`${TOAST_API_URL}/house-accounts`, {
      headers: {
        'Authorization': `Bearer ${TOAST_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const houseAccounts = toastResponse.data;

    // Process each house account
    for (const account of houseAccounts) {
      // Find matching member in Supabase
      const { data: members } = await supabase
        .from('members')
        .select('*')
        .eq('toast_customer_id', account.customerId)
        .limit(1);

      if (members && members.length > 0) {
        const member = members[0];

        // Get the last sync timestamp for this member
        const { data: lastSync } = await supabase
          .from('toast_sync_log')
          .select('last_sync')
          .eq('member_id', member.member_id)
          .order('last_sync', { ascending: false })
          .limit(1);

        const lastSyncTime = lastSync?.[0]?.last_sync || new Date(0).toISOString();

        // Get new transactions since last sync
        const newTransactions = account.transactions.filter(tx => 
          new Date(tx.timestamp) > new Date(lastSyncTime)
        );

        // Insert new transactions into the ledger
        for (const tx of newTransactions) {
          await supabase.from('ledger').insert({
            member_id: member.member_id,
            account_id: member.account_id,
            type: 'purchase',
            amount: -Math.abs(tx.amount), // Negative amount for purchases
            note: `Toast House Account: ${tx.description}`,
            date: tx.timestamp,
            toast_transaction_id: tx.id,
            status: 'pending_invoice'
          });
        }

        // Update sync log
        await supabase.from('toast_sync_log').insert({
          member_id: member.member_id,
          last_sync: new Date().toISOString(),
          transactions_synced: newTransactions.length
        });
      }
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Toast sync completed successfully' 
    });

  } catch (error) {
    console.error('Toast sync error:', error);
    return res.status(500).json({ 
      error: 'Failed to sync Toast data',
      details: error.message 
    });
  }
} 