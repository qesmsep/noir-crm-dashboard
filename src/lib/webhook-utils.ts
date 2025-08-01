import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);



export async function findMemberByPhone(phone: string) {
  try {
    const { data: member, error } = await supabase
      .from('members')
      .select('*')
      .eq('phone', phone)
      .single();

    if (error) {
      console.error('Error finding member by phone:', error);
      return null;
    }

    return member;
  } catch (error) {
    console.error('Error in findMemberByPhone:', error);
    return null;
  }
}

export async function createLedgerEntry(data: {
  member_id: string;
  account_id: string;
  type: string;
  amount: number;
  note: string;
  date: string;
}) {
  try {
    const { data: ledgerEntry, error } = await supabase
      .from('ledger')
      .insert({
        member_id: data.member_id,
        account_id: data.account_id,
        type: data.type,
        amount: data.amount,
        note: data.note,
        date: data.date
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating ledger entry:', error);
      throw error;
    }

    return ledgerEntry;
  } catch (error) {
    console.error('Error in createLedgerEntry:', error);
    throw error;
  }
}



export async function sendErrorNotification(error: string) {
  try {
    // For now, just log the error
    console.error('Error notification:', error);
    
    // In the future, you could send this to a notification service
    // like Slack, email, or a notification API
    
    return true;
  } catch (error) {
    console.error('Error sending error notification:', error);
    return false;
  }
}

export async function updateSyncStatus(data: {
  sync_type: string;
  status: string;
  records_processed?: number;
  records_failed?: number;
  error_message?: string;
  completed_at?: string;
}) {
  try {
    const { data: syncStatus, error } = await supabase
      .from('sync_status')
      .insert({
        sync_type: data.sync_type,
        status: data.status,
        records_processed: data.records_processed || 0,
        records_failed: data.records_failed || 0,
        error_message: data.error_message,
        completed_at: data.completed_at || new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating sync status:', error);
      throw error;
    }

    return syncStatus;
  } catch (error) {
    console.error('Error in updateSyncStatus:', error);
    throw error;
  }
} 